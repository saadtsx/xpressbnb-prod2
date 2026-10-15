/**
 * Client-side estimate for guest-facing stay pricing on XpressBnB.
 *
 * Inquiry-first marketplace: no platform / service / convenience fees.
 * Mandatory charges only when backed by product data (property offer, guest-selected add-ons).
 */

import type { Property } from './database.types';
import { applyDiscounts, type PromoCodeDef } from './offers';

export const GUEST_PRICING_CURRENCY = 'INR' as const;

/** Optional decoration add-on — explicit guest opt-in on booking form only. */
export const DECORATION_ADDON_INR = 2000;

export type GuestPricingLineKind = 'accommodation' | 'discount' | 'addon';

export type GuestPricingLine = {
  id: string;
  label: string;
  amount: number;
  kind: GuestPricingLineKind;
};

export type GuestPricingQuote = {
  currency: typeof GUEST_PRICING_CURRENCY;
  nights: number;
  numGuests: number;
  /** Sum of nightly rates from calendar (before discounts). */
  accommodationSubtotal: number;
  lines: GuestPricingLine[];
  /** Amount shown to guest and sent on inquiry — no hidden fees after this. */
  guestTotal: number;
  averageNightlyInr: number;
};

export type BuildGuestPricingQuoteInput = {
  property: Property;
  accommodationSubtotal: number;
  nights: number;
  numGuests?: number;
  promo?: PromoCodeDef | null;
  includeDecoration?: boolean;
};

function emptyQuote(numGuests = 1): GuestPricingQuote {
  return {
    currency: GUEST_PRICING_CURRENCY,
    nights: 0,
    numGuests,
    accommodationSubtotal: 0,
    lines: [],
    guestTotal: 0,
    averageNightlyInr: 0,
  };
}

export function formatInr(amount: number): string {
  return `₹${Math.max(0, amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

/** Amount sent to create_pending_booking — allows 0 after discounts when stay subtotal exists. */
export function getInquirySubmitAmount(quote: GuestPricingQuote): number {
  if (quote.guestTotal > 0) return quote.guestTotal;
  if (quote.accommodationSubtotal > 0) return quote.accommodationSubtotal;
  return 0;
}

/**
 * Indicative guest quote for discovery → inquiry → success → tracking.
 * Never adds platform, service, convenience, or guest commission fees.
 */
export function buildGuestPricingQuote(input: BuildGuestPricingQuoteInput): GuestPricingQuote {
  const {
    property,
    accommodationSubtotal,
    nights,
    numGuests = 1,
    promo = null,
    includeDecoration = false,
  } = input;

  if (nights <= 0 || accommodationSubtotal <= 0) {
    return emptyQuote(numGuests);
  }

  const discounts = applyDiscounts(accommodationSubtotal, property, promo);
  const decorationAmount = includeDecoration ? DECORATION_ADDON_INR : 0;

  const lines: GuestPricingLine[] = [
    {
      id: 'stay',
      label:
        nights === 1
          ? 'Stay (1 night)'
          : `Stay (${nights} nights)`,
      amount: accommodationSubtotal,
      kind: 'accommodation',
    },
  ];

  if (discounts.propertyDiscount > 0) {
    lines.push({
      id: 'property-offer',
      label: 'Property offer',
      amount: -discounts.propertyDiscount,
      kind: 'discount',
    });
  }

  if (discounts.promoDiscount > 0) {
    lines.push({
      id: 'promo',
      label: discounts.promoLabel ?? 'Promo',
      amount: -discounts.promoDiscount,
      kind: 'discount',
    });
  }

  if (decorationAmount > 0) {
    lines.push({
      id: 'decoration',
      label: 'Decoration',
      amount: decorationAmount,
      kind: 'addon',
    });
  }

  const guestTotal = Math.max(0, discounts.total + decorationAmount);
  const averageNightlyInr = nights > 0 ? Math.round(guestTotal / nights) : 0;

  return {
    currency: GUEST_PRICING_CURRENCY,
    nights,
    numGuests,
    accommodationSubtotal,
    lines,
    guestTotal,
    averageNightlyInr,
  };
}
