import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Database } from '../../lib/database.types';
import {
  BookOpen,
  Calendar,
  User,
  Mail,
  Phone,
  IndianRupee,
  CheckCircle,
  XCircle,
  Tag,
  ArrowRight,
  MessageSquare,
  RefreshCw,
} from 'lucide-react';
import {
  parseOfferFromSpecialRequests,
  type ParsedOffer,
} from '../../lib/offers';
import CounterOfferDialog from '../../components/CounterOfferDialog';
import RejectInquiryDialog from '../../components/RejectInquiryDialog';
import RealtimeToast, { type ToastPayload } from '../../components/RealtimeToast';
import {
  formatGuestPhoneDisplay,
  guestPhoneToE164,
  buildGuestDirectWhatsAppLink,
} from '../../lib/inquiryGuestContact';
import InquiryTermsSummary from '../../components/inquiry/InquiryTermsSummary';
import { parseInquiryTerms } from '../../lib/inquiryJourney';
import { theme } from '../../lib/theme';
import HostValueProp from '../../components/host/HostValueProp';
import InquiryTrustBadgePill from '../../components/inquiry/InquiryTrustBadgePill';
import InquiryHostTrustPanel from '../../components/inquiry/InquiryHostTrustPanel';
import {
  isInquiryContactReleased,
  primaryInquiryTrustBadge,
  QUALITY_REVIEW_HELPER,
  QUALITY_REVIEW_PENDING_HELPER,
} from '../../lib/inquiryTrust';

type BookingRow = Database['public']['Tables']['bookings']['Row'];
type BookingStatus = BookingRow['status'];

type Booking = BookingRow & {
  response_version: number;
  response_kind: string | null;
  counter_amount: number | null;
  inquiry_terms: unknown;
  contact_released?: boolean | null;
  quality_review_pending?: boolean | null;
  properties: {
    title: string;
    city: string;
    price_per_day: number | null;
    price_full_day: number | null;
  } | null;
};

type InquiryTab = 'new' | 'offers' | 'accepted' | 'rejected';

const TABS: { id: InquiryTab; label: string }[] = [
  { id: 'new', label: 'New inquiries' },
  { id: 'offers', label: 'Offers' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'rejected', label: 'Rejected' },
];

