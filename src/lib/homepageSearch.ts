import { addDaysIso, buildTripQuery, type TripParams } from './tripSearch';

export function localToday(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function isHomepageDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Keep optional dates flexible, while preventing impossible trip URLs. */
export function buildHomepageSearchPath(city: string, trip: TripParams, today: string): string {
  let checkin = isHomepageDate(trip.checkin) ? trip.checkin : '';
  let checkout = isHomepageDate(trip.checkout) ? trip.checkout : '';
  if (checkin && checkin < today) checkin = today;
  if (!checkin && checkout) checkin = today;
  if (checkin && (!checkout || checkout <= checkin)) checkout = addDaysIso(checkin, 1);
  const guests = Number.isFinite(trip.guests) ? Math.min(16, Math.max(1, Math.floor(trip.guests))) : 2;
  return `/stays/${city.toLowerCase().trim().replace(/\s+/g, '-')}${buildTripQuery({ checkin, checkout, guests })}`;
}
