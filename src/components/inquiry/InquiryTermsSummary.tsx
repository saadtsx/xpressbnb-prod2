import { useEffect } from 'react';
import { trackXpressEvent } from '../../lib/analytics';
import { formatInr } from '../../lib/guestPricingEngine';
import type { InquiryTerms } from '../../lib/inquiryJourney';

export default function InquiryTermsSummary({ terms }: { terms: InquiryTerms | null }) {
  useEffect(() => { trackXpressEvent('price_terms_viewed'); }, []);
  const amount = (n: number | null | undefined) => typeof n === 'number' ? formatInr(n) : 'Pending confirmation';
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 text-sm" aria-label="Stay terms">
      <h2 className="font-bold text-xpx-text">Stay terms — total not yet confirmed</h2>
      {terms?.property_title && <p className="font-semibold">{terms.property_title}</p>}
      {terms?.check_in && <p>{terms.check_in} to {terms.check_out} · {terms.num_guests} guests</p>}
      <dl className="space-y-2 text-xpx-muted">
        {[
          ['Nightly subtotal (estimate)', amount(terms?.nightly_subtotal)],
          ['Optional decoration requested', terms?.optional_decoration == null ? 'Pending confirmation' : terms.optional_decoration > 0 ? amount(terms.optional_decoration) : 'Not requested'],
          ['Accommodation estimate', amount(terms?.estimate)],
          ['Taxes, platform fees and mandatory charges', 'Pending confirmation'],
          ['Total payable', 'Not yet confirmed'],
          ['Advance amount and calculation', 'Not agreed'],
          ['Remaining balance and due date', 'Not agreed'],
          ['Deposit and refund conditions', 'Not provided'],
          ['Cancellation and check-in policies', 'Confirm with host before paying'],
          ['Accepted ID requirements', terms?.accepts_local_ids === true ? 'Listing states local IDs accepted; confirm accepted documents' : terms?.accepts_local_ids === false ? 'Listing states local IDs not accepted; confirm accepted documents' : 'Confirm accepted documents with host'],
          ['Payment status', 'External payment — unverified by XpressBNB'],
        ].map(([label, value]) => <div key={label} className="flex justify-between gap-4"><dt>{label}</dt><dd className="text-right text-xpx-text max-w-[55%]">{value}</dd></div>)}
      </dl>
      {terms?.guest_consent === 'given'
        ? <p className="rounded-lg bg-emerald-50 p-3 text-emerald-900">You agreed to the host's proposed estimate of {amount(terms.estimate)}. This is not a booking confirmation; payment and remaining terms are still to be agreed with the host.</p>
        : terms?.guest_consent === 'declined'
          ? <p className="rounded-lg bg-slate-50 p-3 text-xpx-muted">You declined the host's counteroffer. This inquiry is closed.</p>
          : terms?.previous_estimate != null && <p className="rounded-lg bg-amber-50 p-3 text-amber-900">The estimate changed from {amount(terms.previous_estimate)} to {amount(terms.estimate)}. Review the new proposal above. You have not accepted it yet.</p>}
      <p className="text-xs text-xpx-muted">{terms?.version != null ? `Proposal version ${terms.version}. ` : ''}Host acceptance does not reserve or confirm this stay. Obtain the complete written terms before agreeing or paying. No fixed advance percentage or payment protection is offered by this inquiry workflow.</p>
    </section>
  );
}
