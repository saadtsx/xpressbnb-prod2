-- Inquiry-first MVP. No payment collection, booking confirmation or stay completion.
BEGIN;

-- Existing references remain valid. New references are not enumerable counters.
CREATE OR REPLACE FUNCTION public.generate_inquiry_customer_reference()
RETURNS text LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  SELECT 'XPX-' || upper(replace(gen_random_uuid()::text, '-', ''))
$$;
REVOKE ALL ON FUNCTION public.generate_inquiry_customer_reference() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_inquiry_customer_reference() TO service_role;

-- Reassert private RPC grants for every surviving overload from older installs.
DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('create_pending_booking','create_make_offer_inquiry','approve_inquiry_for_host','reject_inquiry')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.signature);
  END LOOP;
END $$;

-- RLS is row-level, not column-level: a public host-row policy also exposed
-- phone, email and payout metadata. Public cards now use a narrow read view.
DROP POLICY IF EXISTS "Anyone can view public host profiles" ON public.hosts;
DROP POLICY IF EXISTS "Guest can view host phone after booking" ON public.hosts;
REVOKE SELECT ON public.hosts FROM PUBLIC, anon;
CREATE VIEW public.public_host_profiles WITH (security_invoker = false) AS
  SELECT h.id, h.name, h.bio, h.kyc_status, h.total_bookings, h.created_at
  FROM public.hosts h WHERE EXISTS (SELECT 1 FROM public.properties p WHERE p.host_id=h.id AND p.is_active IS TRUE);
GRANT SELECT ON public.public_host_profiles TO anon, authenticated;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS response_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS response_kind text,
  ADD COLUMN IF NOT EXISTS counter_amount numeric,
  ADD COLUMN IF NOT EXISTS inquiry_terms jsonb;

CREATE TABLE public.inquiry_response_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id),
  request_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  version integer NOT NULL,
  action text NOT NULL CHECK (action IN ('accepted', 'rejected', 'countered')),
  note text,
  counter_amount numeric,
  previous_terms jsonb,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id, request_id),
  UNIQUE (booking_id, version)
);
ALTER TABLE public.inquiry_response_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inquiry_response_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.inquiry_response_events TO service_role;

-- Only narrow SECURITY DEFINER RPCs may mutate bookings from the application.
REVOKE INSERT, UPDATE, DELETE ON public.bookings FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS "Hosts update bookings for their properties" ON public.bookings;

-- Remove historical permissive SELECT policies, including email/ownership bypasses.
DO $$ DECLARE pol record; BEGIN
  FOR pol IN SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bookings' AND cmd IN ('SELECT', 'ALL')
  LOOP EXECUTE format('DROP POLICY %I ON public.bookings', pol.policyname); END LOOP;
END $$;
CREATE POLICY "Released bookings for current property owner" ON public.bookings
  FOR SELECT TO authenticated USING (
    public.inquiry_contact_released(bookings)
    AND host_id IN (SELECT public.current_host_ids())
    AND EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.host_id = bookings.host_id)
  );

