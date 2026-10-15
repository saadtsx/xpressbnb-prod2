import { describe, expect, it } from 'vitest';
import type { Property } from './database.types';
import { selectExplorerProperties } from './locationExplorer';

const listing = (id: string, overrides: Partial<Property> = {}) => ({ id, title: id, city: 'Gurugram', state: 'Haryana', max_guests: 4, price_per_day: 2000, price_full_day: null, latitude: 28.46, longitude: 77.03, images: [], amenities: [], ...overrides } as Property);

describe('location explorer inventory', () => {
  it('matches city aliases and sorts all eligible inventory before pagination without mutation', () => {
    const data = [listing('low'), listing('high', { price_per_day: 9000 }), listing('wrong-city', { city: 'Delhi', price_per_day: 20000 }), listing('too-small', { max_guests: 1, price_per_day: 15000 })];
    const result = selectExplorerProperties(data, { city: 'Gurgaon', guests: 2, sort: 'price-high' });
    expect(result.properties.map(p => p.id)).toEqual(['high', 'low']);
    expect(data[0].id).toBe('low');
  });
  it('uses full-day price fallback and places unknown prices last in both directions', () => {
    const data = [listing('unknown', { price_per_day: 0 }), listing('fallback', { price_per_day: 0, price_full_day: 5000 }), listing('regular')];
    expect(selectExplorerProperties(data, { city: 'Gurgaon', guests: 2, sort: 'price-high' }).properties.map(p => p.id)).toEqual(['fallback', 'regular', 'unknown']);
    expect(selectExplorerProperties(data, { city: 'Gurgaon', guests: 2, sort: 'price-low' }).properties.map(p => p.id)).toEqual(['regular', 'fallback', 'unknown']);
  });
  it('keeps distant and unmappable stays out of nearby results while applying price order', () => {
    const data = [listing('near'), listing('premium', { price_per_day: 12000, latitude: 28.49 }), listing('far', { latitude: 30.1, longitude: 78.3 }), listing('missing-coords', { latitude: null, longitude: null })];
    const result = selectExplorerProperties(data, { coords: { lat: 28.46, lng: 77.03 }, guests: 2, sort: 'price-high' });
    expect(result.properties.map(p => p.id)).toEqual(['premium', 'near']);
    expect(result.distances.near).toBe(0);
  });
  it('does not silently turn an unknown city into every property', () => {
    expect(selectExplorerProperties([listing('a')], { city: 'Unknown', guests: 2, sort: 'price-high' }).properties).toEqual([]);
  });
});
