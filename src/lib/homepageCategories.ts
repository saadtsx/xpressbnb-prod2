import type { Property } from './database.types';

export type HomepageCategory = 'all' | 'apartment' | 'villa' | 'cottage' | 'work' | 'mountain';

/** Use explicit listing metadata, never infer amenities from marketing descriptions. */
export function matchesHomepageCategory(property: Property, category: HomepageCategory): boolean {
  if (category === 'all') return true;
  const type = (property.property_type || '').trim().toLowerCase();
  if (category === 'apartment') return ['apartment', 'studio', 'serviced apartment'].includes(type);
  if (category === 'villa') return type === 'villa';
  if (category === 'cottage') return type === 'cottage';
  if (category === 'work') {
    const amenities = Array.isArray(property.amenities) ? property.amenities.filter((item): item is string => typeof item === 'string').map(item => item.trim().toLowerCase()) : [];
    return amenities.includes('dedicated workspace') && amenities.some(item => ['wifi', 'wi-fi'].includes(item));
  }
  return ['rishikesh', 'mussoorie', 'nainital', 'bhimtal', 'shimla', 'manali', 'dharamshala', 'mcleodganj', 'kasol', 'kasauli'].includes((property.city || '').trim().toLowerCase());
}