-- Every inquiry insert, including service-role RPC inserts, derives ownership,
-- nights and estimate from the catalog. Client amounts never set financial truth.
CREATE FUNCTION public.validate_inquiry_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.properties%ROWTYPE; subtotal numeric; discount numeric; n integer;
BEGIN
  IF NEW.inquiry_type NOT IN ('book_pay_later', 'make_offer') THEN RETURN NEW; END IF;
  SELECT * INTO p FROM public.properties WHERE id = NEW.property_id AND is_active IS TRUE FOR SHARE;
  IF NOT FOUND OR p.host_id IS NULL OR NEW.host_id IS DISTINCT FROM p.host_id THEN
    RAISE EXCEPTION 'Property not available';
  END IF;
  n := NEW.check_out_date - NEW.check_in_date;
  IF n IS NULL OR n < 1 OR n > 365 OR NEW.check_in_date < (now() AT TIME ZONE 'Asia/Kolkata')::date THEN
    RAISE EXCEPTION 'Invalid stay dates';
  END IF;
  IF NEW.num_guests IS NULL OR NEW.num_guests < 1 OR NEW.num_guests > p.max_guests THEN
    RAISE EXCEPTION 'Invalid guest count';
  END IF;
  IF length(trim(NEW.guest_name)) NOT BETWEEN 1 AND 120
    OR length(coalesce(NEW.special_requests, '')) > 2000
    OR length(coalesce(NEW.offer_message, '')) > 1000 THEN
    RAISE EXCEPTION 'Invalid inquiry details';
  END IF;
  PERFORM public.validate_guest_email(NEW.guest_email);
  IF NOT public.is_property_available(p.id, NEW.check_in_date, NEW.check_out_date)
    OR EXISTS (SELECT 1 FROM public.property_calendar c WHERE c.property_id = p.id
      AND c.date >= NEW.check_in_date AND c.date < NEW.check_out_date
      AND (NOT c.is_available OR (c.date = NEW.check_in_date AND c.minimum_stay > n))) THEN
    RAISE EXCEPTION 'Booking unavailable';
  END IF;
  SELECT sum(coalesce(c.price_override, nullif(p.price_per_day, 0), p.price_full_day))
    INTO subtotal FROM generate_series(0, n - 1) d
    LEFT JOIN public.property_calendar c ON c.property_id = p.id AND c.date = NEW.check_in_date + d;
  IF subtotal IS NULL OR subtotal <= 0 OR subtotal > 100000000 THEN RAISE EXCEPTION 'Price not available'; END IF;
  discount := coalesce((to_jsonb(p)->>'discount_percent')::numeric, 0);
  IF discount > 0 AND discount <= 90 THEN subtotal := subtotal - round(subtotal * discount / 100); END IF;
  IF NEW.inquiry_type = 'make_offer' THEN
    IF NEW.offer_amount IS NULL OR NEW.offer_amount <= 0 OR NEW.offer_amount > 1000000
      OR NEW.offer_amount::text IN ('NaN', 'Infinity', '-Infinity') THEN RAISE EXCEPTION 'Invalid offer'; END IF;
    subtotal := round(NEW.offer_amount * n, 2);
  END IF;
  NEW.nights := n;
  NEW.checkin := NEW.check_in_date;
  NEW.checkout := NEW.check_out_date;
  NEW.amount_total := round(subtotal + CASE WHEN NEW.include_decoration THEN 2000 ELSE 0 END, 2);
  NEW.total_price := NEW.amount_total;
  NEW.inquiry_terms := jsonb_build_object(
    'version', 0, 'currency', 'INR', 'property_title', p.title,
    'check_in', NEW.check_in_date, 'check_out', NEW.check_out_date, 'num_guests', NEW.num_guests,
    'nightly_subtotal', subtotal, 'optional_decoration', CASE WHEN NEW.include_decoration THEN 2000 ELSE 0 END,
    'estimate', NEW.amount_total, 'price_source', CASE WHEN NEW.inquiry_type = 'make_offer' THEN 'guest_offer' ELSE 'catalog_estimate' END,
    'taxes', NULL, 'platform_fees', NULL, 'mandatory_charges', NULL, 'total_payable', NULL,
    'advance_amount', NULL, 'balance', NULL, 'balance_due', NULL, 'deposit_terms', NULL,
    'cancellation_policy', NULL, 'check_in_rules', NULL, 'id_requirements', NULL,
    'accepts_local_ids', p.accepts_local_ids, 'confirmed', false, 'payment_status', 'external_unverified'
  );
  RETURN NEW;
END $$;
CREATE TRIGGER validate_inquiry_insert BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.validate_inquiry_insert();

