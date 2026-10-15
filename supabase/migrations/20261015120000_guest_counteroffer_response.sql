-- Guest response to a host counteroffer. Inquiry-first: agreeing to a counter
-- price is NOT a booking confirmation and records no payment.
--
-- Authority: guests have no accounts; the same reference + email pair that
-- gates track_inquiry_by_reference authorises the decision. The guest must
-- name the exact proposal version they saw, so a newer host counter makes a
-- stale acceptance fail ("refresh") instead of silently agreeing to new terms.
BEGIN;

CREATE TABLE IF NOT EXISTS public.inquiry_guest_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id),
  request_id uuid NOT NULL,
  version integer NOT NULL,
  action text NOT NULL CHECK (action IN ('accept_counter', 'decline_counter')),
  agreed_counter_amount numeric,
  agreed_terms jsonb NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id, request_id),
  UNIQUE (booking_id, version)
);
ALTER TABLE public.inquiry_guest_responses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inquiry_guest_responses FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.inquiry_guest_responses TO service_role;

CREATE OR REPLACE FUNCTION public.respond_to_counteroffer(
  p_customer_reference text, p_guest_email text, p_action text,
  p_expected_version integer, p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.bookings%ROWTYPE; prior public.inquiry_guest_responses%ROWTYPE;
  output jsonb; next_terms jsonb; next_version integer; estimate numeric;
BEGIN
  IF p_action IS NULL OR p_action NOT IN ('accept_counter', 'decline_counter')
    OR p_expected_version IS NULL OR p_request_id IS NULL
    OR p_customer_reference IS NULL OR p_guest_email IS NULL THEN
    RAISE EXCEPTION 'Invalid response';
  END IF;

  SELECT * INTO b FROM public.bookings
    WHERE customer_reference = upper(trim(p_customer_reference))
      AND lower(guest_email) = lower(trim(p_guest_email))
    LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inquiry not found'; END IF;

  -- Idempotent retry: same request id returns the original result.
  SELECT * INTO prior FROM public.inquiry_guest_responses WHERE booking_id = b.id AND request_id = p_request_id;
  IF FOUND THEN
    IF prior.action IS DISTINCT FROM p_action OR prior.version IS DISTINCT FROM p_expected_version THEN
      RAISE EXCEPTION 'Request already used';
    END IF;
    RETURN prior.result;
  END IF;

  IF NOT public.inquiry_contact_released(b) OR b.status <> 'pending_host'
    OR b.response_kind IS DISTINCT FROM 'countered' OR b.counter_amount IS NULL THEN
    RAISE EXCEPTION 'No open counteroffer to respond to';
  END IF;
  IF b.response_version <> p_expected_version THEN
    RAISE EXCEPTION 'Proposal changed. Refresh to see the latest terms.';
  END IF;

  next_version := b.response_version + 1;
  estimate := round(b.counter_amount * (b.check_out_date - b.check_in_date), 2);

  IF p_action = 'accept_counter' THEN
    next_terms := coalesce(b.inquiry_terms, '{}'::jsonb) || jsonb_build_object(
      'version', next_version, 'confirmed', false, 'guest_consent', 'given',
      'guest_consent_version', p_expected_version, 'guest_consent_at', now(),
      'price_source', 'host_counteroffer_guest_agreed', 'estimate', estimate,
      'total_payable', NULL, 'payment_status', 'external_unverified');
    UPDATE public.bookings SET status = 'accepted', response_kind = 'guest_accepted_counter',
      response_version = next_version, amount_total = estimate, total_price = estimate,
      inquiry_terms = next_terms
      WHERE id = b.id;
    output := jsonb_build_object('status', 'accepted', 'display_status', 'counter_accepted', 'response_version', next_version);
  ELSE
    next_terms := coalesce(b.inquiry_terms, '{}'::jsonb) || jsonb_build_object(
      'version', next_version, 'confirmed', false, 'guest_consent', 'declined',
      'guest_consent_version', p_expected_version, 'guest_consent_at', now());
    UPDATE public.bookings SET status = 'cancelled', response_kind = 'guest_declined_counter',
      response_version = next_version, inquiry_terms = next_terms
      WHERE id = b.id;
    output := jsonb_build_object('status', 'cancelled', 'display_status', 'counter_declined', 'response_version', next_version);
  END IF;

  INSERT INTO public.inquiry_guest_responses(booking_id, request_id, version, action, agreed_counter_amount, agreed_terms, result)
    VALUES (b.id, p_request_id, p_expected_version, p_action,
      CASE WHEN p_action = 'accept_counter' THEN b.counter_amount END, b.inquiry_terms, output);
  RETURN output;
END $$;
REVOKE ALL ON FUNCTION public.respond_to_counteroffer(text,text,text,integer,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_to_counteroffer(text,text,text,integer,uuid) TO anon, authenticated;

-- Guest decisions notify the host; host decisions notify the guest.
CREATE OR REPLACE FUNCTION public.enqueue_host_decision_notification() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.response_version IS DISTINCT FROM OLD.response_version AND public.inquiry_contact_released(NEW) THEN
    INSERT INTO public.booking_notification_queue(booking_id, event_type, payload)
    VALUES (NEW.id,
      CASE WHEN NEW.response_kind LIKE 'guest\_%' THEN 'inquiry_' || NEW.response_kind
           ELSE 'inquiry_host_' || NEW.response_kind END,
      jsonb_build_object('response_version', NEW.response_version, 'customer_reference', NEW.customer_reference));
  END IF;
  RETURN NEW;
END $$;

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
    IF notification_state = 'sent' THEN notification_state := 'processing'; END IF;
  END IF;
  RETURN jsonb_build_object('customer_reference', b.customer_reference,
    'display_status', CASE
      WHEN b.response_kind = 'guest_accepted_counter' THEN 'counter_accepted'
      WHEN b.response_kind = 'guest_declined_counter' THEN 'counter_declined'
      WHEN b.status = 'rejected' THEN CASE WHEN b.host_decision_at IS NOT NULL THEN 'rejected' ELSE 'review_declined' END
      WHEN b.status = 'cancelled' THEN 'cancelled'
      WHEN b.status = 'accepted' THEN 'accepted'
      WHEN b.status IN ('confirmed','completed') THEN 'legacy_unverified'
      WHEN b.response_kind = 'countered' OR b.payment_status = 'offer_countered' THEN 'countered'
      WHEN b.host_viewed_at IS NOT NULL AND b.status = 'pending_host' THEN 'viewed_by_host'
      WHEN b.status = 'pending_host' THEN 'sent_to_host' ELSE 'preparing' END,
    'status', b.status, 'phone_verified', b.phone_verified, 'property_id', b.property_id,
    'check_in_date', b.check_in_date, 'check_out_date', b.check_out_date, 'num_guests', b.num_guests,
    'created_at', b.created_at, 'updated_at', b.updated_at, 'reviewed_at', b.reviewed_at,
    'host_decision_note', b.host_decision_note, 'response_version', b.response_version, 'host_contact', host_contact,
    'counter_amount', CASE WHEN b.response_kind = 'countered' THEN b.counter_amount END,
    'terms', b.inquiry_terms, 'notification_status', coalesce(notification_state, 'not_queued'),
    'payment_status', 'external_unverified', 'booking_status', 'not_confirmed');
END $$;
REVOKE ALL ON FUNCTION public.track_inquiry_by_reference(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_inquiry_by_reference(text,text) TO anon, authenticated;

COMMIT;
