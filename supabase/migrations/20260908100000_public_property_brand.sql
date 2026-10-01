/*
  # Public Brand identity for a property (narrow read contract)

  Adds ONE anon-executable function returning the minimal public Brand identity
  for a single property. host_brands / host_brand_properties stay host-private;
  no anon table grant or policy is added.

  Returns zero rows unless ALL hold:
    1. the property is publicly visible (properties.is_active = true, matching the
       "Public can view active properties" policy and getPublicPropertyBySlug/ById)
    2. the property has a host_brand_properties association
    3. the Brand's host_id equals the property's host_id (legitimate owner)

  Returned columns: brand_name, brand_description ONLY (no ids, no host data).
  Static SQL, SECURITY DEFINER, pinned search_path, EXECUTE granted explicitly.
*/

CREATE OR REPLACE FUNCTION public.get_public_property_brand(p_property_id uuid)
RETURNS TABLE (brand_name text, brand_description text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT hb.business_name, hb.business_description
  FROM public.properties p
  JOIN public.host_brand_properties hbp ON hbp.property_id = p.id
  JOIN public.host_brands hb ON hb.id = hbp.brand_id
  WHERE p.id = p_property_id
    AND p.is_active = true
    AND p.host_id IS NOT NULL
    AND hb.host_id = p.host_id
  LIMIT 1
$$;

COMMENT ON FUNCTION public.get_public_property_brand(uuid) IS
  'Public Brand identity (name, description) for an active, brand-linked property owned by the Brand host. Zero rows otherwise.';

REVOKE ALL ON FUNCTION public.get_public_property_brand(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_property_brand(uuid) TO anon, authenticated;
