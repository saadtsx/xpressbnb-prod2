import { useCallback } from 'react';
import { CookieConsentBanner } from '../CookieConsent';
import InstallAppPrompt from '../InstallAppPrompt';
import { useGuestOnboarding } from '../../contexts/GuestOnboardingContext';
import { scrollToId } from '../../lib/smoothScroll';
import { readScrollAnchorOffset } from '../../lib/layoutTokens';
import WelcomeOfferModal from './WelcomeOfferModal';

type GuestOnboardingOrchestratorProps = {
  hidden?: boolean;
};

/**
 * Single owner of guest first-visit overlays — cookie, welcome, install gating.
 * Location sheet is opened via context phase; NearbyLocationShell renders the sheet.
 */
export default function GuestOnboardingOrchestrator({
  hidden = false,
}: GuestOnboardingOrchestratorProps) {
  const {
    enabled,
    activeOverlay,
    canShowInstallPrompt,
    dismissWelcome,
  } = useGuestOnboarding();

  const handleWelcomeExplore = useCallback(() => {
    dismissWelcome();
    requestAnimationFrame(() => {
      scrollToId('listings', { offset: readScrollAnchorOffset(), duration: 1.05 });
    });
  }, [dismissWelcome]);

  // Homepage #how-it-works — product education walkthrough
  const handleHowItWorks = useCallback(() => {
    dismissWelcome();
    requestAnimationFrame(() => {
      scrollToId('how-it-works', { offset: readScrollAnchorOffset(), duration: 1.05 });
    });
  }, [dismissWelcome]);

  if (!enabled || hidden) {
    return (
      <>
        <CookieConsentBanner />
        <InstallAppPrompt hidden />
      </>
    );
  }

  return (
    <>
      <CookieConsentBanner orchestrated forceVisible={activeOverlay === 'cookie'} />
      <WelcomeOfferModal
        open={activeOverlay === 'welcome'}
        onExplore={handleWelcomeExplore}
        onHowItWorks={handleHowItWorks}
        onDismiss={dismissWelcome}
      />
      <InstallAppPrompt hidden={hidden} orchestrated forceVisible={canShowInstallPrompt} />
    </>
  );
}
