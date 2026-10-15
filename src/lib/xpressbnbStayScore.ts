import type { Json } from './database.types';

export type ListingQualitySignals = {
  is_verified?: boolean | null;
  images?: Json | null;
  price_per_day?: number | null;
  price_full_day?: number | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  max_guests?: number | null;
  amenities?: Json | null;
  is_premium?: boolean | null;
  premium_plan?: string | null;
  premium_expiry?: string | null;
  /** When host phone is known to the caller; never exposed in guest UI. */
  host_has_phone?: boolean | null;
};

export const STAY_SCORE_MICROCOPY = 'Host-provided listing facts; completed-stay evidence is not yet verified.';
export type XpressbnbStayScoreResult = { score: null; label: string; microcopy: string };

/** Compatibility name for existing cards. No numerical reputation is calculated. */
export function computeXpressbnbStayScore(signals: ListingQualitySignals): XpressbnbStayScoreResult {
  const photos = Array.isArray(signals.images) ? signals.images.filter(x => typeof x === 'string' && x.trim()).length : 0;
  return {
    score: null,
    label: photos > 0 ? `${photos} listing photos` : 'Listing details pending',
    microcopy: STAY_SCORE_MICROCOPY,
  };
}
