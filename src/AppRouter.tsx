import { lazy, Suspense, useEffect, useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import NewHomepage from './components/NewHomepage';
import MobileBottomNav from './components/MobileBottomNav';
import NearbyLocationShell from './components/nearby/NearbyLocationShell';
import { GuestOnboardingProvider } from './contexts/GuestOnboardingContext';
import GuestOnboardingOrchestrator from './components/onboarding/GuestOnboardingOrchestrator';
import RouteFallback from './components/RouteFallback';
import { closeHomeOverlay, getHomeOverlayPage, navigateTo, XPX_NAVIGATE_EVENT } from './lib/navigation';
import { markIntroPreloaderSeen } from './lib/pwa';
import { loadPropertyPageModule } from './lib/propertyRouteChunk';
import { loadCityListingPageModule, loadRishikeshStaysPageModule } from './lib/listingRouteChunk';

const PropertyPage = lazy(() => loadPropertyPageModule());
const BookingConfirmationPage = lazy(() => import('./pages/BookingConfirmationPage'));
const TrackInquiryPage = lazy(() => import('./pages/TrackInquiryPage'));
const GuestWelcomePage = lazy(() => import('./pages/GuestWelcomePage'));
const CityListingPage = lazy(() => loadCityListingPageModule());
const RishikeshStaysPage = lazy(() => loadRishikeshStaysPageModule());
const ExploreCitiesPage = lazy(() => import('./pages/ExploreCitiesPage'));
const SavedListingsPage = lazy(() => import('./pages/SavedListingsPage'));
const AuthRouter = lazy(() => import('./pages/auth/AuthRouter'));
const OpsConsolePage = lazy(() => import('./pages/ops/OpsConsolePage'));
const AboutPage = lazy(() => import('./components/AboutPage'));
const BlogPage = lazy(() => import('./components/BlogPage'));
const PrivacyPolicyPage = lazy(() => import('./components/PrivacyPolicyPage'));
const TermsPage = lazy(() => import('./components/TermsPage'));
const StayScoreInfoSheet = lazy(() => import('./components/StayScoreInfoSheet'));
const StayScoreEducationTooltip = lazy(() => import('./components/StayScoreEducationTooltip'));
const HostDashboardLayout = lazy(() => import('./pages/host/HostDashboardLayout'));
const OverviewPage = lazy(() => import('./pages/host/OverviewPage'));
const PropertiesPage = lazy(() => import('./pages/host/PropertiesPage'));
const BookingsPage = lazy(() => import('./pages/host/BookingsPage'));
const SettingsPage = lazy(() => import('./pages/host/SettingsPage'));
const CalendarPage = lazy(() => import('./pages/host/CalendarPage'));
const CalendarSyncPage = lazy(() => import('./pages/host/CalendarSyncPage'));
const EarningsPage = lazy(() => import('./pages/host/EarningsPage'));
const AnalyticsPage = lazy(() => import('./pages/host/AnalyticsPage'));
const ReviewsPage = lazy(() => import('./pages/host/ReviewsPage'));
const BrandPage = lazy(() => import('./pages/host/BrandPage'));
const SubscriptionPage = lazy(() => import('./pages/host/SubscriptionPage'));
const SupportPage = lazy(() => import('./pages/host/SupportPage'));
const ImportPage = lazy(() => import('./pages/host/ImportPage'));

function syncLocation() {
  return {
    path: window.location.pathname,
    key: `${window.location.pathname}${window.location.search}`,
  };
}

export default function AppRouter() {
  const { user, host, sessionReady, hostLoading, signOut } = useAuth();
  const [currentPath, setCurrentPath] = useState(() => syncLocation().path);
  const [locationKey, setLocationKey] = useState(() => syncLocation().key);

  useEffect(() => {
    const syncFromLocation = () => {
      const loc = syncLocation();
      setCurrentPath(loc.path);
      setLocationKey(loc.key);
    };
    const handlePopState = () => syncFromLocation();
    const handleXpxNavigate = () => syncFromLocation();
    window.addEventListener('popstate', handlePopState);
    window.addEventListener(XPX_NAVIGATE_EVENT, handleXpxNavigate);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener(XPX_NAVIGATE_EVENT, handleXpxNavigate);
    };
  }, []);

  useEffect(() => {
    markIntroPreloaderSeen();
  }, []);

  useEffect(() => {
    if (sessionReady && user && host) {
      const isResettingPassword = currentPath.startsWith('/auth/reset-password');
      const isOpsConsole = currentPath.startsWith('/ops');
      const homeOverlay = getHomeOverlayPage();
      const shouldRedirectToDashboard =
        !isResettingPassword &&
        !isOpsConsole &&
        !homeOverlay &&
        (currentPath.startsWith('/auth') || currentPath === '/' || currentPath === '/host');
      if (shouldRedirectToDashboard) {
        const dashboardPath = `/host/${host.id}/dashboard/overview`;
        navigateTo(dashboardPath, { replace: true });
      }
    }
  }, [user, host, sessionReady, currentPath, locationKey]);

  const handleNavigate = (path: string) => {
    navigateTo(path);
  };

  const renderContent = () => {
    void locationKey;

    if (currentPath.startsWith('/auth')) {
      return <AuthRouter />;
    }

    if (currentPath.startsWith('/ops')) {
      return <OpsConsolePage onNavigate={handleNavigate} />;
    }

    if (currentPath.startsWith('/booking/')) {
      return <BookingConfirmationPage />;
    }

    if (currentPath.startsWith('/track-inquiry')) {
      return <TrackInquiryPage />;
    }

    if (currentPath.startsWith('/guest/welcome/')) {
      return <GuestWelcomePage />;
    }

    if (currentPath.startsWith('/inquiry/success/')) {
      return <GuestWelcomePage />;
    }

    if (currentPath.startsWith('/property/')) {
      return <PropertyPage />;
    }

    if (currentPath === '/explore' || currentPath === '/explore/') {
      return <ExploreCitiesPage onNavigate={handleNavigate} />;
    }

    if (currentPath === '/saved' || currentPath === '/saved/') {
      return <SavedListingsPage onNavigate={handleNavigate} />;
    }

    if (currentPath.startsWith('/stays/')) {
      const citySlug = currentPath.split('/stays/')[1].split('/')[0];
      if (citySlug === 'rishikesh') {
        return <RishikeshStaysPage />;
      }
      return <CityListingPage city={citySlug} />;
    }

    if (currentPath.startsWith('/host/')) {
      if (!sessionReady || hostLoading) {
        return <RouteFallback />;
      }
      if (user && host) {
        const match = currentPath.match(/\/host\/[^/]+\/dashboard\/(.+)/);
        const page = match ? match[1] : 'overview';

        const handleHostNavigate = (newPage: string) => {
          navigateTo(`/host/${host.id}/dashboard/${newPage}`);
        };

        return (
          <HostDashboardLayout currentPage={page} onNavigate={handleHostNavigate} hostId={host.id}>
            {page === 'overview' && <OverviewPage onNavigate={handleHostNavigate} />}
            {page === 'properties' && <PropertiesPage />}
            {page === 'calendar' && <CalendarPage hostId={host.id} />}
            {page === 'bookings' && <BookingsPage onNavigate={handleHostNavigate} />}
            {page === 'calendar-sync' && <CalendarSyncPage />}
            {page === 'import' && <ImportPage />}
            {page === 'earnings' && <EarningsPage />}
            {page === 'realtime' && <AnalyticsPage />}
            {page === 'reviews' && <ReviewsPage />}
            {page === 'brand' && <BrandPage />}
            {page === 'subscription' && <SubscriptionPage />}
            {page === 'settings' && <SettingsPage />}
            {page === 'support' && <SupportPage />}
          </HostDashboardLayout>
        );
      }
    }

    const homeOverlay = getHomeOverlayPage();
    if (homeOverlay === 'about') {
      return <AboutPage onClose={closeHomeOverlay} />;
    }
    if (homeOverlay === 'blog') {
      return <BlogPage onClose={closeHomeOverlay} />;
    }
    if (homeOverlay === 'privacy') {
      return <PrivacyPolicyPage onClose={closeHomeOverlay} />;
    }
    if (homeOverlay === 'terms') {
      return <TermsPage onClose={closeHomeOverlay} />;
    }

    if (sessionReady && user && !host && !hostLoading) {
      return <HostProfileError onRetry={() => window.location.reload()} onSignOut={signOut} />;
    }

    return <NewHomepage />;
  };

  const isGuestMarketplace =
    !currentPath.startsWith('/host/') &&
    !currentPath.startsWith('/ops') &&
    !currentPath.startsWith('/auth');

  return (
    <NearbyLocationShell autoPrompt={false}>
      <GuestOnboardingProvider enabled={isGuestMarketplace}>
        <Suspense fallback={<RouteFallback />}>
          <div
            key={locationKey}
            className={
              isGuestMarketplace && !getHomeOverlayPage() ? 'xpx-route-enter' : undefined
            }
          >
            {renderContent()}
          </div>
        </Suspense>
        <Suspense fallback={null}>
          <StayScoreInfoSheet />
          <StayScoreEducationTooltip />
        </Suspense>
        <GuestOnboardingOrchestrator
          hidden={
            currentPath.startsWith('/booking/') ||
            currentPath.startsWith('/inquiry/success/') ||
            currentPath.startsWith('/guest/welcome/') ||
            Boolean(getHomeOverlayPage())
          }
        />
        <MobileBottomNav currentPath={currentPath} onNavigate={handleNavigate} />
      </GuestOnboardingProvider>
    </NearbyLocationShell>
  );
}

