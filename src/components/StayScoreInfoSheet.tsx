import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  X,
  Sparkles,
  ShieldCheck,
  Camera,
  Wifi,
  MapPin,
  ClipboardCheck,
} from 'lucide-react';
import { closeStayScoreInfo, subscribeStayScoreInfoOpen } from '../lib/stayScoreEducation';

const FACTORS = [
  { icon: ShieldCheck, label: 'Host-provided listing details' },
  { icon: Camera, label: 'Photos and property information' },
  { icon: Wifi, label: 'Amenities provided' },
  { icon: MapPin, label: 'Location and stay setup' },
  { icon: ClipboardCheck, label: 'Host listing completeness' },
] as const;

/**
 * Stay Score explainer — opens only on explicit tap. Bottom sheet (mobile) / modal (desktop).
 */
export default function StayScoreInfoSheet() {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    setReady(true);
    return subscribeStayScoreInfoOpen((next) => {
      setOpen(next);
    });
  }, []);

  const dismiss = useCallback(() => {
    setOpen(false);
    closeStayScoreInfo();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = window.requestAnimationFrame(() => {
      panelRef.current?.focus();
    });
    return () => {
      window.cancelAnimationFrame(t);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, dismiss]);

  if (!ready || !open) return null;

  return (
    <div
      className="fixed inset-0 z-[105] flex items-end sm:items-center justify-center p-0 sm:p-4 motion-reduce:transition-none"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Close Stay Score info"
        className="absolute inset-0 bg-black/50"
        onClick={dismiss}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative z-[1] flex flex-col w-[calc(100%-20px)] sm:w-full sm:max-w-[440px] max-h-[calc(100dvh-20px)] sm:max-h-[min(88vh,560px)] mb-[10px] sm:mb-0 rounded-[22px] sm:rounded-[20px] overflow-hidden outline-none"
        style={{
          background: 'var(--xpx-surface, #ffffff)',
          border: '1px solid var(--xpx-border, #E5E7EB)',
          boxShadow: '0 24px 64px rgba(15,23,42,0.18)',
        }}
      >
        <div
          className="sm:hidden w-10 h-1 rounded-full mx-auto mt-3 shrink-0"
          style={{ background: 'rgba(15,23,42,0.12)' }}
          aria-hidden
        />

        <button
          type="button"
          onClick={dismiss}
          className="absolute top-3 right-3 z-10 inline-flex items-center justify-center w-9 h-9 rounded-full text-xpx-muted hover:text-xpx-text transition-colors duration-150"
          style={{
            background: 'var(--xpx-surface-light, #F8FAFC)',
            border: '1px solid var(--xpx-border, #E5E7EB)',
          }}
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pt-6 pb-4 sm:px-7 sm:pt-7">
          <div
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-xpx-text mb-3"
            style={{
              background: 'rgba(37,99,235,0.08)',
              border: '1px solid rgba(37,99,235,0.14)',
            }}
          >
            <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--xpx-trust)' }} aria-hidden />
            XpressBNB trust facts
          </div>

          <h2 id={titleId} className="text-xl sm:text-2xl font-extrabold text-xpx-text tracking-tight pr-10">
            What is XpressBNB trust facts?
          </h2>
          <p className="mt-2 text-sm font-semibold text-xpx-muted">
            A numerical Xpress Score is not available yet.
          </p>
          <p className="mt-3 text-sm text-xpx-muted leading-relaxed">
            Listing facts show what the host has supplied. Photos and amenities do not establish completed stays, identity, or safety.
          </p>

          <ul className="mt-5 space-y-2.5">
            {FACTORS.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                style={{
                  background: 'var(--xpx-surface-light, #F8FAFC)',
                  border: '1px solid var(--xpx-border, #E5E7EB)',
                }}
              >
                <span
                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
                  style={{ background: 'rgba(37,99,235,0.08)' }}
                >
                  <Icon className="w-4 h-4 text-xpx-subtle" aria-hidden />
                </span>
                <span className="text-sm font-medium text-xpx-text">{label}</span>
              </li>
            ))}
          </ul>

          <p className="mt-5 text-sm font-semibold text-xpx-text">
            Paid plans and unverified allegations do not improve or reduce a trust score.
          </p>
          <p className="mt-2 text-xs text-xpx-subtle leading-relaxed">
            We need verified completed stays, review integrity and a published appeal process before introducing a score. Missing evidence does not mean fraud. Challenge inaccurate listing information at support@xpressbnb.com.
          </p>
        </div>

        <div
          className="shrink-0 px-5 py-4 sm:px-7 border-t"
          style={{
            borderColor: 'var(--xpx-border, #E5E7EB)',
            paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
          }}
        >
          <button
            type="button"
            onClick={dismiss}
            className="w-full h-11 rounded-xl text-sm font-bold text-white transition-opacity duration-150 hover:opacity-95"
            style={{ background: '#2563EB' }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
