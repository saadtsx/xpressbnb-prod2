/*
  # Property reports (guest-flagged listings) — realtime to Ops

  Guests can report a listing in one tap from the property page.

  - property_reports is private: RLS on, NO anon/authenticated table grants.
  - Writes go through ONE narrow RPC, report_property(), executable by anon.
    It validates the listing is publicly visible, the reason is allowlisted,
    and rate-limits per device fingerprint. Reports NEVER change a listing's
    visibility — Ops decides (prevents report-bombing a competitor offline).
  - Ops sees new reports live: table is in the supabase_realtime publication
    and admins (admin_users by JWT email) may SELECT, so the existing Ops
    session receives postgres_changes events. Edge-only OPS_ALLOWED_EMAILS
    admins are not in admin_users and must refresh the snapshot instead.
*/

CREATE TABLE IF NOT EXISTS public.property_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  reason text NOT NULL,
  details text,
  device_fingerprint text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT property_reports_reason_check CHECK (
    reason IN ('inaccurate', 'unsafe', 'scam', 'not_available', 'inappropriate', 'other')
  ),
  CONSTRAINT property_reports_status_check CHECK (
    status IN ('open', 'reviewing', 'resolved', 'dismissed')
  ),
  CONSTRAINT property_reports_details_length_check CHECK (
    details IS NULL OR char_length(details) <= 500
  )
);

CREATE INDEX IF NOT EXISTS idx_property_reports_property_created
  ON public.property_reports (property_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_property_reports_fingerprint_created
  ON public.property_reports (device_fingerprint, created_at DESC);

ALTER TABLE public.property_reports ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.property_reports FROM PUBLIC;
REVOKE ALL ON TABLE public.property_reports FROM anon;
REVOKE ALL ON TABLE public.property_reports FROM authenticated;
GRANT ALL ON TABLE public.property_reports TO postgres, service_role;
GRANT SELECT ON TABLE public.property_reports TO authenticated; -- gated by admin policy below

-- Admin check by JWT email; SECURITY DEFINER so admin_users RLS (deny-all) is not re-entered.
CREATE OR REPLACE FUNCTION public.is_ops_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users a
    WHERE lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
$$;

REVOKE ALL ON FUNCTION public.is_ops_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_ops_admin() TO authenticated;

DROP POLICY IF EXISTS "Ops admins can view property reports" ON public.property_reports;
CREATE POLICY "Ops admins can view property reports"
  ON public.property_reports
  FOR SELECT
  TO authenticated
  USING (public.is_ops_admin());

CREATE OR REPLACE FUNCTION public.report_property(
  p_property_id uuid,
  p_reason text,
  p_details text DEFAULT NULL,
  p_device_fingerprint text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_details text := nullif(btrim(coalesce(p_details, '')), '');
  v_fp text := nullif(btrim(coalesce(p_device_fingerprint, '')), '');
  v_id uuid;
BEGIN
  IF p_reason IS NULL
     OR p_reason NOT IN ('inaccurate', 'unsafe', 'scam', 'not_available', 'inappropriate', 'other') THEN
    RAISE EXCEPTION 'Invalid report reason';
  END IF;

  IF v_details IS NOT NULL AND char_length(v_details) > 500 THEN
    RAISE EXCEPTION 'Details too long';
  END IF;

  IF v_fp IS NOT NULL AND char_length(v_fp) > 64 THEN
    v_fp := left(v_fp, 64);
  END IF;

  -- Only publicly visible listings can be reported (same rule as the public page).
  IF NOT EXISTS (
    SELECT 1 FROM public.properties WHERE id = p_property_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Property not available';
  END IF;

  IF v_fp IS NOT NULL THEN
    -- Same device, same listing: count once per day (idempotent for the guest).
    IF EXISTS (
      SELECT 1 FROM public.property_reports
      WHERE property_id = p_property_id
        AND device_fingerprint = v_fp
        AND created_at > now() - interval '1 day'
    ) THEN
      RETURN jsonb_build_object('ok', true, 'duplicate', true);
    END IF;

    IF (
      SELECT count(*) FROM public.property_reports
      WHERE device_fingerprint = v_fp
        AND created_at > now() - interval '1 hour'
    ) >= 5 THEN
      RAISE EXCEPTION 'Too many reports. Please try again later.';
    END IF;
  END IF;

  INSERT INTO public.property_reports (property_id, reason, details, device_fingerprint)
  VALUES (p_property_id, p_reason, v_details, v_fp)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'duplicate', false);
END;
$$;

REVOKE ALL ON FUNCTION public.report_property(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_property(uuid, text, text, text) TO anon, authenticated;

-- Realtime for Ops (RLS above still filters rows to admins).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'property_reports'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.property_reports;
  END IF;
END $$;
