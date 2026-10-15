import { describe, expect, it } from 'vitest';
import { computeXpressbnbStayScore } from './xpressbnbStayScore';
describe('listing trust facts', () => {
  it('does not manufacture a numerical reputation for missing or rich listings', () => {
    expect(computeXpressbnbStayScore({}).score).toBeNull();
    expect(computeXpressbnbStayScore({ is_verified: true, images: ['a', 'b'], city: 'Delhi' }).score).toBeNull();
  });
  it('paid membership and host-editable verification do not change trust facts', () => {
    const base = { images: ['a', 'b'] };
    expect(computeXpressbnbStayScore(base)).toEqual(computeXpressbnbStayScore({ ...base, is_premium: true, is_verified: true }));
  });
  it('labels only valid available photo records', () => {
    expect(computeXpressbnbStayScore({ images: ['', null, 'a'] }).label).toBe('1 listing photos');
    expect(computeXpressbnbStayScore({}).label).toBe('Listing details pending');
  });
});
