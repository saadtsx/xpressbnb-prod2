/** Inquiry WhatsApp copy (English + short Hindi). */

export type InquiryMessageContext = {
  propertyTitle: string;
  dateRange: string;
  guestName: string;
  guestPhone: string;
  hostName: string;
  hostPhone: string;
  dashboardLink: string;
  customerReference?: string | null;
};

export type Locale = 'en' | 'hi';

function pickLocale(preferred?: string | null): Locale {
  if (preferred === 'hi') return 'hi';
  return 'en';
}

export function guestInquirySentMessage(ctx: InquiryMessageContext, locale?: string | null): string {
  const ref = ctx.customerReference ? ` Ref: ${ctx.customerReference}.` : '';
  const loc = pickLocale(locale);
  if (loc === 'hi') {
    return `Aapki inquiry "${ctx.propertyTitle}" (${ctx.dateRange}) quality review ke baad host ${ctx.hostName} ko bhej di gayi.${ref} Host: ${ctx.hostPhone}`;
  }
  return `Your inquiry for ${ctx.propertyTitle} ${ctx.dateRange} was quality reviewed and shared with ${ctx.hostName}.${ref} Host phone: ${ctx.hostPhone}`;
}

export function hostNewInquiryMessage(ctx: InquiryMessageContext, locale?: string | null): string {
  const ref = ctx.customerReference ? ` Ref ${ctx.customerReference}.` : '';
  const loc = pickLocale(locale);
  if (loc === 'hi') {
    return `Quality reviewed inquiry: ${ctx.guestName} ${ctx.guestPhone}, ${ctx.propertyTitle} ${ctx.dateRange}.${ref} Ready to contact. Dashboard: ${ctx.dashboardLink}`;
  }
  return `Quality reviewed inquiry from ${ctx.guestName} ${ctx.guestPhone} for ${ctx.propertyTitle} ${ctx.dateRange}.${ref} Ready to contact. Open dashboard: ${ctx.dashboardLink}`;
}

export function guestInquiryAcceptedMessage(ctx: InquiryMessageContext, locale?: string | null): string {
  const loc = pickLocale(locale);
  if (loc === 'hi') {
    return `Host ne aapki inquiry "${ctx.propertyTitle}" (${ctx.dateRange}) accept kar li. Booking abhi confirm nahi hai. Payment se pehle poori keemat aur shartein host se tay karein.`;
  }
  return `Your inquiry for ${ctx.propertyTitle} ${ctx.dateRange} was accepted by ${ctx.hostName}. This is not a booking confirmation. Agree the full price, policies and payment terms with the host before paying.`;
}

export function guestInquiryRejectedMessage(ctx: InquiryMessageContext, locale?: string | null): string {
  const loc = pickLocale(locale);
  if (loc === 'hi') {
    return `Host ne aapki inquiry "${ctx.propertyTitle}" (${ctx.dateRange}) decline kar di.`;
  }
  return `Your inquiry for ${ctx.propertyTitle} ${ctx.dateRange} was declined by the host.`;
}

export function formatDateRange(checkIn: string, checkOut: string): string {
  try {
    const inD = new Date(checkIn);
    const outD = new Date(checkOut);
    const fmt = (d: Date) =>
      d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${fmt(inD)} – ${fmt(outD)}`;
  } catch {
    return `${checkIn} – ${checkOut}`;
  }
}

export function normalizeIndiaE164(phone: string): string | null {
  const d = phone.replace(/\D/g, '').slice(-10);
  if (d.length !== 10) return null;
  return `91${d}`;
}
