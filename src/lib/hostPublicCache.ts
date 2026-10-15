/**
 * Guest-facing host row cache — dedupe N+1 card fetches and batch-warm listing grids.
 */

import { supabase } from './supabase';

const HOST_CACHE_TTL_MS = 60_000;
const HOST_BATCH_SIZE = 40;

const HOST_PUBLIC_SELECT = 'id, name, bio, kyc_status, total_bookings, created_at';

export type PublicHostRow = {
  id: string;
  name: string;
  bio: string | null;
  kyc_status: string | null;
  total_bookings: number | null;
  created_at: string | null;
};

const cache = new Map<string, { at: number; row: PublicHostRow }>();
const inflightById = new Map<string, Promise<PublicHostRow | null>>();

function isFresh(hostId: string): boolean {
  const entry = cache.get(hostId);
  return Boolean(entry && Date.now() - entry.at < HOST_CACHE_TTL_MS);
}

function normalizeHostRow(raw: unknown): PublicHostRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === 'string' ? row.id : '';
  const name = typeof row.name === 'string' ? row.name : '';
  if (!id || !name) return null;
  return {
    id,
    name,
    bio: typeof row.bio === 'string' ? row.bio : null,
    kyc_status: typeof row.kyc_status === 'string' ? row.kyc_status : null,
    total_bookings: typeof row.total_bookings === 'number' ? row.total_bookings : null,
    created_at: typeof row.created_at === 'string' ? row.created_at : null,
  };
}

function storeRow(row: PublicHostRow): void {
  cache.set(row.id, { at: Date.now(), row });
}

/** Fetch one host — cache + in-flight dedupe. */
export async function fetchPublicHost(hostId: string): Promise<PublicHostRow | null> {
  const trimmed = hostId.trim();
  if (!trimmed) return null;

  if (isFresh(trimmed)) {
    return cache.get(trimmed)?.row ?? null;
  }

  const pending = inflightById.get(trimmed);
  if (pending) return pending;

  const run = async (): Promise<PublicHostRow | null> => {
    const { data, error } = await supabase
      .from('public_host_profiles')
      .select(HOST_PUBLIC_SELECT)
      .eq('id', trimmed)
      .maybeSingle();

    if (error || !data) return null;

    const row = normalizeHostRow(data);
    if (row) storeRow(row);
    return row;
  };

  const promise = run().finally(() => {
    inflightById.delete(trimmed);
  });
  inflightById.set(trimmed, promise);
  return promise;
}

/** Batch-load hosts for listing grids — one request per chunk of unique ids. */
export function warmPublicHostCache(hostIds: (string | null | undefined)[]): void {
  const unique = [
    ...new Set(
      hostIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0),
    ),
  ];
  const missing = unique.filter((id) => !isFresh(id) && !inflightById.has(id));
  if (missing.length === 0) return;

  void (async () => {
    for (let i = 0; i < missing.length; i += HOST_BATCH_SIZE) {
      const chunk = missing.slice(i, i + HOST_BATCH_SIZE);
      const { data, error } = await supabase
        .from('public_host_profiles')
        .select(HOST_PUBLIC_SELECT)
        .in('id', chunk);

      if (error || !data) continue;

      for (const raw of data) {
        const row = normalizeHostRow(raw);
        if (row) storeRow(row);
      }
    }
  })();
}

export function invalidatePublicHostCache(): void {
  cache.clear();
}
