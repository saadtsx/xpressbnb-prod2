import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Flag, X } from 'lucide-react';
import {
  REPORT_DETAILS_MAX,
  REPORT_REASONS,
  submitPropertyReport,
  type ReportReasonId,
} from '../../lib/propertyReport';

type ReportPropertySheetProps = {
  open: boolean;
  propertyId: string;
  propertyTitle: string;
  onClose: () => void;
};

const RED = '#DC2626';

/** Instagram-style report sheet: pick one reason, optionally add a note, done. */
export default function ReportPropertySheet({
  open,
  propertyId,
  propertyTitle,
  onClose,
}: ReportPropertySheetProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [reason, setReason] = useState<ReportReasonId | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason(null);
    setDetails('');
    setError(null);
    setSent(false);
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async () => {
    if (!reason || busy) return;
    setBusy(true);
    setError(null);
    const result = await submitPropertyReport({ propertyId, reason, details });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSent(true);
  };

  // Portal: ancestors with transforms (route-enter animation) would otherwise trap `fixed`.
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
      <button
        type="button"
        aria-label="Close report"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/50"
        tabIndex={-1}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full sm:max-w-md max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white pb-safe"
        style={{ boxShadow: '0 -12px 48px rgba(15,23,42,0.25)' }}
      >
        <div className="sticky top-0 bg-white flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--xpx-border)' }}>
          <h2 id={titleId} className="text-base font-extrabold text-xpx-text">
            {sent ? 'Report sent' : 'Report this property'}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-11 w-11 -mr-2 inline-flex items-center justify-center rounded-full hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {sent ? (
          <div className="px-5 py-8 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12" style={{ color: '#059669' }} aria-hidden="true" />
            <p className="mt-4 text-lg font-extrabold text-xpx-text">Thanks for looking out.</p>
            <p className="mt-2 text-sm text-xpx-muted leading-relaxed">
              Our team is notified right away and will review &ldquo;{propertyTitle}&rdquo;. Your report is
              anonymous to the host.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full min-h-[48px] rounded-xl font-bold text-sm text-white"
              style={{ background: 'var(--xpx-text, #0F172A)' }}
            >
              Done
            </button>
          </div>
        ) : (
          <div className="px-5 pt-4 pb-5">
            <p className="text-sm text-xpx-muted">Why are you reporting this property?</p>
            <ul className="mt-3 divide-y" style={{ borderColor: 'var(--xpx-border)' }} role="radiogroup" aria-label="Reason">
              {REPORT_REASONS.map((r) => {
                const selected = reason === r.id;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setReason(r.id)}
                      className="w-full min-h-[52px] flex items-center justify-between gap-3 py-3 text-left text-[15px] font-semibold text-xpx-text"
                    >
                      <span>{r.label}</span>
                      <span
                        className="h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center"
                        style={{ borderColor: selected ? RED : 'var(--xpx-border-strong, #cbd5e1)' }}
                        aria-hidden="true"
                      >
                        {selected && <span className="h-2.5 w-2.5 rounded-full" style={{ background: RED }} />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <label htmlFor={`${titleId}-details`} className="mt-4 block text-sm font-semibold text-xpx-text">
              Anything else? <span className="font-normal text-xpx-muted">(optional)</span>
            </label>
            <textarea
              id={`${titleId}-details`}
              rows={3}
              value={details}
              maxLength={REPORT_DETAILS_MAX}
              onChange={(e) => setDetails(e.target.value)}
              className="mt-1.5 w-full rounded-xl px-3 py-2 text-base"
              style={{ border: '1px solid var(--xpx-border-strong, #cbd5e1)' }}
            />

            {error && (
              <p className="mt-3 text-sm text-red-700" role="alert">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={() => void submit()}
              disabled={!reason || busy}
              className="mt-4 w-full min-h-[52px] inline-flex items-center justify-center gap-2 rounded-xl font-bold text-[15px] text-white disabled:opacity-45"
              style={{ background: RED }}
            >
              <Flag className="h-4 w-4" aria-hidden="true" />
              {busy ? 'Sending…' : 'Submit report'}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
