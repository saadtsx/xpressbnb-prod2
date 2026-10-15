/** XpressBNB support/concierge contact. Label this line as support or concierge.
 * Actual host contact is supplied by the gated inquiry tracking response.
 */

// E.164 format, digits only with leading +. Used for tel: and wa.me deep links.
export const TEAM_PHONE_E164 = '+917078605755';

// Human-friendly support contact.
export const TEAM_PHONE_DISPLAY = '+91 70786 05755';

// Where automated emails should land (booking confirmations, offer alerts).
export const TEAM_EMAIL = 'support@xpressbnb.com';

// Use this label whenever a link routes to the concierge line.
export const TEAM_BRAND_NAME = 'XpressBnB Concierge';
export const TEAM_HOURS = '9 AM to 11 PM IST';

/** Build a wa.me deep link to the team line with arbitrary prefilled copy (B2B, support, etc.). */
export function buildTeamWhatsAppLink(prefilledBody: string): string {
  const cleaned = TEAM_PHONE_E164.replace(/[^\d]/g, '');
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(prefilledBody)}`;
}

/** Build a wa.me deep link with a pre-filled, host-context message. */
export function buildHostWhatsAppLink(propertyTitle: string, hostFirstName?: string): string {
  const greet = hostFirstName ? `Hi ${hostFirstName}` : 'Hi';
  const message = `${greet}, I am interested in your property "${propertyTitle}" on XpressBnB. Is it available for the dates I have in mind?`;
  const cleaned = TEAM_PHONE_E164.replace(/[^\d]/g, '');
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
}

/** Build a tel: link for the team phone (rendered as host contact). */
export function buildHostCallLink(): string {
  return `tel:${TEAM_PHONE_E164}`;
}
