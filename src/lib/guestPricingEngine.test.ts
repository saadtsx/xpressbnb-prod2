import { describe, expect, it } from 'vitest';
import {
  buildGuestPricingQuote,
  DECORATION_ADDON_INR,
  formatInr,
  getInquirySubmitAmount,
} from './guestPricingEngine';
import type { Property } from './database.types';

const baseProperty = {
  id: 'p1',
  title: 'Test Stay',
  price_per_day: 2400,
} as Property;

describe('buildGuestPricingQuote', () => {
  it('returns accommodation subtotal as guest total with no fake fees', () => {
    const quote = buildGuestPricingQuote({
      property: baseProperty,
      accommodationSubtotal: 4800,
      nights: 2,
    });
    expect(quote.guestTotal).toBe(4800);
    expect(quote.lines).toHaveLength(1);
    expect(quote.lines[0]?.amount).toBe(4800);
  });

  it('applies property offer discount before total', () => {
    const quote = buildGuestPricingQuote({
      property: { ...baseProperty, discount_percent: 10 } as Property,
      accommodationSubtotal: 4800,
      nights: 2,
    });
    expect(quote.guestTotal).toBe(4320);
    expect(quote.lines.some((l) => l.id === 'property-offer')).toBe(true);
  });

  it('includes decoration only when opted in', () => {
    const without = buildGuestPricingQuote({
      property: baseProperty,
      accommodationSubtotal: 3000,
      nights: 1,
      includeDecoration: false,
    });
    const withDeco = buildGuestPricingQuote({
      property: baseProperty,
      accommodationSubtotal: 3000,
      nights: 1,
      includeDecoration: true,
    });
    expect(without.guestTotal).toBe(3000);
    expect(withDeco.guestTotal).toBe(3000 + DECORATION_ADDON_INR);
  });

  it('returns zero quote for invalid nights', () => {
    const quote = buildGuestPricingQuote({
      property: baseProperty,
      accommodationSubtotal: 4800,
      nights: 0,
    });
    expect(quote.guestTotal).toBe(0);
  });

  it('preserves paise in server amounts', () => { expect(formatInr(1234.56)).toBe('₹1,234.56'); });

  it('formatInr uses Indian grouping', () => {
    expect(formatInr(5120)).toBe('₹5,120');
  });

  it('getInquirySubmitAmount falls back to accommodation subtotal when guest total is zero', () => {
    const quote = buildGuestPricingQuote({
      property: baseProperty,
      accommodationSubtotal: 4800,
      nights: 2,
    });
    expect(getInquirySubmitAmount({ ...quote, guestTotal: 0 })).toBe(4800);
  });
});

