import InquiryTermsSummary from './inquiry/InquiryTermsSummary';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Tag, MessageCircle, Mail, User, ArrowDown, Sparkles } from 'lucide-react';
import { theme } from '../lib/theme';
import type { Property } from '../lib/database.types';
import { saveBookingConfirmationSnapshot } from '../lib/bookingConfirmationStorage';
import InquiryConfidenceStrip from './inquiry/InquiryConfidenceStrip';
import InquiryHoneypotField from './inquiry/InquiryHoneypotField';
import InquirySubmitTransition from './inquiry/InquirySubmitTransition';
import { normalizePhoneDigits } from '../lib/guestValidation';
import { guestEmailError } from '../lib/guestValidation';
import { submitBookingInquiry } from '../lib/inquirySubmit';
import {
  inquirySuccessPath,
  saveInquirySuccessSnapshot,
  type InquirySuccessSnapshot,
} from '../lib/inquirySuccessStorage';
import type { InquiryTransitionPhase } from '../lib/inquirySuccessMotion';
import { completeInquiryAfterSubmit } from '../lib/finishInquirySuccess';
import { navigateTo } from '../lib/navigation';
import { getDeviceFingerprint } from '../lib/deviceFingerprint';
import {
  isPushSupported,
  subscribeToInquiryPushNotifications,
} from '../lib/pushSubscription';
import {
  bucketResponseMs,
  categorizeBookingError,
  trackXpressEvent,
  type AnalyticsScope,
} from '../lib/analytics';
import { inquiryCtaLabel } from '../lib/inquiryCopy';
import { addLocalDays, toLocalYmd } from '../lib/formatBookingDate';
import {
  buildInquiryAbusePayload,
  createInquiryFormOpenedAt,
  getInquiryCooldownRemainingMs,
  inquiryCooldownMessage,
  inquiryTooFastMessage,
  isInquiryInteractionTooFast,
  markInquirySubmitCooldown,
} from '../lib/inquiryAbuseProtection';

interface OfferModalProps {
  open: boolean;
  onClose: () => void;
  property: Property;
  /** Defaults to today / today+2 if not provided. */
  checkInDate: Date | null;
  checkOutDate: Date | null;
}

/**
 * OfferModal — guest-side "Make an Offer" experience.
 *
 * UX principles:
 *  - Conversational language ("Your fair offer", not "Submit form").
 *  - Always-visible context: the listed nightly price + how much the user
 *    is asking off, so the negotiation feels concrete.
 *  - Slider + numeric input stay in sync; both are bounded so the user
 *    can't propose unreasonable numbers (60% to 100% of list price).
 *  - On submit we record the offer as a `pending` booking with a
 *    structured `[OFFER]` prefix in special_requests so the host can see
 *    it inside their existing Bookings page without any new dashboard.
 */