function isOfferInquiry(b: Booking): boolean {
  if (b.inquiry_type === 'make_offer') return true;
  if (
    b.payment_status === 'offer_pending' ||
    b.payment_status === 'offer_countered' ||
    b.payment_status === 'offer_rejected'
  ) {
    return true;
  }
  return /^\s*\[OFFER/i.test(b.special_requests ?? '');
}

function inquiryTabFor(b: Booking): InquiryTab | null {
  if (b.status === 'inquiry_preparing' || b.status === 'inquiry_pending') {
    return isOfferInquiry(b) ? 'offers' : 'new';
  }
  if (b.status === 'accepted') return 'accepted';
  if (b.status === 'rejected') return 'rejected';
  if (b.status === 'cancelled' && b.payment_status === 'offer_rejected') return 'rejected';
  if (b.status === 'confirmed' && b.payment_status === 'inquiry') return 'accepted';
  if (b.status === 'confirmed' || b.status === 'completed') return 'accepted';
  if (b.status === 'cancelled') return 'rejected';

  const pending =
    b.status === 'pending_host' || b.status === 'pending' || b.status === 'inquiry_pending';
  if (pending) {
    return isOfferInquiry(b) ? 'offers' : 'new';
  }
  return null;
}

function canHostAct(b: Booking): boolean {
  return (
    b.status === 'pending_host' ||
    b.status === 'pending' ||
    b.status === 'inquiry_pending'
  );
}

/**
 * Inquiries hub — host reviews guest inquiries after quality review.
 * Accept sets status `accepted` (no Razorpay). Reject sets `rejected`.
 */
interface BookingsPageProps {
  onNavigate?: (page: string) => void;
}

export default function BookingsPage({ onNavigate }: BookingsPageProps = {}) {
  const { host } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<InquiryTab>('new');
  const [counterTarget, setCounterTarget] = useState<{ booking: Booking; offer: ParsedOffer } | null>(
    null,
  );
  const [rejectTarget, setRejectTarget] = useState<Booking | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastPayload | null>(null);

  const loadBookings = useCallback(async () => {
    if (!host?.id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from('host_inquiries')
        .select('*, properties(title, city, price_per_day, price_full_day)')
        .eq('host_id', host.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBookings((data as unknown as Booking[]) || []);
    } catch (error) {
      console.error('Error loading inquiries:', error);
      setLoadError('Could not load inquiries. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [host?.id]);

  useEffect(() => {
    if (host?.id) loadBookings();
  }, [host?.id, loadBookings]);

  useEffect(() => {
    if (!host?.id) return;

    const showToast = (row: Partial<Booking>, title: string, body: string) => {
      setToast({
        id: row.id ?? `${Date.now()}`,
        title,
        body,
      });
    };

    const channel = supabase
      .channel(`bookings-host-${host.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `host_id=eq.${host.id}`,
        },
        (payload) => {
          loadBookings();
          const row = payload.new as Partial<Booking> | undefined;
          const old = payload.old as Partial<Booking> | undefined;
          if (!row?.id) return;
          const released =
            row.phone_verified === true &&
            Boolean(row.reviewed_at) &&
            row.status === 'pending_host' &&
            old?.status !== 'pending_host';
          if (released) {
            showToast(
              row,
              'Inquiry ready',
              'Quality reviewed by XpressBNB. Guest contact is now available.',
            );
            return;
          }
          if (row.status !== old?.status && row.status === 'pending_host') {
            showToast(row, 'Inquiry updated', 'An inquiry on your dashboard was updated.');
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [host?.id, loadBookings]);

  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') void loadBookings(); };
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    const timer = window.setInterval(refresh, 30000);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [loadBookings]);

  const tabCounts = useMemo(() => {
    const counts: Record<InquiryTab, number> = { new: 0, offers: 0, accepted: 0, rejected: 0 };
    for (const b of bookings) {
      const t = inquiryTabFor(b);
      if (t) counts[t] += 1;
    }
    return counts;
  }, [bookings]);

  const filtered = useMemo(
    () => bookings.filter((b) => inquiryTabFor(b) === tab),
    [bookings, tab],
  );

  const handleAccept = async (b: Booking) => {
    setBusyId(b.id);
    try {
      const { error } = await supabase.rpc('respond_to_inquiry', {
        p_booking_id: b.id, p_action: 'accepted', p_expected_version: b.response_version,
        p_request_id: crypto.randomUUID(),
      });
      if (error) throw error;
      await loadBookings();
      setTab('accepted');
    } catch (e) {
      console.error('Accept inquiry failed', e);
      alert('Could not accept. Refresh the inquiry before retrying.');
    } finally {
      setBusyId(null);
    }
  };

  const handleRejectConfirm = async (note: string) => {
    if (!rejectTarget) return;
    const b = rejectTarget;
    setBusyId(b.id);
    try {
      const { error } = await supabase.rpc('respond_to_inquiry', {
        p_booking_id: b.id, p_action: 'rejected', p_expected_version: b.response_version,
        p_request_id: crypto.randomUUID(), p_note: note || null,
      });
      if (error) throw error;
      setRejectTarget(null);
      await loadBookings();
      setTab('rejected');
    } catch (e) {
      console.error('Reject inquiry failed', e);
      alert('Could not reject. Refresh the inquiry before retrying.');
    } finally {
      setBusyId(null);
    }
  };

  const handleCounterSubmit = async (newPerNight: number, hostMessage: string) => {
    if (!counterTarget) return;
    const { booking } = counterTarget;
    setBusyId(booking.id);
    try {
      const { error } = await supabase.rpc('respond_to_inquiry', {
        p_booking_id: booking.id, p_action: 'countered', p_expected_version: booking.response_version,
        p_request_id: crypto.randomUUID(), p_note: hostMessage || null, p_counter_amount: newPerNight,
      });
      if (error) throw error;
      setCounterTarget(null);
      await loadBookings();
    } catch (e) {
      console.error('Counter offer failed', e);
      alert('Could not send counter. Refresh the inquiry before retrying.');
    } finally {
      setBusyId(null);
    }
  };

  const getStatusStyles = (status: BookingStatus) => {
    switch (status) {
      case 'pending':
      case 'inquiry_pending':
      case 'pending_host':
        return { bg: 'rgba(80,200,120,0.12)', color: theme.warm };
      case 'accepted':
      case 'confirmed':
        return { bg: 'rgba(80,200,120,0.10)', color: '#3dae68' };
      case 'rejected':
      case 'cancelled':
        return { bg: 'rgba(220,38,38,0.08)', color: '#B91C1C' };
      case 'completed':
        return { bg: 'rgba(37,99,235,0.10)', color: '#2563EB' };
      default:
        return { bg: 'var(--xpx-surface-light)', color: 'var(--xpx-muted)' };
    }
  };

  const statusLabel = (status: BookingStatus) => {
    if (status === 'pending_host') return 'Awaiting you';
    if (status === 'inquiry_preparing') return 'Preparing';
    if (status === 'accepted') return 'Accepted — not confirmed';
    if (status === 'rejected') return 'Rejected';
    return status.replace(/_/g, ' ');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div
          className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: theme.warm }}
          aria-hidden
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-xpx-text tracking-tight">
            Inquiries
          </h1>
          <p className="text-xpx-muted mt-2 max-w-2xl leading-relaxed">
            0% commission — you accept or reject, then coordinate payment directly (WhatsApp, UPI, or
            cash). We never take a cut of the guest payout.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadBookings()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl border px-4 py-2.5 text-sm font-semibold text-xpx-text transition-colors disabled:opacity-50"
          style={{ borderColor: 'var(--xpx-border-strong)', background: 'var(--xpx-surface)' }}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
          Refresh inquiries
        </button>
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {loadError}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {TABS.map(({ id, label }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className="px-4 py-2 rounded-full font-medium text-sm transition-colors"
              style={
                active
                  ? { background: theme.warm, color: '#ffffff', border: `1px solid ${theme.warm}` }
                  : {
                      background: 'var(--xpx-surface)',
                      color: 'var(--xpx-text)',
                      border: '1px solid var(--xpx-border-strong)',
                    }
              }
            >
              {label}
              {' · '}
              {tabCounts[id]}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyInquiries tab={tab} onNavigate={onNavigate} />
      ) : (
        <div className="space-y-4">
          {filtered.map((booking) => (
            <InquiryCard
              key={booking.id}
              booking={booking}
              tab={tab}
              busyId={busyId}
              getStatusStyles={getStatusStyles}
              statusLabel={statusLabel}
              onAccept={() => handleAccept(booking)}
              onReject={() => setRejectTarget(booking)}
              onCounter={(offer) => setCounterTarget({ booking, offer })}
            />
          ))}
        </div>
      )}

      {counterTarget && (
        <CounterOfferDialog
          open={true}
          onClose={() => setCounterTarget(null)}
          guestOfferPerNight={counterTarget.offer.perNight}
          listPricePerNight={
            counterTarget.booking.properties?.price_per_day ||
            counterTarget.booking.properties?.price_full_day ||
            counterTarget.offer.perNight
          }
          nights={counterTarget.offer.nights}
          onSubmit={handleCounterSubmit}
        />
      )}

      <RejectInquiryDialog
        open={rejectTarget !== null}
        guestName={rejectTarget?.guest_name ?? 'Guest'}
        onClose={() => setRejectTarget(null)}
        onConfirm={handleRejectConfirm}
        busy={busyId !== null && rejectTarget !== null}
      />

      <RealtimeToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

function EmptyInquiries({
  tab,
  onNavigate,
}: {
  tab: InquiryTab;
  onNavigate?: (page: string) => void;
}) {
  const copy: Record<InquiryTab, { title: string; body: string }> = {
    new: {
      title: 'No new inquiries yet',
      body: 'When guests send book-pay-later inquiries, they land here. You choose accept or reject — payment stays between you and the guest.',
    },
    offers: {
      title: 'No open offers',
      body: 'Price offers from guests show up here. Accept, counter, or reject — then close on WhatsApp.',
    },
    accepted: {
      title: 'No accepted inquiries',
      body: 'Accepted guests can reach you on WhatsApp. Collect rent directly — 0% commission to XpressBnB.',
    },
    rejected: {
      title: 'No rejected inquiries',
      body: 'Inquiries you decline are listed here for your records.',
    },
  };
  const { title, body } = copy[tab];
  return (
    <div className="space-y-4">
      <div
        className="rounded-2xl p-8 sm:p-12 text-center"
        style={{
          background: 'var(--xpx-surface)',
          border: '1px solid var(--xpx-border)',
          boxShadow: '0 12px 40px rgba(15,23,42,0.06)',
        }}
      >
        <BookOpen className="w-16 h-16 text-xpx-subtle mx-auto mb-4" />
        <h3 className="text-xl font-bold text-xpx-text mb-2">{title}</h3>
        <p className="text-xpx-muted max-w-md mx-auto leading-relaxed">{body}</p>
      </div>
      <HostValueProp
        variant="minimal"
        showComparison={tab === 'new'}
        showSocialProof={false}
        showUpgradeNudge={tab === 'new'}
        onUpgradeClick={onNavigate ? () => onNavigate('subscription') : undefined}
      />
    </div>
  );
}

function GuestContactRow({
  booking,
}: {
  booking: Pick<Booking, 'phone_verified' | 'guest_phone' | 'guest_name' | 'properties' | 'reviewed_at' | 'reviewed_by' | 'status' | 'contact_released'>;
}) {
  if (!isInquiryContactReleased(booking) || !booking.guest_phone?.trim()) return null;

  const display = formatGuestPhoneDisplay(booking.guest_phone);
  const tel = guestPhoneToE164(booking.guest_phone);
  const firstName = booking.guest_name.trim().split(/\s+/)[0];
  const wa = buildGuestDirectWhatsAppLink(
    booking.guest_phone,
    booking.properties?.title ?? 'your property',
    firstName,
  );

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <Phone className="w-4 h-4 text-xpx-subtle flex-shrink-0" />
      <span className="text-xpx-text font-medium">{display}</span>
      <span className="text-[10px] font-medium text-xpx-subtle normal-case tracking-normal">
        Contact details reviewed
      </span>
      <a
        href={`tel:${tel}`}
        className="text-xs font-semibold px-2 py-0.5 rounded-lg"
        style={{ color: theme.warm }}
      >
        Call
      </a>
      <a
        href={wa}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs font-semibold px-2 py-0.5 rounded-lg"
        style={{ color: '#25D366' }}
      >
        WhatsApp
      </a>
    </div>
  );
}

function InquiryCard({
  booking,
  tab,
  busyId,
  getStatusStyles,
  statusLabel,
  onAccept,
  onReject,
  onCounter,
}: {
  booking: Booking;
  tab: InquiryTab;
  busyId: string | null;
  getStatusStyles: (s: BookingStatus) => { bg: string; color: string };
  statusLabel: (s: BookingStatus) => string;
  onAccept: () => void;
  onReject: () => void;
  onCounter: (offer: ParsedOffer) => void;
}) {
  const parsed = parseOfferFromSpecialRequests(booking.special_requests);
  const offer = booking.inquiry_type === 'make_offer' && booking.offer_amount != null && booking.nights != null
    ? { perNight: booking.offer_amount, nights: booking.nights, total: booking.offer_amount * booking.nights, guestNote: booking.offer_message ?? '', hostCounter: booking.counter_amount }
    : parsed;
  const isOffer = isOfferInquiry(booking);
  const isBusy = busyId === booking.id;
  const styles = getStatusStyles(booking.status);
  const contactReleased = isInquiryContactReleased(booking);
  const qualityReviewPending = booking.quality_review_pending === true;
  const showActions = canHostAct(booking) && contactReleased;
  const showOfferActions = tab === 'offers' && showActions;
  const showInquiryActions = tab === 'new' && showActions;
  const list =
    booking.properties?.price_per_day ||
    booking.properties?.price_full_day ||
    offer?.perNight ||
    0;
  const trustBadge = primaryInquiryTrustBadge(booking);

  useEffect(() => {
    if (contactReleased && booking.status === 'pending_host' && !booking.host_viewed_at) {
      void supabase.rpc('mark_inquiry_viewed_by_host', { p_booking_id: booking.id });
    }
  }, [booking.id, contactReleased, booking.status, booking.host_viewed_at]);

  return (
    <article
      className="rounded-2xl p-5 sm:p-6"
      style={{
        background: 'var(--xpx-surface)',
        border: '1px solid var(--xpx-border)',
        boxShadow: '0 12px 40px rgba(15,23,42,0.06)',
      }}
    >
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {qualityReviewPending ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full font-bold uppercase tracking-wider"
                style={{
                  background: 'rgba(245,158,11,0.12)',
                  color: '#B45309',
                  fontSize: '10px',
                  padding: '2px 8px',
                }}
              >
                <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0 bg-amber-500" aria-hidden />
                Quality Review Pending
              </span>
            ) : (
              trustBadge && <InquiryTrustBadgePill badge={trustBadge} />
            )}
            {contactReleased && booking.customer_reference && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wide bg-slate-100 text-slate-700 border border-slate-200">
                {booking.customer_reference}
              </span>
            )}
            {isOffer && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                style={{ background: 'rgba(80,200,120,0.12)', color: theme.warm }}
              >
                <Tag className="w-3 h-3" />
                Offer
              </span>
            )}
            {(booking.response_kind === 'countered' || booking.payment_status === 'offer_countered') && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                style={{ background: 'rgba(37,99,235,0.10)', color: '#2563EB' }}
              >
                Countered
              </span>
            )}
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize"
              style={{ background: styles.bg, color: styles.color }}
            >
              {statusLabel(booking.status)}
            </span>
            <span className="text-xs text-xpx-subtle">
              {booking.created_at
                ? new Date(booking.created_at).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                : '—'}
            </span>
          </div>

          <h3 className="mt-1.5 text-lg font-bold text-xpx-text truncate">
            {contactReleased ? booking.guest_name : 'Inquiry in review'}
          </h3>
          <p className="text-xs text-xpx-muted truncate">
            {booking.properties?.title ?? 'Property'}
            {booking.properties?.city ? ` · ${booking.properties.city}` : ''}
          </p>
          {qualityReviewPending ? (
            <p className="mt-1.5 text-[11px] text-xpx-muted leading-relaxed max-w-prose">
              {QUALITY_REVIEW_PENDING_HELPER}
            </p>
          ) : contactReleased ? (
            <p className="mt-1.5 text-[11px] text-xpx-muted leading-relaxed max-w-prose">
              {QUALITY_REVIEW_HELPER}
            </p>
          ) : null}

          {isOffer && offer && (
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl p-3" style={{ background: 'var(--xpx-surface-light)' }}>
                <p className="text-[10px] uppercase tracking-wider text-xpx-subtle">Listed</p>
                <p className="text-base font-bold text-xpx-text mt-0.5">
                  ₹{list.toLocaleString()}
                </p>
              </div>
              <div
                className="rounded-xl p-3"
                style={{
                  background: 'rgba(80,200,120,0.10)',
                  border: '1px solid rgba(80,200,120,0.30)',
                }}
              >
                <p className="text-[10px] uppercase tracking-wider" style={{ color: theme.warm }}>
                  Offered
                </p>
                <p className="text-base font-extrabold text-xpx-text mt-0.5">
                  ₹{(offer.perNight ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'var(--xpx-surface-light)' }}>
                <p className="text-[10px] uppercase tracking-wider text-xpx-subtle">Offer estimate</p>
                <p className="text-base font-bold text-xpx-text mt-0.5">
                  ₹{(offer.total ?? 0).toLocaleString()}
                </p>
              </div>
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {contactReleased && (
              <div className="flex items-center gap-2 text-xpx-muted">
                <User className="w-4 h-4 text-xpx-subtle" />
                <span className="text-xpx-text">{booking.guest_name}</span>
              </div>
            )}
            {contactReleased && (
              <div className="flex items-center gap-2 text-xpx-muted truncate">
                <Mail className="w-4 h-4 text-xpx-subtle flex-shrink-0" />
                <span className="text-xpx-text truncate">{booking.guest_email}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xpx-muted sm:col-span-2">
              <GuestContactRow booking={booking} />
            </div>
            <div className="flex items-center gap-2 text-xpx-muted">
              <Calendar className="w-4 h-4 text-xpx-subtle" />
              <span className="text-xpx-text">
                {new Date(booking.check_in_date).toLocaleDateString()} →{' '}
                {booking.check_out_date
                  ? new Date(booking.check_out_date).toLocaleDateString()
                  : '—'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xpx-muted">
              <User className="w-4 h-4 text-xpx-subtle" />
              <span className="text-xpx-text">
                {booking.num_guests} {booking.num_guests === 1 ? 'guest' : 'guests'}
                {offer?.nights != null && (
                  <>
                    {' '}
                    · {offer.nights} {offer.nights === 1 ? 'night' : 'nights'}
                  </>
                )}
              </span>
            </div>
          </div>

          {contactReleased && (
            <InquiryHostTrustPanel booking={booking} showReference={false} />
          )}

          <div className="mt-4"><InquiryTermsSummary terms={parseInquiryTerms(booking.inquiry_terms)} /></div>
          {booking.counter_amount != null && <p className="mt-2 text-sm font-semibold">Current counteroffer: ₹{booking.counter_amount.toLocaleString('en-IN')}/night · proposal {booking.response_version}</p>}
          {!isOffer && (
            <div className="mt-3 flex items-center gap-2 text-lg font-bold text-xpx-text">
              <IndianRupee className="w-5 h-5" />
              {(booking.amount_total ?? booking.total_price)?.toLocaleString() ?? '—'}
            </div>
          )}

          {(offer?.guestNote || offer?.hostCounter) && (
            <div
              className="mt-4 rounded-xl p-3 text-sm space-y-2"
              style={{ background: 'var(--xpx-surface-light)' }}
            >
              {offer.guestNote && (
                <div className="flex items-start gap-2">
                  <MessageSquare className="w-4 h-4 text-xpx-subtle flex-shrink-0 mt-0.5" />
                  <p className="text-xpx-text leading-relaxed">{offer.guestNote}</p>
                </div>
              )}
              {offer.hostCounter != null && (
                <p
                  className="text-xs font-semibold flex items-center gap-1.5"
                  style={{ color: '#2563EB' }}
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  You countered with ₹{offer.hostCounter.toLocaleString()}/night
                </p>
              )}
            </div>
          )}

          {booking.host_decision_note && (
            <p className="mt-3 text-sm text-xpx-muted italic">
              Your note: {booking.host_decision_note}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 lg:w-48 lg:flex-shrink-0">
          {(showInquiryActions || showOfferActions) && (
            <>
              <button
                type="button"
                onClick={onAccept}
                disabled={isBusy || booking.response_kind === 'countered'}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
                style={{
                  background: theme.warm,
                  color: '#ffffff',
                  boxShadow: '0 4px 18px rgba(80,200,120,0.35)',
                }}
              >
                <CheckCircle className="w-4 h-4" />
                Accept inquiry
              </button>
              {showOfferActions && offer && (
                <button
                  type="button"
                  onClick={() => onCounter(offer)}
                  disabled={isBusy}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 text-xpx-text"
                  style={{
                    background: 'var(--xpx-surface-light)',
                    border: '1px solid var(--xpx-border-strong)',
                  }}
                >
                  <ArrowRight className="w-4 h-4" />
                  Counter
                </button>
              )}
              <button
                type="button"
                onClick={onReject}
                disabled={isBusy}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50"
                style={{
                  background: 'rgba(220,38,38,0.06)',
                  color: '#B91C1C',
                  border: '1px solid rgba(220,38,38,0.25)',
                }}
              >
                <XCircle className="w-4 h-4" />
                Reject
              </button>
            </>
          )}

          <p className="text-xs text-xpx-muted">Acceptance is an inquiry response. Final price, payment and reservation still require agreement with the guest.</p>

        </div>
      </div>
    </article>
  );
}
