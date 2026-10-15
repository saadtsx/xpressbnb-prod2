/**
 * Ephemeral inquiry success payloads for /inquiry/success/:guestReference.
 * Written immediately after a successful submit — same session can reopen the page.
 */

import type { FrequentAmigoStatus } from './inquiryHostContact';

export const INQUIRY_SUCCESS_MAP_KEY = 'xpx_inquiry_success_v1';

export type InquirySuccessSnapshot = {
  v: 1;
  savedAt: number;
  variant: 'booking' | 'offer';
  bookingId: string;
  customerReference: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  propertyId: string;
  propertyTitle: string;
  propertyCity: string;
  propertySlug: string | null;
  hostId: string | null;
  hostContactName: string | null;
  hostContactPhone: string | null;
  checkIn: string;
  checkOut: string;
  numGuests: number;
  estimatedTotal: number;
  frequentAmigo?: FrequentAmigoStatus;
};

function readMap(): Record<string, InquirySuccessSnapshot> {
  try {
    const raw = sessionStorage.getItem(INQUIRY_SUCCESS_MAP_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, InquirySuccessSnapshot>;
    }
    return {};
  } catch {
    return {};
  }
}

export function saveInquirySuccessSnapshot(snapshot: InquirySuccessSnapshot): void {
  try {
    const map = readMap();
    const key = snapshot.customerReference.trim().toUpperCase();
    map[key] = { ...snapshot, savedAt: Date.now() };
    sessionStorage.setItem(INQUIRY_SUCCESS_MAP_KEY, JSON.stringify(map));
  } catch {
    // private mode / quota
  }
}

export function loadInquirySuccessSnapshot(
  customerReference: string,
): InquirySuccessSnapshot | null {
  const key = customerReference.trim().toUpperCase();
  const row = readMap()[key];
  if (!row || row.v !== 1 || row.customerReference.toUpperCase() !== key) return null;
  return row;
}

export function inquirySuccessPath(snapshot: InquirySuccessSnapshot): string {
  const ref = encodeURIComponent(snapshot.customerReference.trim().toUpperCase());
  return `/guest/welcome/${ref}`;
}
