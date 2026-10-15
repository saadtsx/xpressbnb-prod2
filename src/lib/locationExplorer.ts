import type { Property } from './database.types';
import { normalizeCityBucket } from './cityBuckets';
import { rankPropertiesForNearby } from './nearbyRanking';

export type ExplorerSort = 'price-high' | 'price-low';
export type ExplorerRequest = { mode: 'city'; city: string } | { mode: 'nearby' };

export function selectExplorerProperties(properties: Property[], options: {
  city?: string; coords?: { lat: number; lng: number }; guests: number; sort: ExplorerSort;
}) {
  const eligible = properties.filter(property => (property.max_guests ?? 0) >= options.guests);
  let selected: Property[];
  const distances: Record<string, number> = {};
  if (options.coords) {
    const { lat, lng } = options.coords;
    const inCity = options.city ? rankPropertiesForNearby(lat, lng, eligible, { cityBucket: options.city, maxKm: 60, limit: eligible.length }) : [];
    const nearby = inCity.length ? inCity : rankPropertiesForNearby(lat, lng, eligible, { maxKm: 120, limit: eligible.length });
    selected = nearby;
    for (const property of nearby) distances[property.id] = property.distanceKm;
  } else {
    const bucket = normalizeCityBucket(options.city);
    selected = bucket ? eligible.filter(property => normalizeCityBucket(property.city) === bucket) : [];
  }
  const price = (property: Property) => property.price_per_day || property.price_full_day || 0;
  return { properties: [...selected].sort((a, b) => {
    const aPrice = price(a), bPrice = price(b);
    // Missing prices remain last for both directions.
    if (aPrice <= 0 || bPrice <= 0) return (aPrice <= 0 ? 1 : 0) - (bPrice <= 0 ? 1 : 0);
    return (options.sort === 'price-high' ? bPrice - aPrice : aPrice - bPrice) || a.id.localeCompare(b.id);
  }), distances };
}
