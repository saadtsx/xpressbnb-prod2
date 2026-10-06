/**
 * Guest property reports — one-tap flag from the property page.
 * Submission is a narrow RPC (report_property); reports never change listing visibility.
 */

import { logSupabaseError, supabase } from './supabase';
import { getDeviceFingerprint } from './deviceFingerprint';

export const REPORT_REASONS = [
  { id: 'inaccurate', label: "Photos or details don't match" },
  { id: 'not_available', label: 'Not actually available' },
  { id: 'scam', label: 'Looks like a scam' },
  { id: 'unsafe', label: 'Feels unsafe' },
  { id: 'inappropriate', label: 'Inappropriate content' },
  { id: 'other', label: 'Something else' },
] as const;

export type ReportReasonId = (typeof REPORT_REASONS)[number]['id'];

export const REPORT_DETAILS_MAX = 500;

export const REPORT_ERROR_MESSAGE = "Couldn't send your report. Please try again.";

export function isReportReason(value: string): value is ReportReasonId {
  return REPORT_REASONS.some((r) => r.id === value);
}

export function normalizeReportDetails(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed === '' ? null : trimmed.slice(0, REPORT_DETAILS_MAX);
}

export async function submitPropertyReport(input: {
  propertyId: string;
  reason: ReportReasonId;
  details: string;
}): Promise<{ ok: boolean; error: string | null }> {
  const fingerprint = await getDeviceFingerprint();
  const { error } = await supabase.rpc('report_property', {
    p_property_id: input.propertyId,
    p_reason: input.reason,
    p_details: normalizeReportDetails(input.details),
    p_device_fingerprint: fingerprint || null,
  });
  if (error) {
    logSupabaseError('submitPropertyReport', error);
    const msg = error.message?.toLowerCase().includes('too many')
      ? 'Too many reports from this device. Please try again later.'
      : REPORT_ERROR_MESSAGE;
    return { ok: false, error: msg };
  }
  return { ok: true, error: null };
}
