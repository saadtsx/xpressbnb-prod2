/**
 * Guest-facing CTA copy — direct, short, property-page first.
 */

export type InquiryCtaContext =
  | 'property_no_dates'
  | 'property_with_dates'
  | 'host_card'
  | 'host_concierge'
  | 'form_submit'
  | 'offer_submit'
  | 'modal_entry'
  | 'artist_whatsapp';

/** Opening spread CTA — editorial arrival, not marketplace transaction. */
export function openingArrivalCtaLabel(hasDates: boolean): string {
  return hasDates ? 'Continue to inquiry' : 'Begin your stay';
}

export function inquiryCtaLabel(context: InquiryCtaContext): string {
  switch (context) {
    case 'property_no_dates':
      return 'Check availability';
    case 'property_with_dates':
      return 'Send inquiry';
    case 'host_card':
      return 'Send inquiry';
    case 'host_concierge':
      return 'Text us on WhatsApp';
    case 'form_submit':
      return 'Send inquiry';
    case 'offer_submit':
      return 'Send your offer';
    case 'modal_entry':
      return 'Send inquiry';
    case 'artist_whatsapp':
      return 'Request via WhatsApp';
    default:
      return 'Send inquiry';
  }
}

export const INQUIRY_SENDING_LABEL = 'Sending your inquiry…';

export const INQUIRY_HOST_TAGLINE =
  'We bring genuine travel inquiries directly to hosts.';

export const INQUIRY_GUEST_TAGLINE =
  'Inquire when you are ready. Hear directly from the host. Zero guest commission.';
