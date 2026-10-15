import { describe, expect, it } from 'vitest';
import { inquiryCtaLabel, openingArrivalCtaLabel } from './inquiryCopy';

describe('inquiryCopy', () => {
  it('uses inquiry labels per context', () => {
    expect(inquiryCtaLabel('property_no_dates')).toBe('Check availability');
    expect(inquiryCtaLabel('property_with_dates')).toBe('Send inquiry');
    expect(inquiryCtaLabel('host_card')).toBe('Send inquiry');
    expect(inquiryCtaLabel('host_concierge')).toBe('Text us on WhatsApp');
    expect(inquiryCtaLabel('form_submit')).toBe('Send inquiry');
  });

  it('uses editorial arrival labels for the opening spread', () => {
    expect(openingArrivalCtaLabel(false)).toBe('Begin your stay');
    expect(openingArrivalCtaLabel(true)).toBe('Continue to inquiry');
  });
});
