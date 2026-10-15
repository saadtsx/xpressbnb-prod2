/**
 * Defensive parser for properties.external_listings (jsonb array).
 * Schema is not documented in migrations — unknown shapes are ignored.
 */

import type { Json } from './database.types';

export type ParsedExternalListing = {
  platform: string;
  url: string;
  listedPrice: number;
  opsVerified: boolean;
  lastChecked: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function readString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function readPositiveNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
    if (typeof v === 'string') {
      const n = Number(v.replace(/[^\d.]/g, ''));
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

function isSafeHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

function parseOneEntry(raw: unknown): ParsedExternalListing | null {
  const obj = asRecord(raw);
  if (!obj) return null;

  const platform =
    readString(obj, ['platform', 'platform_name', 'platformName', 'name', 'source']) ??
    'External platform';
  const url = readString(obj, ['url', 'listing_url', 'listingUrl', 'link', 'href']);
  const listedPrice = readPositiveNumber(obj, [
    'listed_price',
    'listedPrice',
    'price',
    'ota_price',
    'competitor_price',
  ]);

  if (!url || !isSafeHttpUrl(url) || listedPrice == null) return null;

  // This JSON is host-editable. Its flags cannot establish operations verification.
  const opsVerified = false;

  const lastChecked = readString(obj, ['last_checked', 'lastChecked', 'checked_at']);

  return {
    platform,
    url,
    listedPrice,
    opsVerified,
    lastChecked,
  };
}

/** Parse external_listings jsonb — returns only entries with URL + positive price. */
export function parseExternalListingProof(raw: Json | null | undefined): ParsedExternalListing[] {
  if (raw == null) return [];
  const items = Array.isArray(raw) ? raw : [raw];
  const out: ParsedExternalListing[] = [];
  for (const item of items) {
    const parsed = parseOneEntry(item);
    if (parsed) out.push(parsed);
  }
  return out;
}

/** Prefer ops-verified entry, else first valid host-provided entry. */
export function pickExternalListingForDisplay(
  raw: Json | null | undefined,
): ParsedExternalListing | null {
  const all = parseExternalListingProof(raw);
  if (all.length === 0) return null;
  return all.find((e) => e.opsVerified) ?? all[0];
}

export function formatInr(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}
