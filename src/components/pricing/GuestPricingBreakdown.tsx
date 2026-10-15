import { Info, Tag } from 'lucide-react';
import type { GuestPricingLine } from '../../lib/guestPricingEngine';
import { formatInr } from '../../lib/guestPricingEngine';
import {
  GUEST_PRICING_INQUIRY_TOTAL_NOTE,
  GUEST_PRICING_NO_COMMISSION,
  GUEST_PRICING_TRANSPARENT,
} from '../../lib/guestPricingCopy';

type GuestPricingBreakdownProps = {
  lines: GuestPricingLine[];
  guestTotal: number;
  className?: string;
  /** Stripe-style sidebar — nightly × nights, Platform fees, subtotal row */
  variant?: 'default' | 'stripe';
  nights?: number;
  averageNightlyInr?: number;
};

export default function GuestPricingBreakdown({
  lines,
  guestTotal,
  className = '',
  variant = 'default',
  nights = 0,
  averageNightlyInr = 0,
}: GuestPricingBreakdownProps) {
  if (guestTotal <= 0) return null;

  const nonAccommodationLines = lines.filter((line) => line.kind !== 'accommodation');
  const showStripeAccommodation =
    variant === 'stripe' && nights > 0 && averageNightlyInr > 0;

  return (
    <div className={className}>
      <dl className="space-y-2 text-sm">
        {showStripeAccommodation ? (
          <div className="flex justify-between gap-3">
            <dt className="text-xpx-muted">
              {formatInr(averageNightlyInr)} × {nights} {nights === 1 ? 'night' : 'nights'}
            </dt>
            <dd className="font-medium tabular-nums shrink-0 text-xpx-text">
              {formatInr(
                lines.find((l) => l.kind === 'accommodation')?.amount ??
                  averageNightlyInr * nights,
              )}
            </dd>
          </div>
        ) : (
          lines
            .filter((line) => line.kind === 'accommodation')
            .map((line) => (
              <div key={line.id} className="flex justify-between gap-3">
                <dt className="text-xpx-muted">{line.label}</dt>
                <dd className="font-medium tabular-nums shrink-0 text-xpx-text">
                  {formatInr(line.amount)}
                </dd>
              </div>
            ))
        )}

        {nonAccommodationLines.map((line) => (
          <div key={line.id} className="flex justify-between gap-3">
            <dt className="text-xpx-muted">{line.label}</dt>
            <dd
              className={`font-medium tabular-nums shrink-0 ${
                line.kind === 'discount' ? 'text-emerald-700' : 'text-xpx-text'
              }`}
            >
              {line.kind === 'discount' ? '−' : ''}
              {formatInr(Math.abs(line.amount))}
            </dd>
          </div>
        ))}

        {variant === 'stripe' && (
          <div className="flex justify-between gap-3 items-center">
            <dt className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
              Platform fees
              <span
                className="inline-flex"
                title={GUEST_PRICING_TRANSPARENT}
              >
                <Info className="w-3.5 h-3.5 text-emerald-600" aria-hidden />
                <span className="sr-only">{GUEST_PRICING_TRANSPARENT}</span>
              </span>
            </dt>
            <dd className="font-bold tabular-nums shrink-0 text-emerald-700">Confirm with host</dd>
          </div>
        )}

        {variant === 'stripe' && (
          <div className="flex justify-between gap-3 pt-1">
            <dt className="text-xpx-muted font-medium">Subtotal</dt>
            <dd className="font-semibold tabular-nums shrink-0 text-xpx-text">
              {formatInr(guestTotal)}
            </dd>
          </div>
        )}

        <div
          className={`flex justify-between gap-3 ${
            variant === 'stripe' ? 'pt-2 text-lg' : 'pt-3 mt-3 text-base'
          }`}
          style={{ borderTop: '1px solid var(--xpx-border)' }}
        >
          <dt className="text-xpx-text font-bold">
            {variant === 'stripe' ? 'Estimate (INR)' : 'Estimate'}
          </dt>
          <dd className="text-xpx-text font-extrabold tabular-nums">{formatInr(guestTotal)}</dd>
        </div>
      </dl>

      {variant === 'stripe' ? (
        <div
          className="mt-4 rounded-xl px-3.5 py-3 flex items-start gap-2.5"
          style={{
            background: 'linear-gradient(120deg, rgba(5,150,105,0.12) 0%, rgba(236,253,245,0.9) 100%)',
            border: '1px solid rgba(5,150,105,0.22)',
          }}
        >
          <Tag className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700" aria-hidden />
          <p className="text-xs text-emerald-900 leading-snug font-medium">
            {GUEST_PRICING_INQUIRY_TOTAL_NOTE}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-xpx-subtle leading-snug">
          {GUEST_PRICING_NO_COMMISSION} {GUEST_PRICING_INQUIRY_TOTAL_NOTE}
        </p>
      )}
    </div>
  );
}