export default function OfferModal({
  open,
  onClose,
  property,
  checkInDate,
  checkOutDate,
}: OfferModalProps) {
  const listPrice = property.price_per_day || property.price_full_day || 0;

  // Default offer = 10% below list, snapped to nearest ₹50.
  const defaultOffer = useMemo(
    () => Math.max(50, Math.round((listPrice * 0.9) / 50) * 50),
    [listPrice],
  );

  const [offer, setOffer] = useState<number>(defaultOffer);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const formOpenedAtRef = useRef(createInquiryFormOpenedAt());
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transitionPhase, setTransitionPhase] = useState<InquiryTransitionPhase | null>(null);
  const pendingSuccessRef = useRef<InquirySuccessSnapshot | null>(null);
  const navigatedRef = useRef(false);

  const finishWelcome = useCallback(
    (snap: InquirySuccessSnapshot) => {
      if (navigatedRef.current) return;
      navigatedRef.current = true;
      setTransitionPhase(null);
      setSubmitting(false);
      onClose();
      navigateTo(inquirySuccessPath(snap));
    },
    [onClose],
  );

  const handleTransitionComplete = useCallback(() => {
    const snap = pendingSuccessRef.current;
    if (snap) finishWelcome(snap);
    else {
      setTransitionPhase(null);
      setSubmitting(false);
    }
  }, [finishWelcome]);

  const analyticsScope: AnalyticsScope = useMemo(
    () => ({
      property_id: property.id,
      property_slug: property.slug ?? undefined,
      city: property.city,
      inquiry_type: 'make_offer',
    }),
    [property.id, property.slug, property.city],
  );

  // Whenever the modal re-opens or the listing changes, reset the suggested
  // offer back to a sensible default.
  useEffect(() => {
    if (open) {
      setOffer(defaultOffer);
      setError(null);
      setTransitionPhase(null);
      pendingSuccessRef.current = null;
      navigatedRef.current = false;
      setHoneypot('');
      formOpenedAtRef.current = createInquiryFormOpenedAt();
      trackXpressEvent('booking_form_started', {
        ...analyticsScope,
        booking_step: 'details',
      });
    }
  }, [open, defaultOffer, analyticsScope]);

  if (!open) return null;

  const minOffer = Math.max(50, Math.round((listPrice * 0.6) / 50) * 50);
  const maxOffer = listPrice;
  const discountPct = listPrice > 0 ? Math.round(((listPrice - offer) / listPrice) * 100) : 0;

  const inferredNights = (() => {
    if (checkInDate && checkOutDate) {
      const ms = checkOutDate.getTime() - checkInDate.getTime();
      return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
    }
    return 2;
  })();

  const totalOffer = offer * inferredNights;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please share your name so the host can reply.');
      return;
    }
    const emailErr = guestEmailError(email);
    if (emailErr) {
      setError(emailErr);
      return;
    }
    if (offer < minOffer || offer > maxOffer) {
      setError(`Offer must be between ₹${minOffer.toLocaleString()} and ₹${maxOffer.toLocaleString()} per night.`);
      return;
    }
    const phoneDigits = normalizePhoneDigits(phone);
    if (phoneDigits.length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    const cooldownRemaining = getInquiryCooldownRemainingMs();
    if (cooldownRemaining > 0) {
      setError(inquiryCooldownMessage(cooldownRemaining));
      return;
    }
    if (isInquiryInteractionTooFast(formOpenedAtRef.current)) {
      setError(inquiryTooFastMessage());
      return;
    }
    if (honeypot.trim()) {
      setError('Could not submit your inquiry. Please try again.');
      return;
    }

    setSubmitting(true);
    setTransitionPhase(0);
    const submitStarted = performance.now();
    trackXpressEvent('inquiry_submit_started', {
      ...analyticsScope,
      booking_step: 'send',
    });

    try {
    const today = new Date();
    const checkin = checkInDate ? toLocalYmd(checkInDate) : toLocalYmd(today);
    const checkout = checkOutDate
      ? toLocalYmd(checkOutDate)
      : toLocalYmd(addLocalDays(today, inferredNights));

    if (!property.host_id) {
      setError('This listing is missing host details. Please try again later.');
      setSubmitting(false);
      setTransitionPhase(null);
      return;
    }

    const fingerprint = await getDeviceFingerprint();
    const abuse = buildInquiryAbusePayload(formOpenedAtRef.current, honeypot);

    const submitRes = await submitBookingInquiry({
      inquiry_type: 'make_offer',
      property_id: property.id,
      host_id: property.host_id,
      guest_name: name.trim(),
      guest_email: email.trim(),
      guest_phone: phoneDigits,
      check_in: checkin,
      check_out: checkout,
      num_guests: 1,
      offer_amount: offer,
      offer_message: message.trim() || undefined,
      form_opened_at: abuse.form_opened_at,
      company_website: abuse.company_website,
      device_fingerprint: fingerprint,
    });

    if (!submitRes.ok) {
      const errMsg = submitRes.error || 'Could not send your offer. Please try again.';
      setError(errMsg);
      trackXpressEvent('inquiry_submit_failed', {
        ...analyticsScope,
        error_category: categorizeBookingError(errMsg),
        booking_step: 'send',
        response_time_bucket: bucketResponseMs(performance.now() - submitStarted),
      });
      setSubmitting(false);
      setTransitionPhase(null);
      return;
    }

    const inquiry = submitRes.result;
    const hostContactName = inquiry.hostName ?? null;
    const hostContactPhone = inquiry.hostPhone ?? null;

    trackXpressEvent('inquiry_submit_success', {
      ...analyticsScope,
      booking_step: 'send',
      response_time_bucket: bucketResponseMs(performance.now() - submitStarted),
    });

    markInquirySubmitCooldown();

    saveBookingConfirmationSnapshot({
      v: 1,
      savedAt: Date.now(),
      bookingId: inquiry.bookingId,
      customerReference: inquiry.customerReference,
      propertyId: property.id,
      propertyTitle: property.title,
      propertyCity: property.city,
      propertySlug: property.slug ?? null,
      checkIn: checkin,
      checkOut: checkout,
      numGuests: 1,
      estimatedTotal: totalOffer,
      guestEmail: email.trim(),
      hostContactName,
      hostContactPhone,
      includeDecoration: false,
      paymentStatus: 'offer_pending',
      bookingStatus: 'inquiry_preparing',
      externalListings: property.external_listings ?? null,
      ...(inquiry.frequentAmigo
        ? {
            frequentAmigoCount: inquiry.frequentAmigo.qualifyingCount,
            frequentAmigoUnlocked: inquiry.frequentAmigo.unlocked,
            frequentAmigoThreshold: inquiry.frequentAmigo.threshold,
          }
        : {}),
    });

    const successSnapshot: InquirySuccessSnapshot = {
      v: 1,
      savedAt: Date.now(),
      variant: 'offer',
      bookingId: inquiry.bookingId,
      customerReference: inquiry.customerReference,
      guestName: name.trim(),
      guestEmail: email.trim(),
      guestPhone: phoneDigits,
      propertyId: property.id,
      propertyTitle: property.title,
      propertyCity: property.city,
      propertySlug: property.slug ?? null,
      hostId: property.host_id ?? null,
      hostContactName,
      hostContactPhone,
      checkIn: checkin,
      checkOut: checkout,
      numGuests: 1,
      estimatedTotal: totalOffer,
      ...(inquiry.frequentAmigo ? { frequentAmigo: inquiry.frequentAmigo } : {}),
    };
    saveInquirySuccessSnapshot(successSnapshot);
    pendingSuccessRef.current = successSnapshot;

    if (
      isPushSupported() &&
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted'
    ) {
      void subscribeToInquiryPushNotifications(
        inquiry.customerReference,
        email.trim(),
        inquiry.bookingId,
      );
    }

    navigatedRef.current = false;
    completeInquiryAfterSubmit({
      snapshot: successSnapshot,
      onPhase: setTransitionPhase,
      onNavigate: finishWelcome,
      navigatedRef,
    });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Could not send your offer. Please try again.';
      setError(errMsg);
      trackXpressEvent('inquiry_submit_failed', {
        ...analyticsScope,
        error_category: categorizeBookingError(errMsg),
        booking_step: 'send',
      });
      setSubmitting(false);
      setTransitionPhase(null);
    }
  };


  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Make an offer"
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-md animate-fade-in-up"
        onClick={onClose}
      />

      <div
        // svh respects mobile browser chrome; max-h prevents the sheet from
        // ever pushing past the viewport. Inner form scrolls within.
        className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col animate-sheet-up sm:animate-fade-in-up"
        style={{
          background: 'var(--xpx-surface)',
          border: '1px solid var(--xpx-border)',
          boxShadow: 'var(--xpx-shadow-overlay)',
          maxHeight: '92svh',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Drag handle (mobile) — affords "this is a swipe-able sheet" to
            the user. Visible against the white sheet. */}
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden flex-shrink-0">
          <div className="w-12 h-1.5 rounded-full" style={{ background: 'rgba(15,23,42,0.18)' }} />
        </div>

        <div className="flex items-start justify-between px-6 pt-4 pb-2 flex-shrink-0">
          <div>
            <p className="xpx-eyebrow">Open to negotiation</p>
            <h2 className="text-xl sm:text-2xl font-extrabold text-xpx-text tracking-tight mt-1">
              Make your offer
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 -m-2 rounded-full text-xpx-muted hover:text-xpx-text hover:bg-slate-100 active:scale-90 transition-transform"
            style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body so a tall sheet on a small phone doesn't clip the
            submit button — the form scrolls inside the sheet. */}
        <div className="overflow-y-auto overscroll-contain flex-1" style={{ WebkitOverflowScrolling: 'touch' }}>

        <form onSubmit={handleSubmit} className="relative px-5 sm:px-6 pb-6 pt-2 space-y-5">
            <InquiryHoneypotField value={honeypot} onChange={setHoneypot} />
            {/* Listed vs Your offer comparison.
                On the smallest widths the labels could collide — switch to a
                single column stack below 360px (custom Tailwind class via min-w). */}
            <div
              className="rounded-2xl p-4"
              style={{
                background:
                  'linear-gradient(135deg, var(--xpx-accent-a12) 0%, var(--xpx-surface-light) 100%)',
                border: '1px solid var(--xpx-accent-a28)',
              }}
            >
              {/* Listed | Offered | Total — three stat columns, comfortable
                  even on a 320px phone because we use gap-2 + min-w-0. */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3 items-end">
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs uppercase tracking-wide text-xpx-muted font-semibold">Listed</p>
                  <p className="mt-1 text-sm sm:text-base font-semibold text-xpx-text line-through opacity-70 truncate">
                    ₹{listPrice.toLocaleString()}
                  </p>
                </div>
                <div className="min-w-0 text-center">
                  <p className="xpx-eyebrow text-[10px] sm:text-[11px]">Offered</p>
                  <p className="mt-1 text-lg sm:text-2xl font-extrabold text-xpx-text leading-none truncate">
                    ₹{offer.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-xpx-subtle mt-0.5">/night</p>
                </div>
                <div className="min-w-0 text-right">
                  <p className="text-[10px] sm:text-xs uppercase tracking-wide text-xpx-muted font-semibold">Total</p>
                  <p className="mt-1 text-sm sm:text-base font-extrabold truncate" style={{ color: theme.accentDark }}>
                    ₹{totalOffer.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-xpx-subtle mt-0.5">{inferredNights}n</p>
                </div>
              </div>
              {discountPct > 0 && (
                <div
                  className="mt-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{
                    background: 'var(--xpx-accent-a12)',
                    color: '#3dae68',
                    border: '1px solid var(--xpx-accent-a32)',
                  }}
                >
                  <ArrowDown className="w-3 h-3" />
                  {discountPct}% below list
                </div>
              )}
            </div>

            {/* Slider — keeps the experience tactile */}
            <div>
              <input
                type="range"
                min={minOffer}
                max={maxOffer}
                step={50}
                value={offer}
                onChange={(e) => setOffer(Number(e.target.value))}
                aria-label="Offer per night"
                className="w-full accent-[var(--accent)]"
              />
              <div className="mt-1 flex justify-between text-[10px] text-xpx-subtle font-mono">
                <span>₹{minOffer.toLocaleString()}</span>
                <span>₹{maxOffer.toLocaleString()}</span>
              </div>
            </div>

            {/* Numeric input + nights summary */}
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-xs uppercase tracking-wide font-bold text-xpx-muted mb-2">
                  Per night (₹)
                </span>
                <input
                  type="number"
                  min={minOffer}
                  max={maxOffer}
                  step={50}
                  value={offer}
                  onChange={(e) => setOffer(Math.max(minOffer, Math.min(maxOffer, Number(e.target.value) || 0)))}
                  className="xpx-input"
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
              </label>
              <div>
                <span className="block text-xs uppercase tracking-wide font-bold text-xpx-muted mb-2">
                  For
                </span>
                <div
                  className="rounded-xl px-4 py-3 text-sm text-xpx-text flex items-center justify-between"
                  style={{ background: 'var(--xpx-surface-light)', border: '1px solid var(--xpx-border)' }}
                >
                  <span>{inferredNights} {inferredNights === 1 ? 'night' : 'nights'}</span>
                  <span className="font-bold" style={{ color: theme.accentDark }}>
                    ₹{totalOffer.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <label className="block">
              <span className="block text-xs uppercase tracking-wide font-bold text-xpx-muted mb-2">
                Mobile number
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit mobile"
                className="xpx-input"
                required
                inputMode="numeric"
                autoComplete="tel"
              />
            </label>

            <InquiryConfidenceStrip className="mb-1" />

            {/* Contact details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-xs uppercase tracking-wide font-bold text-xpx-muted mb-2">
                  Your name
                </span>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-xpx-subtle" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Aarav Mehta"
                    className="xpx-input pl-9"
                    required
                    autoComplete="name"
                    autoCapitalize="words"
                  />
                </div>
              </label>
              <label className="block">
                <span className="block text-xs uppercase tracking-wide font-bold text-xpx-muted mb-2">
                  Email
                </span>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-xpx-subtle" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    className="xpx-input pl-9"
                    required
                    autoComplete="email"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    inputMode="email"
                  />
                </div>
              </label>
            </div>

            {/* Optional message — quietly humanizes the offer */}
            <label className="block">
              <span className="block text-xs uppercase tracking-wide font-bold text-xpx-muted mb-2">
                Note to host (optional)
              </span>
              <div className="relative">
                <MessageCircle className="absolute left-3 top-3 w-4 h-4 text-xpx-subtle" />
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  placeholder="A line about your stay helps hosts say yes — anniversary, work trip, group of 4, etc."
                  className="xpx-input pl-9 resize-none"
                  maxLength={300}
                />
              </div>
            </label>

            {error && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <InquiryTermsSummary terms={{ accepts_local_ids: property.accepts_local_ids }} />
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 rounded-2xl font-bold text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: theme.accent,
                color: '#ffffff',
                boxShadow: 'var(--xpx-cta-glow)',
              }}
            >
              <span className="inline-flex items-center justify-center gap-2">
                {submitting ? 'Sending…' : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {inquiryCtaLabel('offer_submit')}
                  </>
                )}
              </span>
            </button>

            <p className="text-[11px] text-xpx-subtle text-center">
              <Tag className="w-3 h-3 inline mr-1" />
              Hosts see your offer with the dates and message. No payment is taken yet.
            </p>
          </form>
        </div>
      </div>
      {transitionPhase !== null && (
        <InquirySubmitTransition phase={transitionPhase} onComplete={handleTransitionComplete} />
      )}
    </div>
  );
}
