/**
 * Same-property price comparison with other platforms.
 *
 * Public data comes ONLY from get_property_price_comparisons (ops-verified,
 * reviewed in the last 30 days). Never part of the public listing projection.
 * Host submissions are pending until operations verify them by opening the link.
 */

import { useEffect, useState } from 'react';
import { logSupabaseError, supabase } from './supabase';

export const EXTERNAL_PLATFORMS = [
  { id: 'airbnb', label: 'Airbnb', example: 'https://www.airbnb.co.in/rooms/…' },
  { id: 'booking', label: 'Booking.com', example: 'https://www.booking.com/hotel/in/…' },
  { id: 'makemytrip', label: 'MakeMyTrip', example: 'https://www.makemytrip.com/…' },
  { id: 'goibibo', label: 'Goibibo', example: 'https://www.goibibo.com/…' },
  { id: 'agoda', label: 'Agoda', example: 'https://www.agoda.com/…' },
] as const;

export type ExternalPlatform = (typeof EXTERNAL_PLATFORMS)[number]['id'];

export function platformLabel(id: string): string {
  return EXTERNAL_PLATFORMS.find((p) => p.id === id)?.label ?? 'Other platform';
}

export type PublicPriceComparison = {
  propertyId: string;
  platform: ExternalPlatform;
  url: string;
  nightlyPrice: number;
  includesFees: boolean;
  checkedAt: string;
};

/**
 * Honest difference: only claim "less here" when the other price includes that
 * platform's fees (like-for-like) and ours is genuinely lower. Otherwise show
 * both prices side by side with no savings claim.
 */
export function comparePrices(
  ourNightly: number | null | undefined,
  comparison: Pick<PublicPriceComparison, 'nightlyPrice' | 'includesFees'>,
): { savingsPerNight: number | null; likeForLike: boolean } {
  const likeForLike = comparison.includesFees === true;
  if (!ourNightly || ourNightly <= 0 || !likeForLike) return { savingsPerNight: null, likeForLike };
  const diff = Math.round(comparison.nightlyPrice - ourNightly);
  return { savingsPerNight: diff > 0 ? diff : null, likeForLike };
}

export function formatCheckedDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function parseComparisonRow(raw: unknown): PublicPriceComparison | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const platform = typeof r.platform === 'string' ? r.platform : '';
  const url = typeof r.url === 'string' ? r.url : '';
  const price = Number(r.nightly_price);
  if (
    typeof r.property_id !== 'string' ||
    !EXTERNAL_PLATFORMS.some((p) => p.id === platform) ||
    !url.startsWith('https://') ||
    !Number.isFinite(price) ||
    price <= 0 ||
    typeof r.checked_at !== 'string'
  ) {
    return null;
  }
  return {
    propertyId: r.property_id,
    platform: platform as ExternalPlatform,
    url,
    nightlyPrice: price,
    includesFees: r.includes_fees === true,
    checkedAt: r.checked_at,
  };
}

// ---------------------------------------------------------------------------
// Batched public cache: cards ask per property; one RPC per tick per 60 ids.
// ---------------------------------------------------------------------------

const TTL_MS = 5 * 60_000;
const BATCH = 60;
const cache = new Map<string, { at: number; rows: PublicPriceComparison[] }>();
const queued = new Set<string>();
const inflight = new Set<string>();
const listeners = new Map<string, Set<() => void>>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function notify(id: string) {
  listeners.get(id)?.forEach((fn) => fn());
}

