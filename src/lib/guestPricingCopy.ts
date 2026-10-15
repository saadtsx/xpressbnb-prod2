/** Guest pricing microcopy — calm, factual, no OTA hype. */

export const GUEST_PRICING_NO_COMMISSION = 'No guest commission.';

export const GUEST_PRICING_INQUIRY_TOTAL_NOTE =
  'Estimate only. Taxes, mandatory charges, deposit, advance and final terms still need host confirmation.';

export const GUEST_PRICING_HOST_DIRECT =
  'Hosts receive your request directly.';

export const GUEST_PRICING_TRANSPARENT =
  'Transparent pricing — no platform fees added at checkout.';

export const GUEST_PRICING_NIGHTLY_HINT =
  'Nightly rate — select dates to see your stay estimate.';

export const GUEST_PRICING_TRIP_HINT = (nights: number) =>
  `${nights} ${nights === 1 ? 'night' : 'nights'} · host-listed estimate`;

export function guestRequestSentCopy(totalInr: string): string {
  return `Your inquiry with an estimate of ${totalInr} was received for review.`;
}
