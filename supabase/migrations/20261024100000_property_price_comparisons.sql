-- Same-property price comparison against other platforms (Airbnb, Booking.com, ...).
--
-- Trust model: a host SUBMITS a link + the price they see on that platform;
-- operations VERIFIES it by opening the link (no scraping). Guests only ever
-- see verified, recent comparisons. Host-entered prices are never shown
-- unverified, because an inflated "Airbnb price" would fake our advantage.
BEGIN;

CREATE TABLE IF NOT EXISTS public.property_external_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('airbnb', 'booking', 'makemytrip', 'goibibo', 'agoda')),
  url text NOT NULL CHECK (char_length(url) <= 600),
  nightly_price numeric NOT NULL CHECK (nightly_price > 0 AND nightly_price <= 1000000),
  includes_fees boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  review_note text CHECK (review_note IS NULL OR char_length(review_note) <= 500),
  submitted_by uuid NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  CONSTRAINT property_external_listings_one_per_platform UNIQUE (property_id, platform)
);
CREATE INDEX IF NOT EXISTS idx_property_external_listings_status
  ON public.property_external_listings (status, submitted_at DESC);

ALTER TABLE public.property_external_listings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.property_external_listings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.property_external_listings TO authenticated; -- filtered by policy
GRANT ALL ON public.property_external_listings TO service_role;

DROP POLICY IF EXISTS "Owners and ops read external listings" ON public.property_external_listings;
CREATE POLICY "Owners and ops read external listings" ON public.property_external_listings
  FOR SELECT TO authenticated USING (
    public.is_ops_admin()
    OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.host_id IN (SELECT public.current_host_ids()))
  );

-- Platform must match the URL's domain, https only, no credentials/ports.
CREATE OR REPLACE FUNCTION public.external_listing_url_matches(p_platform text, p_url text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT p_url ~* CASE p_platform
    WHEN 'airbnb'     THEN '^https://([a-z0-9-]+\.)*airbnb\.(com|co\.in|co\.uk|ca|com\.au|de|fr|es|it|ae)(/|$)'
    WHEN 'booking'    THEN '^https://([a-z0-9-]+\.)*booking\.com(/|$)'
    WHEN 'makemytrip' THEN '^https://([a-z0-9-]+\.)*makemytrip\.com(/|$)'
    WHEN 'goibibo'    THEN '^https://([a-z0-9-]+\.)*goibibo\.com(/|$)'
    WHEN 'agoda'      THEN '^https://([a-z0-9-]+\.)*agoda\.com(/|$)'
    ELSE '^$' END
$$;

CREATE OR REPLACE FUNCTION public.submit_external_listing(
  p_property_id uuid, p_platform text, p_url text, p_nightly_price numeric, p_includes_fees boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_url text := btrim(coalesce(p_url, '')); v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.properties p JOIN public.hosts h ON h.id = p.host_id
    WHERE p.id = p_property_id AND h.user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'Property not available' USING ERRCODE = '42501'; END IF;
  IF p_platform IS NULL OR NOT public.external_listing_url_matches(p_platform, v_url) OR char_length(v_url) > 600 THEN
    RAISE EXCEPTION 'Link must be an https link on the selected platform';
  END IF;
  IF p_nightly_price IS NULL OR p_nightly_price <= 0 OR p_nightly_price > 1000000
    OR p_nightly_price::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'Enter the nightly price shown on that platform';
  END IF;

  -- Any edit (re)enters review: a verified badge never survives a changed price or link.
  INSERT INTO public.property_external_listings
    (property_id, platform, url, nightly_price, includes_fees, status, submitted_by, submitted_at)
  VALUES (p_property_id, p_platform, v_url, round(p_nightly_price, 2), coalesce(p_includes_fees, false), 'pending', auth.uid(), now())
  ON CONFLICT (property_id, platform) DO UPDATE SET
    url = EXCLUDED.url, nightly_price = EXCLUDED.nightly_price, includes_fees = EXCLUDED.includes_fees,
    status = 'pending', review_note = NULL, reviewed_by = NULL, reviewed_at = NULL,
    submitted_by = EXCLUDED.submitted_by, submitted_at = now()
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'status', 'pending');
END $$;

CREATE OR REPLACE FUNCTION public.remove_external_listing(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.property_external_listings e
  WHERE e.id = p_id AND EXISTS (
    SELECT 1 FROM public.properties p JOIN public.hosts h ON h.id = p.host_id
    WHERE p.id = e.property_id AND h.user_id = auth.uid());
  IF NOT FOUND THEN RAISE EXCEPTION 'Listing link not found' USING ERRCODE = '42501'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.review_external_listing(p_id uuid, p_decision text, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_ops_admin() THEN RAISE EXCEPTION 'Ops access required' USING ERRCODE = '42501'; END IF;
  IF p_decision NOT IN ('verified', 'rejected') OR char_length(coalesce(p_note, '')) > 500 THEN
    RAISE EXCEPTION 'Invalid review';
  END IF;
  UPDATE public.property_external_listings SET status = p_decision,
    review_note = nullif(btrim(coalesce(p_note, '')), ''), reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = p_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Already reviewed or changed. Refresh.'; END IF;
  RETURN jsonb_build_object('id', p_id, 'status', p_decision);
END $$;

-- Public read: verified + reviewed in the last 30 days + live property only.
-- Never returns host, reviewer or submission metadata.
CREATE OR REPLACE FUNCTION public.get_property_price_comparisons(p_property_ids uuid[])
RETURNS TABLE (property_id uuid, platform text, url text, nightly_price numeric, includes_fees boolean, checked_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.property_id, e.platform, e.url, e.nightly_price, e.includes_fees, e.reviewed_at
  FROM public.property_external_listings e
  JOIN public.properties p ON p.id = e.property_id AND p.is_active IS TRUE
  WHERE e.property_id = ANY (p_property_ids[1:60])
    AND e.status = 'verified'
    AND e.reviewed_at > now() - interval '30 days'
  ORDER BY e.property_id, e.platform
$$;

REVOKE ALL ON FUNCTION public.external_listing_url_matches(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_external_listing(uuid, text, text, numeric, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_external_listing(uuid, text, text, numeric, boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.remove_external_listing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_external_listing(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.review_external_listing(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_external_listing(uuid, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.get_property_price_comparisons(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_property_price_comparisons(uuid[]) TO anon, authenticated;

COMMIT;
