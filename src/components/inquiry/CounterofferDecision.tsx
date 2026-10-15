import { useId, useRef, useState } from 'react';
import { formatInr } from '../../lib/guestPricingEngine';
import { counterofferProposal, type InquiryTerms } from '../../lib/inquiryJourney';
import { respondToCounteroffer, type CounterofferAction } from '../../lib/inquirySubmit';

type CounterofferDecisionProps = {
  customerReference: string;
  guestEmail: string;
  terms: InquiryTerms | null;
  counterAmount: number | null;
  responseVersion: number;
  /** Re-fetch authoritative status after a decision or a stale-version rejection. */
  onSettled: () => void;
};

/**
 * Guest decision on a host counteroffer. Agreement is to this exact proposal
 * version only; it is not a booking confirmation and collects no payment.
 */
export default function CounterofferDecision({
  customerReference,
  guestEmail,
  terms,
  counterAmount,
  responseVersion,
  onSettled,
}: CounterofferDecisionProps) {
  const consentId = useId();
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState<CounterofferAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDecline, setConfirmDecline] = useState(false);
  // One request id per action per proposal version: a network retry is idempotent server-side.
  const requestIds = useRef(new Map<string, string>());

  const proposal = counterofferProposal(terms, counterAmount, responseVersion);
  if (!proposal) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900" role="status">
        The host sent a counteroffer, but its details are incomplete. Contact the host before agreeing to anything.
      </section>
    );
  }

  const decide = async (action: CounterofferAction) => {
    if (busy) return;
    const key = `${action}:${proposal.version}`;
    if (!requestIds.current.has(key)) requestIds.current.set(key, crypto.randomUUID());
    setBusy(action);
    setError(null);
    const result = await respondToCounteroffer({
      customerReference,
      guestEmail,
      action,
      expectedVersion: proposal.version,
      requestId: requestIds.current.get(key)!,
    });
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      if (result.stale) onSettled();
      return;
    }
    onSettled();
  };

  return (
    <section className="rounded-2xl border-2 border-blue-200 bg-white p-5 space-y-4 text-sm" aria-labelledby={`${consentId}-title`}>
      <h2 id={`${consentId}-title`} className="text-base font-extrabold text-xpx-text">
        The host proposed a different price
      </h2>
      <dl className="space-y-2">
        <div className="flex justify-between gap-4">
          <dt className="text-xpx-muted">Proposed price</dt>
          <dd className="font-bold text-xpx-text">{formatInr(proposal.perNight)} / night</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-xpx-muted">Accommodation estimate ({proposal.nights} {proposal.nights === 1 ? 'night' : 'nights'})</dt>
          <dd className="font-bold text-xpx-text">{formatInr(proposal.estimate)}</dd>
        </div>
        {proposal.previousEstimate != null && (
          <div className="flex justify-between gap-4">
            <dt className="text-xpx-muted">Your earlier estimate</dt>
            <dd className="text-xpx-text">{formatInr(proposal.previousEstimate)}</dd>
          </div>
        )}
      </dl>
      <p className="rounded-lg bg-slate-50 p-3 text-xs text-xpx-muted">
        Agreeing tells the host you accept this price for proposal version {proposal.version}. It is not a confirmed
        booking. Taxes, fees, payment and cancellation terms are still to be agreed with the host, and no payment is
        collected here.
      </p>

      <label htmlFor={consentId} className="flex items-start gap-3 cursor-pointer">
        <input
          id={consentId}
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-700"
        />
        <span>
          I agree to {formatInr(proposal.perNight)} per night ({formatInr(proposal.estimate)} estimate) and understand
          this is not a booking confirmation.
        </span>
      </label>

      {error && (
        <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
          {error}
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-2.5">
        <button
          type="button"
          onClick={() => void decide('accept_counter')}
          disabled={!consent || busy !== null}
          className="min-h-[48px] flex-1 rounded-xl bg-emerald-700 px-4 font-bold text-white disabled:opacity-45"
        >
          {busy === 'accept_counter' ? 'Recording…' : 'Accept this price'}
        </button>
        {confirmDecline ? (
          <button
            type="button"
            onClick={() => void decide('decline_counter')}
            disabled={busy !== null}
            className="min-h-[48px] flex-1 rounded-xl border border-red-600 px-4 font-bold text-red-700 disabled:opacity-45"
          >
            {busy === 'decline_counter' ? 'Recording…' : 'Yes, decline and close inquiry'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDecline(true)}
            disabled={busy !== null}
            className="min-h-[48px] flex-1 rounded-xl border border-slate-300 px-4 font-semibold text-xpx-text disabled:opacity-45"
          >
            Decline
          </button>
        )}
      </div>
    </section>
  );
}