CREATE FUNCTION public.respond_to_inquiry(
  p_booking_id uuid, p_action text, p_expected_version integer, p_request_id uuid,
  p_note text DEFAULT NULL, p_counter_amount numeric DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.bookings%ROWTYPE; prior public.inquiry_response_events%ROWTYPE; output jsonb; next_terms jsonb;
BEGIN
  SELECT * INTO b FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.properties p JOIN public.hosts h ON h.id = p.host_id
    WHERE p.id = b.property_id AND h.id = b.host_id AND h.user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'Inquiry not available' USING ERRCODE = '42501'; END IF;
  IF p_request_id IS NULL OR p_expected_version IS NULL OR p_action IS NULL
    OR p_action NOT IN ('accepted', 'rejected', 'countered')
    OR length(coalesce(p_note, '')) > 1000 THEN RAISE EXCEPTION 'Invalid response'; END IF;
  SELECT * INTO prior FROM public.inquiry_response_events WHERE booking_id = b.id AND request_id = p_request_id;
  IF FOUND THEN
    IF prior.action IS DISTINCT FROM p_action OR prior.note IS DISTINCT FROM nullif(trim(p_note), '')
      OR prior.counter_amount IS DISTINCT FROM p_counter_amount THEN RAISE EXCEPTION 'Request already used'; END IF;
    RETURN prior.result;
  END IF;
  IF NOT public.inquiry_contact_released(b) OR b.status NOT IN ('pending_host', 'pending', 'inquiry_pending') THEN
    RAISE EXCEPTION 'Inquiry cannot be changed in its current state';
  END IF;
  IF b.response_version <> p_expected_version THEN RAISE EXCEPTION 'Inquiry changed. Refresh before responding.'; END IF;
  IF p_action = 'accepted' AND b.response_kind = 'countered' THEN
    RAISE EXCEPTION 'Counteroffer requires guest agreement outside this inquiry workflow';
  END IF;
  IF p_action = 'countered' THEN
    IF b.inquiry_type <> 'make_offer' OR p_counter_amount IS NULL OR p_counter_amount <= 0
      OR p_counter_amount > 1000000 OR p_counter_amount::text IN ('NaN', 'Infinity', '-Infinity') THEN
      RAISE EXCEPTION 'Invalid counteroffer';
    END IF;
  ELSIF p_counter_amount IS NOT NULL THEN RAISE EXCEPTION 'Unexpected counteroffer amount'; END IF;
  next_terms := coalesce(b.inquiry_terms, '{}'::jsonb) || jsonb_build_object('version', b.response_version + 1, 'confirmed', false);
  IF p_action = 'countered' THEN
    next_terms := next_terms || jsonb_build_object('price_source', 'host_counteroffer',
      'nightly_subtotal', round(p_counter_amount * (b.check_out_date - b.check_in_date), 2),
      'estimate', round(p_counter_amount * (b.check_out_date - b.check_in_date), 2),
      'previous_estimate', b.inquiry_terms->'estimate', 'guest_consent', 'required', 'total_payable', NULL);
  END IF;
  UPDATE public.bookings SET
    status = CASE WHEN p_action = 'countered' THEN 'pending_host' ELSE p_action END,
    response_kind = p_action, response_version = response_version + 1,
    counter_amount = CASE WHEN p_action = 'countered' THEN p_counter_amount ELSE counter_amount END,
    host_decision_at = now(), host_decision_note = nullif(trim(p_note), ''), inquiry_terms = next_terms
    WHERE id = b.id;
  output := jsonb_build_object('status', CASE WHEN p_action = 'countered' THEN 'pending_host' ELSE p_action END,
    'response_kind', p_action, 'response_version', b.response_version + 1);
  INSERT INTO public.inquiry_response_events(booking_id, request_id, actor_id, version, action, note, counter_amount, previous_terms, result)
    VALUES (b.id, p_request_id, auth.uid(), b.response_version + 1, p_action, nullif(trim(p_note), ''), p_counter_amount, b.inquiry_terms, output);
  RETURN output;
END $$;
REVOKE ALL ON FUNCTION public.respond_to_inquiry(uuid,text,integer,uuid,text,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_inquiry(uuid,text,integer,uuid,text,numeric) TO authenticated;

-- Keep the view column order for existing consumers; mask free text too.
CREATE OR REPLACE VIEW public.host_inquiries WITH (security_invoker = false) AS
SELECT b.id, b.property_id, b.host_id, b.status, b.booking_type, b.check_in_date, b.check_out_date,
  b.checkin, b.checkout, b.created_at, b.updated_at, b.num_guests, b.nights, b.amount_total, b.total_price,
  b.offer_amount, CASE WHEN public.inquiry_contact_released(b) THEN b.offer_message END AS offer_message,
  b.inquiry_type, b.payment_status, b.payment_method, b.paid_at, b.include_decoration,
  CASE WHEN public.inquiry_contact_released(b) THEN b.special_requests END AS special_requests,
  b.time_slot, b.source, b.spam_score, b.phone_verified, b.phone_verified_at, b.host_decision_at,
  b.host_decision_note, b.host_viewed_at, b.reviewed_at, b.reviewed_by, b.review_reason, b.approval_source,
  CASE WHEN public.inquiry_contact_released(b) THEN b.guest_name END AS guest_name,
  CASE WHEN public.inquiry_contact_released(b) THEN b.guest_email END AS guest_email,
  CASE WHEN public.inquiry_contact_released(b) THEN b.guest_phone END AS guest_phone,
  CASE WHEN public.inquiry_contact_released(b) THEN b.customer_reference END AS customer_reference,
  public.inquiry_contact_released(b) AS contact_released,
  (b.status IN ('inquiry_preparing', 'inquiry_pending') AND NOT public.inquiry_contact_released(b)) AS quality_review_pending,
  b.response_version, b.response_kind, b.counter_amount, b.inquiry_terms
FROM public.bookings b JOIN public.properties p ON p.id = b.property_id AND p.host_id = b.host_id
WHERE b.host_id IN (SELECT public.current_host_ids());
REVOKE ALL ON public.host_inquiries FROM PUBLIC, anon;
GRANT SELECT ON public.host_inquiries TO authenticated;

CREATE OR REPLACE FUNCTION public.enqueue_host_decision_notification() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.response_version IS DISTINCT FROM OLD.response_version AND public.inquiry_contact_released(NEW) THEN
    INSERT INTO public.booking_notification_queue(booking_id, event_type, payload)
    VALUES (NEW.id, 'inquiry_host_' || NEW.response_kind,
      jsonb_build_object('response_version', NEW.response_version, 'customer_reference', NEW.customer_reference));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trigger_enqueue_host_decision_notification ON public.bookings;
CREATE TRIGGER trigger_enqueue_host_decision_notification AFTER UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_host_decision_notification();

CREATE OR REPLACE FUNCTION public.track_inquiry_by_reference(p_customer_reference text, p_guest_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.bookings%ROWTYPE; notification_state text; host_contact jsonb;
BEGIN
  SELECT * INTO b FROM public.bookings WHERE customer_reference = upper(trim(p_customer_reference))
    AND lower(guest_email) = lower(trim(p_guest_email)) LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inquiry not found'; END IF;
  IF public.inquiry_contact_released(b) THEN
    SELECT jsonb_build_object('name', h.name, 'phone', h.phone) INTO host_contact
      FROM public.hosts h JOIN public.properties p ON p.host_id = h.id
      WHERE p.id = b.property_id AND h.id = b.host_id;
  END IF;
  SELECT n.status INTO notification_state FROM public.notifications n
    JOIN public.booking_notification_queue q ON q.id = n.queue_id
    WHERE n.booking_id = b.id AND n.recipient_role = 'guest'
      AND q.payload->>'response_version' = b.response_version::text
    ORDER BY n.created_at DESC LIMIT 1;
  IF notification_state IS NULL THEN
    SELECT q.status INTO notification_state FROM public.booking_notification_queue q
      WHERE q.booking_id = b.id AND q.payload->>'response_version' = b.response_version::text
      ORDER BY q.created_at DESC LIMIT 1;
    -- Queue processing success alone is not provider confirmation.
    IF notification_state = 'sent' THEN notification_state := 'processing'; END IF;
  END IF;
  RETURN jsonb_build_object('customer_reference', b.customer_reference,
    'display_status', CASE WHEN b.status = 'rejected' THEN CASE WHEN b.host_decision_at IS NOT NULL THEN 'rejected' ELSE 'review_declined' END WHEN b.status = 'cancelled' THEN 'cancelled'
      WHEN b.status = 'accepted' THEN 'accepted' WHEN b.status IN ('confirmed','completed') THEN 'legacy_unverified'
      WHEN b.response_kind = 'countered' OR b.payment_status = 'offer_countered' THEN 'countered'
      WHEN b.host_viewed_at IS NOT NULL AND b.status = 'pending_host' THEN 'viewed_by_host'
      WHEN b.status = 'pending_host' THEN 'sent_to_host' ELSE 'preparing' END,
    'status', b.status, 'phone_verified', b.phone_verified, 'property_id', b.property_id,
    'check_in_date', b.check_in_date, 'check_out_date', b.check_out_date, 'num_guests', b.num_guests,
    'created_at', b.created_at, 'updated_at', b.updated_at, 'reviewed_at', b.reviewed_at,
    'host_decision_note', b.host_decision_note, 'response_version', b.response_version, 'host_contact', host_contact,
    'terms', b.inquiry_terms, 'notification_status', coalesce(notification_state, 'not_queued'),
    'payment_status', 'external_unverified', 'booking_status', 'not_confirmed');
END $$;
REVOKE ALL ON FUNCTION public.track_inquiry_by_reference(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_inquiry_by_reference(text,text) TO anon, authenticated;

-- Public listing media remain public; only authenticated hosts upload and only
-- the uploader deletes. Legacy ownerless objects require an operations cleanup.
DROP POLICY IF EXISTS "Anyone can upload property images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete property images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload property images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own property images" ON storage.objects;
CREATE POLICY "Hosts upload their listing images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'property-images' AND owner_id = auth.uid()::text AND EXISTS (SELECT 1 FROM public.current_host_ids()));
CREATE POLICY "Uploader deletes listing images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'property-images' AND owner_id = auth.uid()::text);

-- Publicly editable review/verification evidence cannot support trust claims.
REVOKE INSERT, UPDATE, DELETE ON public.external_reviews FROM PUBLIC, anon, authenticated;
-- Host profile settings use an explicit allowlist. KYC, review aggregates and
-- payment/subscription entitlements are written only by trusted server workflows.
REVOKE INSERT, UPDATE ON public.hosts FROM PUBLIC, anon, authenticated;
GRANT INSERT (user_id, name, email, phone, bio) ON public.hosts TO authenticated;
GRANT UPDATE (user_id, name, email, phone, bio, payout_details) ON public.hosts TO authenticated;
-- host_subscriptions is absent on some installs (live drift); guard each table.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['public.host_subscriptions', 'public.property_subscriptions'] LOOP
    IF to_regclass(t) IS NOT NULL THEN
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON %s FROM PUBLIC, anon, authenticated', t);
    END IF;
  END LOOP;
END $$;
CREATE FUNCTION public.protect_property_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.is_verified := false; NEW.rating := NULL; NEW.total_reviews := 0;
      NEW.is_premium := false; NEW.premium_plan := 'FREE'; NEW.premium_expiry := NULL;
    ELSIF NEW.is_verified IS DISTINCT FROM OLD.is_verified OR NEW.rating IS DISTINCT FROM OLD.rating
      OR NEW.total_reviews IS DISTINCT FROM OLD.total_reviews OR NEW.is_premium IS DISTINCT FROM OLD.is_premium
      OR NEW.premium_plan IS DISTINCT FROM OLD.premium_plan OR NEW.premium_expiry IS DISTINCT FROM OLD.premium_expiry THEN
      RAISE EXCEPTION 'Verification, reviews and entitlements are managed by operations' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_property_evidence BEFORE INSERT OR UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.protect_property_evidence();
COMMIT;