function HostProfileError({
  onRetry,
  onSignOut,
}: {
  onRetry: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: 'var(--xpx-page, #F8FAFC)' }}>
      <div
        className="w-full max-w-md rounded-2xl p-8 text-center"
        style={{ background: 'var(--xpx-surface, #fff)', border: '1px solid var(--xpx-border, #e2e8f0)', boxShadow: '0 24px 64px rgba(15,23,42,0.10)' }}
      >
        <h1 className="text-xl font-extrabold text-xpx-text mb-2">We couldn&apos;t load your host profile</h1>
        <p className="text-sm text-xpx-muted mb-6 leading-relaxed">
          You&apos;re signed in, but your host dashboard didn&apos;t load. This is usually a temporary
          connection issue. Please retry — if it keeps happening, sign out and sign back in.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={onRetry}
            className="px-5 py-2.5 rounded-xl font-bold text-white transition-all"
            style={{ background: 'var(--xpx-warm, #50C878)', boxShadow: '0 6px 20px rgba(80,200,120,0.35)' }}
          >
            Retry
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="px-5 py-2.5 rounded-xl font-semibold text-xpx-text transition-colors"
            style={{ background: 'var(--xpx-surface-light, #f1f5f9)', border: '1px solid var(--xpx-border-strong, #cbd5e1)' }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