async function flush() {
  flushTimer = null;
  const ids = [...queued];
  queued.clear();
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH);
    chunk.forEach((id) => inflight.add(id));
    const { data, error } = await supabase.rpc('get_property_price_comparisons', { p_property_ids: chunk });
    const now = Date.now();
    if (error) logSupabaseError('get_property_price_comparisons', error);
    const byId = new Map<string, PublicPriceComparison[]>(chunk.map((id) => [id, []]));
    for (const raw of error ? [] : data ?? []) {
      const row = parseComparisonRow(raw);
      if (row) byId.get(row.propertyId)?.push(row);
    }
    for (const [id, rows] of byId) {
      inflight.delete(id);
      // On error cache an empty result briefly so the card renders as before (no comparison).
      cache.set(id, { at: error ? now - TTL_MS + 30_000 : now, rows });
      notify(id);
    }
  }
}

function request(id: string) {
  const entry = cache.get(id);
  if ((entry && Date.now() - entry.at < TTL_MS) || queued.has(id) || inflight.has(id)) return;
  queued.add(id);
  if (!flushTimer) flushTimer = setTimeout(() => void flush(), 0);
}

/** Verified comparisons for one property; [] when none, null while loading. */
export function usePriceComparisons(propertyId: string | null | undefined): PublicPriceComparison[] | null {
  const id = propertyId?.trim() ?? '';
  const [, force] = useState(0);
  useEffect(() => {
    if (!id) return;
    const fn = () => force((n) => n + 1);
    if (!listeners.has(id)) listeners.set(id, new Set());
    listeners.get(id)!.add(fn);
    request(id);
    return () => {
      listeners.get(id)?.delete(fn);
    };
  }, [id]);
  if (!id) return [];
  return cache.get(id)?.rows ?? null;
}

export function invalidatePriceComparisons(propertyId?: string) {
  if (propertyId) cache.delete(propertyId);
  else cache.clear();
}

// ---------------------------------------------------------------------------
// Host + operations (authenticated; server enforces ownership / ops role)
// ---------------------------------------------------------------------------

export type ExternalListingRecord = {
  id: string;
  property_id: string;
  platform: string;
  url: string;
  nightly_price: number;
  includes_fees: boolean;
  status: 'pending' | 'verified' | 'rejected';
  review_note: string | null;
  submitted_at: string;
  reviewed_at: string | null;
};

const RECORD_SELECT =
  'id, property_id, platform, url, nightly_price, includes_fees, status, review_note, submitted_at, reviewed_at';

export async function listExternalListings(propertyId: string): Promise<ExternalListingRecord[]> {
  const { data, error } = await supabase
    .from('property_external_listings')
    .select(RECORD_SELECT)
    .eq('property_id', propertyId)
    .order('platform');
  if (error) {
    logSupabaseError('listExternalListings', error);
    return [];
  }
  return (data ?? []) as ExternalListingRecord[];
}

export async function submitExternalListing(input: {
  propertyId: string;
  platform: ExternalPlatform;
  url: string;
  nightlyPrice: number;
  includesFees: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.rpc('submit_external_listing', {
    p_property_id: input.propertyId,
    p_platform: input.platform,
    p_url: input.url.trim(),
    p_nightly_price: input.nightlyPrice,
    p_includes_fees: input.includesFees,
  });
  if (!error) return { ok: true };
  const msg = error.message ?? '';
  return {
    ok: false,
    error: /link must be|nightly price/i.test(msg) ? msg : 'Could not save the link. Try again.',
  };
}

export async function removeExternalListing(id: string): Promise<boolean> {
  const { error } = await supabase.rpc('remove_external_listing', { p_id: id });
  if (error) logSupabaseError('removeExternalListing', error);
  return !error;
}

export async function listPendingExternalListings(): Promise<ExternalListingRecord[]> {
  const { data, error } = await supabase
    .from('property_external_listings')
    .select(RECORD_SELECT)
    .eq('status', 'pending')
    .order('submitted_at', { ascending: true })
    .limit(50);
  if (error) return [];
  return (data ?? []) as ExternalListingRecord[];
}

export async function reviewExternalListing(
  id: string,
  decision: 'verified' | 'rejected',
  note?: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('review_external_listing', {
    p_id: id,
    p_decision: decision,
    p_note: note?.trim() || null,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}
