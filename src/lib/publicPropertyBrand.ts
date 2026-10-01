/**
 * Public Brand identity for a property page.
 *
 * Separate narrow request via get_public_property_brand — never part of the
 * public listing payload (CARD_LISTING_FIELDS / DETAIL_LISTING_SELECT).
 * Returns only name + description; any failure yields null (page renders as before).
 */

import { logSupabaseError, supabase } from './supabase';

export type PublicPropertyBrand = {
  name: string;
  description: string | null;
};

export function parsePublicPropertyBrand(data: unknown): PublicPropertyBrand | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') return null;
  const { brand_name, brand_description } = row as Record<string, unknown>;
  if (typeof brand_name !== 'string' || brand_name.trim() === '') return null;
  return {
    name: brand_name.trim(),
    description:
      typeof brand_description === 'string' && brand_description.trim() !== ''
        ? brand_description.trim()
        : null,
  };
}

export async function getPublicPropertyBrand(
  propertyId: string,
): Promise<PublicPropertyBrand | null> {
  const id = propertyId.trim();
  if (!id) return null;
  const { data, error } = await supabase.rpc('get_public_property_brand', {
    p_property_id: id,
  });
  if (error) {
    logSupabaseError('getPublicPropertyBrand', error);
    return null;
  }
  return parsePublicPropertyBrand(data);
}
