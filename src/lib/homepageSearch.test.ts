import { describe, expect, it } from 'vitest';
import { buildHomepageSearchPath } from './homepageSearch';

const today = '2026-09-30';
describe('homepage search trip routing', () => {
  it('allows flexible dates and preserves the full guest count', () => {
    expect(buildHomepageSearchPath('Greater Noida', { checkin: '', checkout: '', guests: 16 }, today)).toBe('/stays/greater-noida?guests=16');
  });
  it('preserves valid user-selected dates', () => {
    expect(buildHomepageSearchPath('Gurgaon', { checkin: '2026-10-12', checkout: '2026-10-16', guests: 4 }, today)).toBe('/stays/gurgaon?checkin=2026-10-12&checkout=2026-10-16&guests=4');
  });
  it('repairs stale dates at the end of a month', () => {
    expect(buildHomepageSearchPath('Delhi', { checkin: '2026-09-20', checkout: '2026-09-22', guests: 2 }, today)).toBe('/stays/delhi?checkin=2026-09-30&checkout=2026-10-01&guests=2');
  });
  it('supplies a valid checkin for a checkout-only search', () => {
    expect(buildHomepageSearchPath('Delhi', { checkin: '', checkout: '2026-10-05', guests: 2 }, today)).toBe('/stays/delhi?checkin=2026-09-30&checkout=2026-10-05&guests=2');
  });
  it('does not propagate impossible URL dates or invalid guest counts', () => {
    expect(buildHomepageSearchPath('Delhi', { checkin: '2026-02-30', checkout: 'invalid', guests: NaN }, today)).toBe('/stays/delhi?guests=2');
  });
  it('repairs a reversed date range across the year boundary', () => {
    expect(buildHomepageSearchPath('Rishikesh', { checkin: '2026-12-31', checkout: '2026-12-30', guests: 0 }, today)).toBe('/stays/rishikesh?checkin=2026-12-31&checkout=2027-01-01&guests=1');
  });
});
