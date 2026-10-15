import { describe, expect, it } from 'vitest';
import { inquiryDecisionLabel, notificationStatusLabel, parseInquiryTerms } from './inquiryJourney';
import { parseExternalListingProof } from './externalListingProof';

describe('honest inquiry state', () => {
  it('distinguishes acceptance, rejection, counteroffer and unverified legacy completion', () => {
    expect(inquiryDecisionLabel('accepted')).toContain('not confirmed');
    expect(inquiryDecisionLabel('rejected')).toContain('declined');
    expect(inquiryDecisionLabel('countered')).toContain('agreement needed');
    expect(inquiryDecisionLabel('legacy_unverified')).toContain('not verified');
    expect(inquiryDecisionLabel('new_unknown')).toContain('unavailable');
  });
  it('never treats queued, API-accepted, failed or simulated messages as delivered', () => {
    expect(notificationStatusLabel('pending')).toContain('queued');
    expect(notificationStatusLabel('sent')).toContain('delivery unconfirmed');
    expect(notificationStatusLabel('dev_logged')).toContain('no message sent');
    expect(notificationStatusLabel('failed')).toContain('failed');
  });
  it('keeps missing monetary fields unknown and preserves real zeroes', () => {
    expect(parseInquiryTerms(null)).toBeNull();
    expect(parseInquiryTerms({ nightly_subtotal: -1, estimate: Infinity, total_payable: 0 })).toEqual({});
    expect(parseInquiryTerms({ nightly_subtotal: 0, estimate: 100, previous_estimate: 120 })).toEqual({ nightly_subtotal: 0, estimate: 100, previous_estimate: 120 });
  });
  it('does not trust host-editable comparison verification flags or unsafe links', () => {
    const listings = parseExternalListingProof([{ platform: 'Other', url: 'https://example.test/stay', price: 1000, verified: true }]);
    expect(listings[0].opsVerified).toBe(false);
    expect(parseExternalListingProof([{ url: 'javascript:alert(1)', price: 1000 }])).toEqual([]);
  });
});
