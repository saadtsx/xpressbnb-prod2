/** Safe presentation of the inquiry contract; none of these states prove settlement. */
export type InquiryTerms = {
  version?: number;
  property_title?: string;
  check_in?: string;
  check_out?: string;
  num_guests?: number;
  nightly_subtotal?: number | null;
  optional_decoration?: number | null;
  estimate?: number | null;
  previous_estimate?: number | null;
  price_source?: string;
  accepts_local_ids?: boolean | null;
  guest_consent?: string;
};

export function inquiryDecisionLabel(status: string): string {
  const labels: Record<string, string> = {
    preparing: 'Inquiry received — awaiting review',
    sent_to_host: 'Awaiting host response',
    viewed_by_host: 'Host reviewing',
    accepted: 'Host accepted — booking not confirmed',
    rejected: 'Host declined',
    review_declined: 'Inquiry closed during operations review',
    countered: 'Host counteroffer — your agreement needed',
    counter_accepted: 'You accepted the counteroffer — booking not confirmed',
    counter_declined: 'You declined the counteroffer — inquiry closed',
    cancelled: 'Inquiry cancelled',
    legacy_unverified: 'Legacy status — confirmation not verified',
    host_responded: 'Host responded — check latest status',
    completed: 'Legacy stay record — completion not verified',
  };
  return labels[status] ?? 'Status unavailable — refresh to check';
}

export function notificationStatusLabel(status?: string): string {
  const labels: Record<string, string> = {
    pending: 'WhatsApp update queued',
    processing: 'WhatsApp update processing; delivery unconfirmed',
    sent: 'WhatsApp update submitted to provider; delivery unconfirmed',
    failed: 'WhatsApp update failed; the status shown here remains current',
    dev_logged: 'WhatsApp test mode; no message sent',
    not_queued: 'No WhatsApp update queued',
  };
  return labels[status ?? 'not_queued'] ?? 'WhatsApp delivery unconfirmed';
}

export function parseInquiryTerms(value: unknown): InquiryTerms | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  const terms: InquiryTerms = {};
  for (const key of ['version', 'num_guests', 'nightly_subtotal', 'optional_decoration', 'estimate', 'previous_estimate'] as const) {
    const n = obj[key];
    if (typeof n === 'number' && Number.isFinite(n) && n >= 0) terms[key] = n;
  }
  for (const key of ['property_title', 'check_in', 'check_out', 'price_source', 'guest_consent'] as const) {
    if (typeof obj[key] === 'string') terms[key] = obj[key];
  }
  if (typeof obj.accepts_local_ids === 'boolean') terms.accepts_local_ids = obj.accepts_local_ids;
  return terms;
}

export type CounterofferProposal = {
  perNight: number;
  nights: number;
  estimate: number;
  previousEstimate: number | null;
  version: number;
};

/** Exact proposal the guest is agreeing to; null when any part is missing (never guessed). */
export function counterofferProposal(
  terms: InquiryTerms | null,
  counterAmount: number | null,
  responseVersion: number,
): CounterofferProposal | null {
  if (!terms?.check_in || !terms.check_out || counterAmount == null || !(counterAmount > 0)) return null;
  const nights = Math.round((Date.parse(terms.check_out) - Date.parse(terms.check_in)) / 86400000);
  if (!Number.isFinite(nights) || nights < 1) return null;
  return {
    perNight: counterAmount,
    nights,
    estimate: Math.round(counterAmount * nights * 100) / 100,
    previousEstimate: terms.previous_estimate ?? null,
    version: responseVersion,
  };
}
