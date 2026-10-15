import type { Property } from './database.types';

/** Optional offer columns — not yet on every generated Property row type. */
type PropertyWithOffer = Property & {
  discount_percent?: number | null;
  offer_label?: string | null;
};

/**
 * Offers / promotional pricing utilities.
 *
 * Strategy:
 *  - Property-level discount (`discount_percent` / `offer_label`) when the
 *    column exists on the row.
 *  - Optional promo codes stored locally (no DB table required yet) so the
 *    feature ships incrementally without a migration. Adding a `promo_codes`
 *    table later is a clean upgrade path.
 *  - All math is integer-rounded to the nearest rupee to keep totals clean.
 */

export interface PromoCodeDef {
  code: string;
  /** Whole-number percent off, e.g. 12 = 12% off. */
  percent?: number;
  /** Flat rupee discount; takes precedence over percent if both set. */
  flat?: number;
  /** Human label rendered to the user once applied. */
  label: string;
  /** Minimum subtotal in rupees required before applying. */
  minSubtotal?: number;
}

// No live promo entitlement service exists. Publish codes only after server validation.
const STATIC_PROMO_CODES: PromoCodeDef[] = [];

export function findPromoCode(input: string): PromoCodeDef | null {
  const code = input.trim().toUpperCase();
  if (!code) return null;
  return STATIC_PROMO_CODES.find((p) => p.code === code) ?? null;
}

export function listFeaturedPromoCodes(): PromoCodeDef[] {
  return STATIC_PROMO_CODES;
}

export interface OfferComputation {
  finalPrice: number;
  discountAmount: number;
  discountPercent: number;
  label: string | null;
}

/**
 * Compute the property-level offer (DB-driven) on a given base price.
 * Returns zeros if the property has no offer columns or invalid data.
 */
export function computeOffer(property: PropertyWithOffer, basePrice: number): OfferComputation {
  const percent = Number(property.discount_percent ?? 0);
  if (!Number.isFinite(percent) || percent <= 0 || percent > 90 || basePrice <= 0) {
    return { finalPrice: basePrice, discountAmount: 0, discountPercent: 0, label: null };
  }
  const discountAmount = Math.round((basePrice * percent) / 100);
  return {
    finalPrice: Math.max(0, basePrice - discountAmount),
    discountAmount,
    discountPercent: Math.round(percent),
    label: property.offer_label ?? `${Math.round(percent)}% off`,
  };
}

export function formatOfferLabel(offer: OfferComputation): string {
  if (!offer.label && offer.discountAmount === 0) return '';
  return offer.label
    ? `${offer.label} · save ₹${offer.discountAmount.toLocaleString()}`
    : `Save ₹${offer.discountAmount.toLocaleString()}`;
}

/**
 * Apply a property offer + optional promo code to a subtotal (e.g. nights × price).
 * Order of operations:
 *  1. Property offer percentage on subtotal
 *  2. Promo code on the resulting amount
 */
export interface AppliedDiscount {
  subtotal: number;
  propertyDiscount: number;
  promoDiscount: number;
  promoCodeApplied: string | null;
  promoLabel: string | null;
  total: number;
}

/**
 * Inbound offer parsing — reads the structured `[OFFER ...]` envelope we
 * encode in `bookings.special_requests` when a guest uses Make-an-Offer.
 *
 * Encoding format (must stay aligned with OfferModal.handleSubmit):
 *   [OFFER ₹{perNight}/night × {nights} nights = ₹{total}] Message: {note}
 *
 * Anything before the bracket is treated as a host counter (we prepend
 * `[COUNTER ₹{x}]` when a host proposes a different price).
 */
export interface ParsedOffer {
  perNight: number;
  nights: number;
  total: number;
  guestNote: string;
  hostCounter: number | null;
}

const OFFER_RE = /\[OFFER\s*₹\s*(\d[\d,]*)\s*\/?\s*night\s*[×x*]\s*(\d+)\s*nights?\s*=\s*₹\s*(\d[\d,]*)\]/i;
const COUNTER_RE = /\[COUNTER\s*₹\s*(\d[\d,]*)\]/i;

export function parseOfferFromSpecialRequests(raw: string | null | undefined): ParsedOffer | null {
  if (!raw) return null;
  const m = raw.match(OFFER_RE);
  if (!m) return null;
  const perNight = Number(m[1].replace(/,/g, ''));
  const nights = Number(m[2]);
  const total = Number(m[3].replace(/,/g, ''));
  if (!Number.isFinite(perNight) || !Number.isFinite(nights) || !Number.isFinite(total)) {
    return null;
  }
  const counterMatch = raw.match(COUNTER_RE);
  const hostCounter = counterMatch ? Number(counterMatch[1].replace(/,/g, '')) : null;
  // Strip the offer envelope + optional `Message:` label so we keep only the
  // human note the guest wrote.
  const guestNote = raw
    .replace(OFFER_RE, '')
    .replace(COUNTER_RE, '')
    .replace(/^\s*Message\s*:\s*/i, '')
    .trim();
  return { perNight, nights, total, guestNote, hostCounter };
}

/**
 * Build the encoded special_requests string after a host counters an offer.
 * Keeps the original [OFFER ...] envelope intact (so the audit trail is
 * preserved) and adds/replaces a [COUNTER ₹X] tag.
 */
export function buildCounterOfferRequest(
  originalRaw: string,
  newPerNight: number,
  hostMessage: string,
): string {
  const withoutCounter = originalRaw.replace(COUNTER_RE, '').trim();
  const counterTag = `[COUNTER ₹${newPerNight}]`;
  const note = hostMessage.trim() ? ` Host: ${hostMessage.trim()}` : '';
  return `${withoutCounter} ${counterTag}${note}`.trim();
}

export function applyDiscounts(
  subtotal: number,
  property: Property,
  promo: PromoCodeDef | null,
): AppliedDiscount {
  const propertyOffer = computeOffer(property, subtotal);
  const afterProperty = subtotal - propertyOffer.discountAmount;

  let promoDiscount = 0;
  let promoLabel: string | null = null;
  let promoCodeApplied: string | null = null;
  if (promo && (!promo.minSubtotal || afterProperty >= promo.minSubtotal)) {
    if (promo.flat) {
      promoDiscount = Math.min(afterProperty, promo.flat);
    } else if (promo.percent) {
      promoDiscount = Math.round((afterProperty * promo.percent) / 100);
    }
    if (promoDiscount > 0) {
      promoCodeApplied = promo.code;
      promoLabel = promo.label;
    }
  }

  return {
    subtotal,
    propertyDiscount: propertyOffer.discountAmount,
    promoDiscount,
    promoCodeApplied,
    promoLabel,
    total: Math.max(0, afterProperty - promoDiscount),
  };
}
