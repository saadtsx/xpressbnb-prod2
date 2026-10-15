/**
 * Composite nearby ranking — distance + quality + popularity signals.
 * Client-side MVP; server weights via RPC in Phase 2 scale-up.
 */

import { normalizeCityBucket } from './cityBuckets';
import { haversineKm } from './nearbyInventory';
import { isMappableProperty } from './propertyCoords';
import type { PublicPropertyListing } from './publicListings';
import type { RankedProperty } from './nearbyInventory';

/** Tunable weights — sum to 1.0 for interpretability. */
export const NEARBY_RANK_WEIGHTS = {
  distance: 0.45,
  quality: 0.3,
  popularity: 0.15,
  availability: 0.1,
} as const;

export type NearbyRankSignals = RankedProperty & {
  rankScore: number;
  qualityScore: number;
  popularityScore: number;
  availabilityScore: number;
};

function normalizeDistanceScore(km: number, maxKm: number): number {
  if (km <= 0) return 1;
  if (km >= maxKm) return 0;
  return 1 - km / maxKm;
}

function qualityScoreFor(property: PublicPropertyListing): number {
  // Listing completeness is a discovery factor, not reputation or paid verification.
  const photos = Array.isArray(property.images) ? property.images.filter(x => typeof x === 'string' && x.trim()).length : 0;
  return Math.min(photos, 8) / 8;
}

/** Proxy popularity until view_events aggregation is wired. */
function popularityScoreFor(property: PublicPropertyListing): number {
  let score = 0.4;
  if (property.is_premium) score += 0.25;
  if (property.is_verified) score += 0.15;
  if (property.is_couple_friendly) score += 0.08;
  if (property.hourly_stay_available) score += 0.07;
  if (property.images && Array.isArray(property.images) && property.images.length >= 5) {
    score += 0.05;
  }
  return Math.min(1, score);
}

function availabilityScoreFor(property: PublicPropertyListing): number {
  if (property.instant_booking) return 1;
  if (property.is_active) return 0.75;
  return 0.3;
}

export function computeNearbyRankScore(
  property: PublicPropertyListing,
  distanceKm: number,
  maxKm: number,
): number {
  const w = NEARBY_RANK_WEIGHTS;
  return (
    w.distance * normalizeDistanceScore(distanceKm, maxKm) +
    w.quality * qualityScoreFor(property) +
    w.popularity * popularityScoreFor(property) +
    w.availability * availabilityScoreFor(property)
  );
}

export function rankPropertiesForNearby(
  originLat: number,
  originLng: number,
  properties: PublicPropertyListing[],
  options?: {
    limit?: number;
    maxKm?: number;
    excludeId?: string;
    cityBucket?: string | null;
  },
): NearbyRankSignals[] {
  const limit = options?.limit ?? 12;
  const maxKm = options?.maxKm ?? 80;
  const excludeId = options?.excludeId;

  const ranked: NearbyRankSignals[] = [];

  for (const property of properties) {
    if (excludeId && property.id === excludeId) continue;
    if (!isMappableProperty(property)) continue;

    const distanceKm = haversineKm(originLat, originLng, property.latitude, property.longitude);
    if (distanceKm > maxKm) continue;

    if (options?.cityBucket) {
      if (normalizeCityBucket(property.city) !== options.cityBucket) continue;
    }

    ranked.push({
      ...property,
      distanceKm,
      rankScore: computeNearbyRankScore(property, distanceKm, maxKm),
      qualityScore: qualityScoreFor(property),
      popularityScore: popularityScoreFor(property),
      availabilityScore: availabilityScoreFor(property),
    });
  }

  return ranked
    .sort((a, b) => {
      if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore;
      if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
      return 0;
    })
    .slice(0, limit);
}
