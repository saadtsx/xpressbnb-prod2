/**
 * Host business-identity (Brand) domain.
 *
 * Persistence: public.host_brands + public.host_brand_properties.
 * Authorization is RLS + replace_host_brand_properties (SECURITY INVOKER).
 * This module does not publish Brand to guest listings.
 */

import type { HostBrand } from './database.types';
import { logSupabaseError, supabase } from './supabase';

export const HOST_BRAND_NAME_MIN = 2;
export const HOST_BRAND_NAME_MAX = 60;
export const HOST_BRAND_DESCRIPTION_MAX = 160;

export const HOST_BRAND_SAVE_ERROR = 'Could not save your business name. Try again.';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type HostBrandField = 'businessName' | 'businessDescription' | 'propertyIds';

export type HostBrandValidationIssue = {
  field: HostBrandField;
  message: string;
};

export type HostBrandIdentity = {
  id: string;
  hostId: string;
  businessName: string;
  businessDescription: string | null;
  createdAt: string;
  updatedAt: string;
};

export type HostBrandInput = {
  businessName: string;
  businessDescription?: string | null;
};

function displayLength(value: string): number {
  return Array.from(value).length;
}

export function normalizeBusinessName(raw: string): string {
  return raw.trim();
}

export function normalizeBusinessDescription(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function validateHostBrandInput(input: HostBrandInput): HostBrandValidationIssue[] {
  const issues: HostBrandValidationIssue[] = [];
  const name = normalizeBusinessName(input.businessName);
  const nameLen = displayLength(name);

  if (nameLen === 0 || nameLen < HOST_BRAND_NAME_MIN) {
    issues.push({
      field: 'businessName',
      message: 'Enter a business name to continue.',
    });
  } else if (nameLen > HOST_BRAND_NAME_MAX) {
    issues.push({
      field: 'businessName',
      message: 'Keep the business name under 60 characters.',
    });
  }

  const description = normalizeBusinessDescription(input.businessDescription);
  if (description && displayLength(description) > HOST_BRAND_DESCRIPTION_MAX) {
    issues.push({
      field: 'businessDescription',
      message: 'Keep the description under 160 characters.',
    });
  }

  return issues;
}

export function uniquePropertyIds(propertyIds: readonly string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const raw of propertyIds) {
    const id = raw.trim();
    if (!UUID_RE.test(id) || seen.has(id)) continue;
    seen.add(id);
    next.push(id);
  }
  return next;
}

function mapHostBrandRow(row: HostBrand): HostBrandIdentity {
  return {
    id: row.id,
    hostId: row.host_id,
    businessName: row.business_name,
    businessDescription: row.business_description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadHostBrandState(hostId: string): Promise<{
  brand: HostBrandIdentity | null;
  error: boolean;
}> {
  const id = hostId.trim();
  if (!id) return { brand: null, error: false };

  const { data, error } = await supabase
    .from('host_brands')
    .select('id, host_id, business_name, business_description, created_at, updated_at')
    .eq('host_id', id)
    .maybeSingle();

  if (error) {
    logSupabaseError('loadHostBrand', error);
    return { brand: null, error: true };
  }
  if (!data) return { brand: null, error: false };
  return { brand: mapHostBrandRow(data), error: false };
}

export async function loadHostBrand(hostId: string): Promise<HostBrandIdentity | null> {
  const result = await loadHostBrandState(hostId);
  return result.brand;
}

export async function upsertHostBrand(
  hostId: string,
  input: HostBrandInput,
): Promise<{
  brand: HostBrandIdentity | null;
  validation: HostBrandValidationIssue[];
  error: string | null;
}> {
  const validation = validateHostBrandInput(input);
  if (validation.length > 0) {
    return { brand: null, validation, error: null };
  }

  const trimmedHostId = hostId.trim();
  if (!trimmedHostId) {
    return { brand: null, validation: [], error: HOST_BRAND_SAVE_ERROR };
  }

  const { data, error } = await supabase
    .from('host_brands')
    .upsert(
      {
        host_id: trimmedHostId,
        business_name: normalizeBusinessName(input.businessName),
        business_description: normalizeBusinessDescription(input.businessDescription),
      },
      { onConflict: 'host_id' },
    )
    .select('id, host_id, business_name, business_description, created_at, updated_at')
    .maybeSingle();

  if (error || !data) {
    logSupabaseError('upsertHostBrand', error);
    return { brand: null, validation: [], error: HOST_BRAND_SAVE_ERROR };
  }

  return { brand: mapHostBrandRow(data), validation: [], error: null };
}

export async function listHostBrandPropertyIds(brandId: string): Promise<string[]> {
  const id = brandId.trim();
  if (!id) return [];

  const { data, error } = await supabase
    .from('host_brand_properties')
    .select('property_id')
    .eq('brand_id', id)
    .order('created_at', { ascending: true });

  if (error) {
    logSupabaseError('listHostBrandPropertyIds', error);
    return [];
  }

  return (data ?? []).map((row) => row.property_id);
}

export async function saveHostBrandPropertyIds(
  brandId: string,
  propertyIds: readonly string[],
): Promise<{ propertyIds: string[]; validation: HostBrandValidationIssue[]; error: string | null }> {
  const id = brandId.trim();
  if (!id) {
    return { propertyIds: [], validation: [], error: HOST_BRAND_SAVE_ERROR };
  }

  const rejected = propertyIds.filter((raw) => {
    const value = raw.trim();
    return value.length > 0 && !UUID_RE.test(value);
  });
  if (rejected.length > 0) {
    return {
      propertyIds: [],
      validation: [{ field: 'propertyIds', message: HOST_BRAND_SAVE_ERROR }],
      error: null,
    };
  }

  const ids = uniquePropertyIds(propertyIds);

  const { data, error } = await supabase.rpc('replace_host_brand_properties', {
    p_brand_id: id,
    p_property_ids: ids,
  });

  if (error) {
    logSupabaseError('saveHostBrandPropertyIds', error);
    return { propertyIds: [], validation: [], error: HOST_BRAND_SAVE_ERROR };
  }

  return { propertyIds: data ?? ids, validation: [], error: null };
}

/** Association set edits for the Brand management page (server still validates ownership). */
export function withPropertyLinked(current: readonly string[], propertyId: string): string[] {
  return uniquePropertyIds([...current, propertyId]);
}

export function withPropertyUnlinked(current: readonly string[], propertyId: string): string[] {
  return current.filter((id) => id !== propertyId);
}
