import { useMemo } from 'react';
import { MessageCircle } from 'lucide-react';
import InquiryHostContactCard from '../../inquiry/success/InquiryHostContactCard';
import CustomerReferenceField from '../../inquiry/CustomerReferenceField';
import GuestMemberTimeline from './GuestMemberTimeline';
import type { InquirySuccessSnapshot } from '../../../lib/inquirySuccessStorage';
import { formatInr } from '../../../lib/guestPricingEngine';
import { guestRequestSentCopy } from '../../../lib/guestPricingCopy';
import { buildInquirySuccessWhatsAppLink } from '../../../lib/inquiryHostContact';
import { navigateTo } from '../../../lib/navigation';
import { GuestWelcomeContinueLater } from './GuestSecureAccountTeaser';

type GuestWelcomeExperienceProps = {
  snapshot: InquirySuccessSnapshot;
  hostName: string | null;
};

function formatTripDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function GuestWelcomeExperience({ snapshot, hostName }: GuestWelcomeExperienceProps) {
  const propertyPath = snapshot.propertySlug
    ? `/property/${snapshot.propertySlug}`
    : `/property/${snapshot.propertyId}`;

  const hostPhoneDigits = useMemo(
    () => snapshot.hostContactPhone?.replace(/\D/g, '') ?? '',
    [snapshot.hostContactPhone],
  );
  const hasHostPhone = hostPhoneDigits.length >= 10;
  const whatsappHref = hasHostPhone
    ? buildInquirySuccessWhatsAppLink(hostPhoneDigits, snapshot.propertyTitle)
    : null;

  const trackPath = `/track-inquiry?ref=${encodeURIComponent(snapshot.customerReference)}`;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="flex items-start justify-between gap-3 mb-8 sm:mb-10 inquiry-reveal motion-reduce:animate-none">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--accent-dark)' }}>
            Request sent
          </p>
          <h1 className="mt-1.5 text-2xl sm:text-3xl font-extrabold text-xpx-text tracking-tight leading-[1.12] text-balance">
            {hasHostPhone ? 'Introduce yourself to your host' : 'Your inquiry is in'}
          </h1>
          <p className="mt-2 text-sm sm:text-base text-xpx-muted leading-relaxed max-w-prose">
            {guestRequestSentCopy(formatInr(snapshot.estimatedTotal))}
          </p>
          <p className="mt-1.5 text-sm text-xpx-subtle leading-snug">
            {snapshot.propertyTitle} · {formatTripDate(snapshot.checkIn)} →{' '}
            {formatTripDate(snapshot.checkOut)}
          </p>
        </div>
        <GuestWelcomeContinueLater className="md:hidden shrink-0" />
      </header>

      <InquiryHostContactCard
        hostName={hostName}
        propertyTitle={snapshot.propertyTitle}
        hostPhoneDigits={snapshot.hostContactPhone}
        prominent
        className="mb-6 sm:mb-8 inquiry-host-reveal motion-reduce:animate-none"
      />

      <div className="mb-6 sm:mb-8">
        <CustomerReferenceField
          reference={snapshot.customerReference}
          description="Save this ID — use it with your email to track your inquiry anytime."
        />
      </div>

      <GuestMemberTimeline className="mb-8 sm:mb-10" />

      <div
        className="sticky bottom-0 z-10 -mx-4 px-4 pt-3 pb-4 sm:static sm:mx-0 sm:px-0 sm:pt-0 sm:pb-0 inquiry-reveal motion-reduce:animate-none"
        style={{
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
          background:
            'linear-gradient(to top, var(--xpx-page, #f8fafc) 72%, rgba(248,250,252,0))',
        }}
      >
        {hasHostPhone && whatsappHref ? (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="sm:hidden flex w-full min-h-[52px] items-center justify-center gap-2.5 rounded-2xl px-5 text-base font-bold text-white transition-transform active:scale-[0.98] motion-reduce:transition-none mb-3"
            style={{ background: '#25D366', boxShadow: '0 10px 32px rgba(37,211,102,0.32)' }}
          >
            <MessageCircle className="h-5 w-5" aria-hidden />
            WhatsApp host
          </a>
        ) : null}

        <div className="flex flex-col sm:flex-row gap-3">
          {!hasHostPhone ? (
            <button
              type="button"
              onClick={() => navigateTo(trackPath)}
              className="w-full min-h-[52px] rounded-2xl px-5 text-base font-bold text-white transition-transform active:scale-[0.98] motion-reduce:transition-none"
              style={{
                background: 'var(--xpx-cta)',
                boxShadow: 'var(--xpx-cta-glow)',
              }}
            >
              Track inquiry
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigateTo(trackPath)}
              className="w-full min-h-[52px] rounded-2xl px-5 text-base font-semibold text-xpx-text border border-xpx-border-strong bg-white"
            >
              Track inquiry
            </button>
          )}
          <button
            type="button"
            onClick={() => navigateTo(propertyPath)}
            className="w-full min-h-[52px] rounded-2xl px-5 text-base font-semibold text-xpx-text border border-xpx-border-strong bg-white sm:order-first sm:flex-1"
          >
            Continue browsing
          </button>
        </div>
      </div>
    </div>
  );
}
