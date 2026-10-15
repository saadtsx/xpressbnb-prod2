import { useEffect, useState, useSyncExternalStore } from 'react';
import { X, Sparkles } from 'lucide-react';
import {
  hasSeenStayScoreEducation,
  markStayScoreEducationSeen,
  openStayScoreInfo,
  subscribeStayScoreInfoOpen,
} from '../lib/stayScoreEducation';
import {
  shouldShowCookieBanner,
  subscribeCookieConsent,
} from '../lib/cookieConsent';

const STABLE_DELAY_MS = 900;
const AUTO_HIDE_MS = 6000;

function useConsentAllowsEducation(): boolean {
  return useSyncExternalStore(
    subscribeCookieConsent,
    () => !shouldShowCookieBanner(),
    () => false,
  );
}

/**
 * One-time non-blocking tooltip — never shown while cookie consent is unresolved.
 */
export default function StayScoreEducationTooltip() {
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const consentAllows = useConsentAllowsEducation();

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    return subscribeStayScoreInfoOpen((open) => {
      if (open) {
        setVisible(false);
        markStayScoreEducationSeen();
      }
    });
  }, []);

  useEffect(() => {
    if (!ready || !consentAllows || hasSeenStayScoreEducation()) {
      setVisible(false);
      return;
    }

    let hideTimer: number | undefined;
    const showTimer = window.setTimeout(() => {
      if (!hasSeenStayScoreEducation() && consentAllows) {
        setVisible(true);
        hideTimer = window.setTimeout(() => {
          setVisible(false);
          markStayScoreEducationSeen();
        }, AUTO_HIDE_MS);
      }
    }, STABLE_DELAY_MS);

    return () => {
      window.clearTimeout(showTimer);
      if (hideTimer) window.clearTimeout(hideTimer);
    };
  }, [ready, consentAllows]);

  const dismiss = () => {
    setVisible(false);
    markStayScoreEducationSeen();
  };

  const onLearnMore = () => {
    setVisible(false);
    openStayScoreInfo();
  };

  if (!ready || !visible) return null;

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[90] w-[calc(100%-32px)] max-w-sm bottom-[calc(76px+env(safe-area-inset-bottom,0px))] sm:bottom-6"
      role="status"
      aria-live="polite"
    >
      <div
        className="relative flex items-start gap-2 rounded-2xl px-3.5 py-3"
        style={{
          background: 'var(--xpx-surface, #ffffff)',
          border: '1px solid var(--xpx-border, #E5E7EB)',
          boxShadow: '0 12px 40px rgba(15,23,42,0.14)',
        }}
      >
        <button
          type="button"
          onClick={onLearnMore}
          className="flex-1 min-w-0 text-left flex items-start gap-2"
        >
          <Sparkles className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--xpx-trust)' }} />
          <span className="text-sm font-semibold text-xpx-text leading-snug">
            Learn what listing facts can tell you
          </span>
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 p-1 rounded-full text-xpx-subtle hover:text-xpx-text"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
