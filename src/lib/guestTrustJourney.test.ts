import { describe, expect, it } from 'vitest';
import { resolveGuestTrustStages } from './guestTrustJourney';

describe('guestTrustJourney', () => {
  it('never treats locally editable completion or loyalty history as verified stays', () => {
    const stages = resolveGuestTrustStages({ inquiries: [{ customerReference: 'XPX-OLD', submittedAt: 1, lastDisplayStatus: 'completed' }], frequentAmigo: { qualifyingCount: 20, threshold: 3, unlocked: true, windowDays: 15 } });
    for (const id of ['first_stay','verified_traveller','repeat_stays','preferred_guest']) expect(stages.find(s => s.id === id)?.reached).toBe(false);
  });
  it('marks visit as always reached', () => {
    const stages = resolveGuestTrustStages({
      inquiries: [],
      savedCount: 0,
      listingBrowseCount: 0,
      hasTrackedPage: false,
    });
    expect(stages.find((s) => s.id === 'visit')?.reached).toBe(true);
  });

  it('unlocks guest_id when inquiry exists', () => {
    const stages = resolveGuestTrustStages({
      inquiries: [{ customerReference: 'XPX-250627-00001', submittedAt: Date.now() }],
      listingBrowseCount: 1,
    });
    expect(stages.find((s) => s.id === 'guest_id')?.reached).toBe(true);
    expect(stages.find((s) => s.id === 'guest_id')?.current).toBe(true);
  });

  it('unlocks trusted_guest only with reviewed inquiry data', () => {
    const without = resolveGuestTrustStages({
      inquiries: [{ customerReference: 'XPX-250627-00002', submittedAt: Date.now() }],
    });
    expect(without.find((s) => s.id === 'trusted_guest')?.reached).toBe(false);

    const withReview = resolveGuestTrustStages({
      inquiries: [
        {
          customerReference: 'XPX-250627-00002',
          submittedAt: Date.now(),
          phoneVerified: true,
          reviewedAt: new Date().toISOString(),
        },
      ],
    });
    expect(withReview.find((s) => s.id === 'trusted_guest')?.reached).toBe(true);
  });

  it('does not unlock preferred_guest without backing stays or frequent amigo', () => {
    const stages = resolveGuestTrustStages({
      inquiries: [{ customerReference: 'XPX-250627-00003', submittedAt: Date.now() }],
      frequentAmigo: { qualifyingCount: 1, threshold: 3, unlocked: false, windowDays: 15 },
    });
    expect(stages.find((s) => s.id === 'preferred_guest')?.reached).toBe(false);
  });
});
