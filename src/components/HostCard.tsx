import { useEffect, useState } from 'react';
import { CheckCircle, MapPin, Shield, Flag } from 'lucide-react';
import { fetchPublicHost } from '../lib/hostPublicCache';
import { theme } from '../lib/theme';
import { guestHostDisplayName, safeHostInitial, stripPhoneLike } from '../lib/host';
import { TRUST_BADGE_COPY } from '../lib/trustBadgeCopy';
import { scrollToId } from '../lib/smoothScroll';
import { inquiryCtaLabel } from '../lib/inquiryCopy';
import ReportPropertySheet from './property/ReportPropertySheet';

interface HostInfo {
  id: string;
  name: string;
  city?: string | null;
  bio?: string | null;
  kyc_status?: string | null;
  total_bookings?: number | null;
  created_at?: string | null;
}

interface HostCardProps {
  hostId: string | null;
  /** City of the property; used as a fallback when host has no city of its own. */
  fallbackCity?: string;
  className?: string;
  propertyId?: string;
  propertyTitle?: string;
  /** Opens the booking inquiry flow (quality review before host contact). */
  onRequestToBook?: () => void;
}

/**
 * HostCard renders a trustworthy snapshot of the property host using real
 * data from the `hosts` table. Before quality review: no host phone — optional
 * concierge line is labeled clearly. Primary inquiry CTA lives in the sidebar.
 */
export default function HostCard({
  hostId,
  fallbackCity,
  className = '',
  propertyId,
  propertyTitle = 'this property',
  onRequestToBook,
}: HostCardProps) {
  const [host, setHost] = useState<HostInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!hostId) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const row = await fetchPublicHost(hostId);
        if (cancelled) return;
        if (!row) {
          setHost(null);
        } else {
          setHost(row as HostInfo);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hostId]);

  const handleViewBooking = () => {
    if (onRequestToBook) {
      onRequestToBook();
      return;
    }
    scrollToId('booking-sidebar', { offset: -80, duration: 1.05 });
  };

  if (loading) {
    return (
      <div
        className={`rounded-2xl p-6 ${className}`}
        style={{ background: 'var(--xpx-surface-light)', border: '1px solid var(--xpx-border)' }}
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full animate-pulse" style={{ background: 'rgba(15,23,42,0.06)' }} />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 rounded animate-pulse" style={{ background: 'rgba(15,23,42,0.06)' }} />
            <div className="h-3 w-1/4 rounded animate-pulse" style={{ background: 'rgba(15,23,42,0.06)' }} />
          </div>
        </div>
      </div>
    );
  }

  if (!host) {
    return (
      <div
        className={`rounded-2xl p-6 text-sm ${className}`}
        style={{
          background: 'var(--xpx-accent-a12)',
          border: '1px solid var(--xpx-accent-a28)',
          color: theme.accentDark,
        }}
      >
        Host details are not available for this listing yet.
      </div>
    );
  }

  const isVerified = host.kyc_status === 'verified';
  const safeName = guestHostDisplayName(host.name, host.city ?? fallbackCity);
  const initial = safeHostInitial(host.name, safeName.charAt(0).toUpperCase() || 'H');
  const safeBio = host.bio ? stripPhoneLike(host.bio) : '';
  const memberSince = host.created_at ? new Date(host.created_at) : null;
  const memberSinceLabel = memberSince
    ? memberSince.toLocaleString('en-IN', { month: 'short', year: 'numeric' })
    : null;
  const bookingCount = host.total_bookings && host.total_bookings > 0 ? host.total_bookings : null;

  return (
    <section
      className={`rounded-2xl p-5 sm:p-6 ${className}`}
      style={{ background: 'var(--xpx-surface-light)', border: '1px solid var(--xpx-border)' }}
      aria-label="Hosted by"
    >
      <div className="flex items-start gap-4">
        <div className="relative">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold shadow-sm"
            style={{ background: theme.accent, color: '#ffffff' }}
          >
            {initial}
          </div>
          {isVerified && (
            <span
              title={TRUST_BADGE_COPY.hostKyc.title}
              className="absolute -bottom-1 -right-1 inline-flex items-center justify-center w-6 h-6 rounded-full text-white"
              style={{ background: theme.accent, border: `2px solid ${theme.surfaceLight}` }}
            >
              <CheckCircle className="w-3.5 h-3.5" fill="currentColor" />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="xpx-eyebrow">Hosted by</p>
            {isVerified && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                style={{
                  background: 'var(--xpx-accent-a12)',
                  color: theme.accentDark,
                  border: '1px solid var(--xpx-accent-a28)',
                }}
                title={TRUST_BADGE_COPY.hostKyc.title}
              >
                <Shield className="w-3 h-3" />
                {TRUST_BADGE_COPY.hostKyc.short}
              </span>
            )}
          </div>
          <h3 className="mt-0.5 text-lg sm:text-xl font-extrabold text-xpx-text truncate">
            {safeName}
          </h3>
          <div className="mt-1 flex items-center gap-3 text-sm text-xpx-muted flex-wrap">
            {(fallbackCity || host.city) && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-4 h-4 text-xpx-subtle" />
                {host.city ?? fallbackCity}
              </span>
            )}
            {bookingCount ? (
              <span className="text-xpx-subtle tabular-nums">{bookingCount} bookings</span>
            ) : null}
            {memberSinceLabel && (
              <span className="text-xpx-subtle">Member since {memberSinceLabel}</span>
            )}
          </div>
        </div>
      </div>

      {safeBio && (
        <p className="mt-4 text-sm text-xpx-muted leading-relaxed line-clamp-3">{safeBio}</p>
      )}

      <div className="mt-5 space-y-2.5">
        <button
          type="button"
          onClick={handleViewBooking}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm text-white transition-colors"
          style={{
            background: 'var(--xpx-cta)',
            boxShadow: 'var(--xpx-cta-glow)',
            minHeight: 48,
          }}
        >
          {inquiryCtaLabel('host_card')}
        </button>
        {propertyId && (
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-colors hover:bg-red-50"
            style={{
              background: 'var(--xpx-surface)',
              border: '1px solid #DC2626',
              color: '#DC2626',
              minHeight: 48,
            }}
          >
            <Flag className="w-4 h-4" aria-hidden="true" />
            Report this property
          </button>
        )}
        <p className="text-[11px] text-xpx-muted text-center leading-snug pt-0.5">
          Book first — we&apos;ll connect you with the host after your request goes through.
        </p>
      </div>
      {propertyId && (
        <ReportPropertySheet
          open={reportOpen}
          propertyId={propertyId}
          propertyTitle={propertyTitle}
          onClose={() => setReportOpen(false)}
        />
      )}
    </section>
  );
}
