import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  MapPin,
  CheckCircle,
  ShieldCheck,
  Share2,
  Copy,
  Check,
  Shield,
  Sparkles,
  Heart,
  Leaf,
  Clock,
  Cigarette,
  Music,
  PawPrint,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import type { Property } from '../lib/database.types';
import Header from '../components/Header';
import SEOHead from '../components/SEOHead';
import PropertyGallery from '../components/property/PropertyGallery';
import PropertyQuickInfo from '../components/property/PropertyQuickInfo';
import DeferredMount from '../components/property/DeferredMount';
import { logSupabaseError, supabase } from '../lib/supabase';
import { getPublicPropertyById } from '../lib/publicListings';
import { getPublicPropertyBrand, type PublicPropertyBrand } from '../lib/publicPropertyBrand';
import { getAmenityIcon, getAmenityCategoryName, listPropertyAmenities } from '../lib/amenities';
import { listPropertyImages } from '../lib/propertyImages';
import { generatePropertyStructuredData, generateBreadcrumbStructuredData } from '../lib/seo';
import { listFeaturedPromoCodes } from '../lib/offers';
import {
  inferStateFromCity,
  inferSubtitle,
  inferFeatureHighlights,
  WHY_LOVE_DEFAULTS,
  getNearbyPlaces,
  getHouseRules,
  getTrustPillsForProperty,
  getMapEmbedUrl,
  getMapLinkUrl,
} from '../config/propertyDefaults';
import { buildGuestPricingQuote, formatInr } from '../lib/guestPricingEngine';
import { GUEST_PRICING_TRIP_HINT } from '../lib/guestPricingCopy';
import { inquiryCtaLabel } from '../lib/inquiryCopy';
import { parseTripFromSearch } from '../lib/tripSearch';
import { navigateTo } from '../lib/navigation';
import { orchestratedScrollTo, orchestratedScrollToId } from '../lib/scrollOrchestrator';
import { scrollToElement } from '../lib/smoothScroll';
import { recordRecentlyViewed } from '../lib/recentlyViewed';
import { trackXpressEvent } from '../lib/analytics';
import { preloadPropertyHeroImage } from '../lib/propertyPrefetch';
import PropertySocialProofBand from '../components/property/PropertySocialProofBand';
import SaveListingButton from '../components/SaveListingButton';
import PropertyTrustLine from '../components/PropertyTrustLine';
import { useGuestOnboardingOptional } from '../contexts/GuestOnboardingContext';
import { scrollToId } from '../lib/smoothScroll';
import { snapshotFromProperty } from '../lib/savedListingsStorage';
import { useInViewport } from '../hooks/useGalleryMotion';
import {
  PropertyPageSkeletonBody,
  PropertySidebarSkeleton,
} from '../components/property/PropertyPageSkeleton';

/** Preload sidebar chunk + calendar when the booking column nears the viewport. */
const SIDEBAR_MOUNT_ROOT_MARGIN = '400px 0px';

const BookingForm = lazy(() => import('../components/BookingForm'));
const OfferModal = lazy(() => import('../components/OfferModal'));
const HostCard = lazy(() => import('../components/HostCard'));
const PropertyReviews = lazy(() => import('../components/property/PropertyReviews'));
const NearbyPropertiesSection = lazy(
  () => import('../components/property/NearbyPropertiesSection'),
);
const PropertySidebar = lazy(() => import('../components/property/PropertySidebar'));

function SidebarFallback() {
  return <PropertySidebarSkeleton className="min-h-[480px] lg:min-h-[520px]" />;
}

/**
 * PropertyPage — narrative reading flow:
 *   gallery → title + stats → about → amenities → host → location →
 *   confidence (trust + highlights + reviews) → house rules → similar stays.
 *
 * The right column hosts a sticky booking sidebar with the existing
 * BookingCalendar / BookingForm / OfferModal pipelines wired in.
 * PropertySidebar (and its calendar fetch) mount only when the booking
 * column nears the viewport or the user starts a booking flow — same gate
 * on desktop and mobile. SidebarFallback preserves layout until then.
 */
export default function PropertyPage() {
  const [property, setProperty] = useState<Property | null>(null);
  const [propertyBrand, setPropertyBrand] = useState<PublicPropertyBrand | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedCheckIn, setSelectedCheckIn] = useState<Date | null>(null);
  const [selectedCheckOut, setSelectedCheckOut] = useState<Date | null>(null);
  const [totalPrice, setTotalPrice] = useState(0);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [sidebarForced, setSidebarForced] = useState(false);
  const [numGuests, setNumGuests] = useState(2);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 1024,
  );
  const guestOnboarding = useGuestOnboardingOptional();

  const latchWelcomeSuppression = useCallback(() => {
    guestOnboarding?.setPropertyBookingActive(true);
  }, [guestOnboarding]);

  const sidebarRef = useRef<HTMLElement>(null);
  const sidebarNearView = useInViewport(sidebarRef, 0, SIDEBAR_MOUNT_ROOT_MARGIN);
  const mountSidebar = sidebarForced || sidebarNearView || showBooking || isMobileLayout;

  const tripFromSearch = useMemo(() => parseTripFromSearch(window.location.search), []);

  const hasValidDates = useMemo(() => {
    if (!selectedCheckIn || !selectedCheckOut) return false;
    return selectedCheckOut > selectedCheckIn;
  }, [selectedCheckIn, selectedCheckOut]);

  const bookingNights = useMemo(() => {
    if (!hasValidDates || !selectedCheckIn || !selectedCheckOut) return 0;
    return Math.max(
      1,
      Math.round(
        (selectedCheckOut.getTime() - selectedCheckIn.getTime()) / (1000 * 60 * 60 * 24),
      ),
    );
  }, [hasValidDates, selectedCheckIn, selectedCheckOut]);

  const tripQuote = useMemo(
    () =>
      property
        ? buildGuestPricingQuote({
            property,
            accommodationSubtotal: totalPrice,
            nights: bookingNights,
            numGuests,
          })
        : null,
    [totalPrice, bookingNights, numGuests, property],
  );

  useEffect(() => {
    const id = property?.id;
    setPropertyBrand(null);
    if (!id) return;
    let cancelled = false;
    void getPublicPropertyBrand(id).then((brand) => {
      if (!cancelled) setPropertyBrand(brand);
    });
    return () => {
      cancelled = true;
    };
  }, [property?.id]);

  useEffect(() => {
    if (!hasValidDates && showBooking) {
      setShowBooking(false);
    }
  }, [hasValidDates, showBooking]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const update = () => setIsMobileLayout(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!property) return;
    const cap = Math.max(1, property.max_guests || 1);
    const fromTrip = tripFromSearch.guests;
    if (fromTrip != null) {
      setNumGuests(Math.min(Math.max(1, fromTrip), cap));
    } else {
      setNumGuests((current) => Math.min(Math.max(1, current), cap));
    }
  }, [property, tripFromSearch.guests]);

  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/^\/property\/([a-f0-9-]+)$/);
    if (match) {
      loadProperty(match[1]);
    } else {
      navigateHome();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navigateHome = () => {
    navigateTo('/');
  };

  const navigateBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      navigateHome();
    }
  };

  const navigateToPage = (page: string) => {
    navigateTo(page);
  };

  const getOrCreateSessionId = () => {
    let sessionId = sessionStorage.getItem('visitor_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      sessionStorage.setItem('visitor_session_id', sessionId);
    }
    return sessionId;
  };

  const trackPropertyView = async (propertyId: string, listingType: string) => {
    if (listingType !== 'paid') return;
    try {
      const sessionId = getOrCreateSessionId();
      const viewedKey = `property_viewed_${propertyId}`;
      if (sessionStorage.getItem(viewedKey)) return;

      const { error } = await supabase.from('view_events').insert({
        entity_type: 'property',
        entity_id: propertyId,
        session_id: sessionId,
        referrer: document.referrer || null,
      });
      if (error) {
        logSupabaseError('Error tracking property view', error);
        return;
      }
      sessionStorage.setItem(viewedKey, 'true');
    } catch (error) {
      logSupabaseError('Error tracking property view', error);
    }
  };

  const loadProperty = async (propertyId: string) => {
    setLoading(true);
    setNotFound(false);
    setLoadError(false);
    try {
      const result = await getPublicPropertyById(propertyId);
      if (result.status === 'success') {
        const data = result.property;
        setProperty(data);
        recordRecentlyViewed(data);
        trackPropertyView(propertyId, data.listing_type ?? '');
        trackXpressEvent('property_view', {
          property_id: data.id,
          property_slug: data.slug ?? undefined,
          city: data.city,
        });
        preloadPropertyHeroImage(data.images);
        return;
      }

      if (result.status === 'not_found') {
        setNotFound(true);
        trackXpressEvent('property_load_failed', {
          property_id: propertyId,
          error_category: 'not_found',
        });
        return;
      }

      setLoadError(true);
    } catch (error) {
      logSupabaseError('Error loading property', error);
      setLoadError(true);
      trackXpressEvent('property_load_failed', {
        property_id: propertyId,
        error_category: 'load_failed',
      });
    } finally {
      setLoading(false);
    }
  };

  const getPropertyUrl = () => window.location.href;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(getPropertyUrl());
      setCopied(true);
      trackXpressEvent('share_clicked', { share_method: 'copy_link' });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      logSupabaseError('Failed to copy property link', err);
    }
  };

  const handleWhatsAppShare = () => {
    const text = `Check out this property: ${property?.title}\n${getPropertyUrl()}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');
    trackXpressEvent('share_clicked', { share_method: 'whatsapp' });
    setShowShareMenu(false);
  };

  const handleInstagramShare = () => {
    handleCopyLink();
    alert('Link copied! Open Instagram and paste the link in your story or post.');
    setShowShareMenu(false);
  };

  const handleDateRangeSelect = useCallback(
    (checkIn: Date | null, checkOut: Date | null, price: number) => {
      if (checkIn) {
        latchWelcomeSuppression();
      }
      setSelectedCheckIn(checkIn);
      setSelectedCheckOut(checkOut);
      setTotalPrice(price);
      if (checkIn && checkOut) {
        trackXpressEvent('booking_step_completed', { booking_step: 'dates' });
        requestAnimationFrame(() => {
          orchestratedScrollTo('booking_guests', { skipIfVisible: true, highlight: true });
        });
      }
    },
    [latchWelcomeSuppression],
  );

  // Smooth-scroll the user from the mobile bottom action bar down to the
  // booking sidebar so they immediately land on the calendar / Reserve
  // section. Falls back to no-op if the sidebar isn't yet rendered.
  const scrollToSidebar = useCallback(() => {
    scrollToElement(document.getElementById('booking-sidebar'), {
      offset: -80,
      duration: 0.35,
    });
  }, []);

  const scrollToBookingCalendar = useCallback(() => {
    setSidebarForced(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
          scrollToSidebar();
        }
        orchestratedScrollToId('booking-step-calendar', { highlight: true });
      });
    });
  }, [scrollToSidebar]);

  const handleCheckAvailability = useCallback(() => {
    latchWelcomeSuppression();
    setSidebarForced(true);
    if (property) {
      trackXpressEvent('check_availability_click', {
        property_id: property.id,
        property_slug: property.slug ?? undefined,
        city: property.city,
      });
      trackXpressEvent('booking_calendar_open', {
        property_id: property.id,
      });
    }
    scrollToBookingCalendar();
  }, [property, scrollToBookingCalendar, latchWelcomeSuppression]);

  const handleOpenBookingForm = useCallback(() => {
    if (!hasValidDates) return;
    latchWelcomeSuppression();
    setSidebarForced(true);
    if (property) {
      trackXpressEvent('request_to_book_click', {
        property_id: property.id,
        property_slug: property.slug ?? undefined,
        city: property.city,
        inquiry_type: 'book_pay_later',
      });
      trackXpressEvent('booking_form_started', {
        property_id: property.id,
        property_slug: property.slug ?? undefined,
        city: property.city,
        inquiry_type: 'book_pay_later',
        booking_step: 'contact',
      });
      const nearbySource = new URLSearchParams(window.location.search).get('nearby');
      if (nearbySource) {
        trackXpressEvent('nearby_booking_started', {
          property_id: property.id,
          nearby_source: nearbySource,
        });
      }
    }
    setShowBooking(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
          scrollToSidebar();
        }
        orchestratedScrollTo('booking_contact', { highlight: true, skipIfVisible: true });
      });
    });
  }, [hasValidDates, property, scrollToSidebar, latchWelcomeSuppression]);

  const handlePrimaryBookingCta = useCallback(() => {
    if (hasValidDates) {
      handleOpenBookingForm();
    } else {
      handleCheckAvailability();
    }
  }, [hasValidDates, handleOpenBookingForm, handleCheckAvailability]);

  const handleMobileBarCta = useCallback(() => {
    if (showBooking) {
      scrollToId('booking-step-submit', { offset: -100, duration: 0.8 });
      return;
    }
    handlePrimaryBookingCta();
  }, [showBooking, handlePrimaryBookingCta]);

  const handleEditDates = useCallback(() => {
    scrollToBookingCalendar();
  }, [scrollToBookingCalendar]);

  const handleGuestsChange = useCallback((guests: number) => {
    setNumGuests(guests);
    trackXpressEvent('booking_step_completed', { booking_step: 'guests' });
  }, []);

  useEffect(() => {
    if (!property || loading || !isMobileLayout) return;
    if (!tripFromSearch.checkin || !tripFromSearch.checkout) return;
    setSidebarForced(true);
    const timer = window.setTimeout(() => {
      scrollToBookingCalendar();
    }, 700);
    return () => window.clearTimeout(timer);
  }, [
    property,
    loading,
    isMobileLayout,
    tripFromSearch.checkin,
    tripFromSearch.checkout,
    scrollToBookingCalendar,
  ]);

  useEffect(() => {
    if (!property || loading) return;

    const sections: { id: string; depth: string }[] = [
      { id: 'about-section', depth: '25' },
      { id: 'amenities-section', depth: '50' },
      { id: 'confidence-heading', depth: '75' },
      { id: 'house-rules', depth: '100' },
    ];

    const seen = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const match = sections.find((s) => s.id === entry.target.id);
          if (!match || seen.has(match.depth)) continue;
          seen.add(match.depth);
          trackXpressEvent('property_scroll_depth', {
            property_id: property.id,
            scroll_depth: match.depth,
          });
        }
      },
      { threshold: 0.35 },
    );

    for (const { id } of sections) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [property, loading]);

  const renderBookingColumn = () => (
    <>
      {mountSidebar ? (
        <>
          <Suspense fallback={<SidebarFallback />}>
            <PropertySidebar
              property={property!}
              checkIn={selectedCheckIn}
              checkOut={selectedCheckOut}
              nightlyTotal={totalPrice}
              onDateRangeSelect={handleDateRangeSelect}
              numGuests={numGuests}
              onGuestsChange={handleGuestsChange}
              hasValidDates={hasValidDates}
              onCheckAvailability={handleCheckAvailability}
              onRequestToBook={handleOpenBookingForm}
              hideBookingCtas={showBooking}
              onMakeOffer={() => setShowOfferModal(true)}
              promoCode={featuredPromo?.code ?? null}
              promoLabel={featuredPromo?.label ?? null}
              initialCalendarCheckIn={tripFromSearch.checkin ?? null}
              initialCalendarCheckOut={tripFromSearch.checkout ?? null}
            />
          </Suspense>
          {showBooking && hasValidDates && (
            <div
              className="mt-5 rounded-3xl p-5 sm:p-6"
              style={{
                background: 'var(--xpx-surface)',
                border: '1px solid var(--xpx-border-strong)',
                boxShadow: 'var(--xpx-shadow-floating)',
              }}
            >
              <p className="xpx-eyebrow mb-3">Send inquiry</p>
              <Suspense
                fallback={
                  <div className="flex justify-center py-12" aria-hidden>
                    <div className="w-10 h-10 border-4 border-xpx-warm border-t-transparent rounded-full animate-spin" />
                  </div>
                }
              >
                <BookingForm
                  property={property!}
                  onSuccess={() => {
                    /* Success UI stays inline in BookingForm */
                  }}
                  checkInDate={selectedCheckIn}
                  checkOutDate={selectedCheckOut}
                  calculatedPrice={totalPrice}
                  numGuests={numGuests}
                  onEditDates={handleEditDates}
                />
              </Suspense>
            </div>
          )}
        </>
      ) : (
        <SidebarFallback />
      )}
    </>
  );

  if (loading) {
    return (
      <div className="xpx-page min-h-screen" role="status" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading property</span>
        <Header
          onAboutClick={() => navigateToPage('/?page=about')}
          onBlogClick={() => navigateToPage('/?page=blog')}
          onHostLoginClick={() => navigateToPage('/auth/login')}
        />
        <PropertyPageSkeletonBody />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="xpx-page">
        <Header
          onAboutClick={() => navigateToPage('/?page=about')}
          onBlogClick={() => navigateToPage('/?page=blog')}
          onHostLoginClick={() => navigateToPage('/auth/login')}
        />
        <div className="flex flex-col items-center justify-center h-96 px-4 text-center">
          <h1 className="text-lg font-bold text-xpx-text mb-2">We couldn&apos;t load this stay</h1>
          <p className="text-sm text-xpx-muted max-w-md mb-5">
            Please try again in a moment.
          </p>
          <button
            type="button"
            onClick={() => {
              const match = window.location.pathname.match(/^\/property\/([a-f0-9-]+)$/);
              if (match) void loadProperty(match[1]);
            }}
            className="px-5 py-2.5 rounded-full text-sm font-semibold text-white bg-xpx-warm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="xpx-page">
        <Header
          onAboutClick={() => navigateToPage('/?page=about')}
          onBlogClick={() => navigateToPage('/?page=blog')}
          onHostLoginClick={() => navigateToPage('/auth/login')}
        />
        <div className="flex flex-col items-center justify-center h-96 px-4 text-center">
          <h1 className="text-lg font-bold text-xpx-text mb-2">Stay not found</h1>
          <p className="text-sm text-xpx-muted max-w-md mb-5">
            This listing may have been removed or is no longer available.
          </p>
          <button
            type="button"
            onClick={navigateBack}
            className="px-5 py-2.5 rounded-full text-sm font-semibold text-white bg-xpx-warm"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  if (!property) return null;

  const propertyTitle = property.title;
  const stateLabel = property.state || inferStateFromCity(property.city);
  const propertyLocation = stateLabel ? `${property.city}, ${stateLabel}` : property.city;

  const subtitle = inferSubtitle(property);
  const featureHighlights = inferFeatureHighlights(property);
  const nearbyPlaces = getNearbyPlaces(property);
  const houseRules = getHouseRules();
  const featuredPromo = listFeaturedPromoCodes()[0];

  const basePrice = property.price_per_day || property.price_full_day || 0;
  const amenitiesAll = listPropertyAmenities(property.amenities);
  const amenitiesPreview = amenitiesAll.slice(0, 4);
  const moreAmenities = Math.max(0, amenitiesAll.length - amenitiesPreview.length);
  const descriptionLong = property.description.length > 320;
  const descriptionPreview = descriptionLong
    ? `${property.description.slice(0, 320).trimEnd()}…`
    : property.description;

  // Why-love icon resolution (we map config keys → Lucide components so
  // propertyDefaults.ts stays free of React imports / dependencies).
  const WhyLoveIcon: Record<(typeof WHY_LOVE_DEFAULTS)[number]['icon'], typeof Sparkles> = {
    sparkles: Sparkles,
    shield: Shield,
    leaf: Leaf,
    heart: Heart,
  };
  const HouseRuleIcon: Record<ReturnType<typeof getHouseRules>[number]['icon'], typeof Clock> = {
    clock: Clock,
    'no-smoking': Cigarette,
    'no-parties': Music,
    paw: PawPrint,
  };

  return (
    <div className="xpx-page">
      <SEOHead
        config={{
          title: `${propertyTitle} - Couple Friendly Stay in ${propertyLocation} | XpressBnB`,
          description: `Inquire about ${propertyTitle} in ${propertyLocation}. ${property.description.substring(0, 150)}. Couple-friendly, private stays — send an inquiry and hear from the host directly.`,
          keywords: `${propertyTitle}, couple friendly stay ${property.city}, hourly booking ${property.city}, couple safe hotel ${property.city}, private stay ${property.city}`,
          canonical: `https://xpressbnb.com/property/${property.id}`,
          ogTitle: `${propertyTitle} - ${propertyLocation}`,
          ogDescription: property.description.substring(0, 200),
          ogImage: listPropertyImages(property.images)[0],
          structuredData: {
            '@context': 'https://schema.org',
            '@graph': [
              generatePropertyStructuredData(property),
              generateBreadcrumbStructuredData([
                { name: 'Home', url: 'https://xpressbnb.com' },
                { name: property.city, url: `https://xpressbnb.com?location=${property.city}` },
                {
                  name: propertyTitle,
                  url: `https://xpressbnb.com/property/${property.id}`,
                },
              ]),
            ],
          },
        }}
      />

      {/* Solid frosted-white header — the gallery sits below it, so we don't
          want a transparent-on-top variant here. */}
      <Header
        onAboutClick={() => navigateToPage('/?page=about')}
        onBlogClick={() => navigateToPage('/?page=blog')}
        onHostLoginClick={() => navigateToPage('/auth/login')}
      />

      <main className="xpx-container pt-3 sm:pt-5 xpx-property-page-main flex flex-col">
        {/* Concept C chrome: breadcrumb/back on row 1, title + share/save on row 2 (desktop). */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 sm:gap-x-4 gap-y-3 sm:gap-y-4 items-start">
          <div className="col-start-1 row-start-1 min-w-0 lg:col-span-2">
          <button
            type="button"
            onClick={navigateBack}
            className="inline-flex items-center gap-1.5 -ml-1 px-2.5 py-2 rounded-full text-sm font-semibold text-xpx-muted hover:text-xpx-text hover:bg-slate-100 transition-colors lg:hidden"
            style={{ minHeight: 44 }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <nav aria-label="Breadcrumb" className="xpx-property-breadcrumb hidden lg:block min-w-0">
            <ol className="flex items-center gap-1.5 min-w-0">
              <li>
                <a href="/" onClick={(e) => { e.preventDefault(); navigateHome(); }}>
                  Home
                </a>
              </li>
              <li aria-hidden className="text-xpx-subtle">›</li>
              <li>
                <a
                  href={`/?location=${encodeURIComponent(property.city)}`}
                  onClick={(e) => {
                    e.preventDefault();
                    navigateTo(`/?location=${encodeURIComponent(property.city)}`);
                  }}
                >
                  {property.city}
                </a>
              </li>
              <li aria-hidden className="text-xpx-subtle">›</li>
              <li className="min-w-0">
                <span aria-current="page" className="block truncate">
                  {propertyTitle}
                </span>
              </li>
            </ol>
          </nav>
          </div>

          <div className="col-start-2 row-start-1 lg:row-start-2 flex items-center gap-1 pt-0.5">
            <SaveListingButton
              propertyId={property.id}
              variant="inline"
              getSnapshot={() => snapshotFromProperty(property)}
            />

            <div className="relative">
            <button
              type="button"
              onClick={() => setShowShareMenu((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-semibold text-xpx-text hover:bg-slate-100 transition-colors"
              style={{ minHeight: 44 }}
              aria-label="Share property"
              aria-expanded={showShareMenu}
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">Share</span>
            </button>

            {showShareMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowShareMenu(false)}
                  aria-hidden
                />
                <div
                  className="absolute right-0 mt-2 w-56 max-w-[calc(100vw-1.5rem)] rounded-xl py-2 z-50"
                  style={{
                    background: 'var(--xpx-surface)',
                    border: '1px solid var(--xpx-border)',
                    boxShadow: 'var(--xpx-shadow-overlay)',
                  }}
                >
                  <button
                    onClick={handleWhatsAppShare}
                    className="w-full px-4 py-3 text-left hover:bg-slate-100 transition-colors flex items-center gap-3"
                  >
                    <div className="w-9 h-9 bg-green-500 rounded-full flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-white"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                    </div>
                    <span className="font-medium text-xpx-text text-sm">Share on WhatsApp</span>
                  </button>
                  <button
                    onClick={handleInstagramShare}
                    className="w-full px-4 py-3 text-left hover:bg-slate-100 transition-colors flex items-center gap-3"
                  >
                    <div className="w-9 h-9 bg-gradient-to-br from-emerald-600 via-emerald-700 to-orange-500 rounded-full flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-white"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                      </svg>
                    </div>
                    <span className="font-medium text-xpx-text text-sm">Share on Instagram</span>
                  </button>
                  <button
                    onClick={handleCopyLink}
                    className="w-full px-4 py-3 text-left hover:bg-slate-100 transition-colors flex items-center gap-3"
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center"
                      style={{ background: 'var(--xpx-surface-elevated)' }}
                    >
                      {copied ? (
                        <Check className="w-4 h-4" style={{ color: 'var(--xpx-verified)' }} />
                      ) : (
                        <Copy className="w-4 h-4 text-xpx-text" />
                      )}
                    </div>
                    <span className="font-medium text-xpx-text text-sm">
                      {copied ? 'Link copied!' : 'Copy link'}
                    </span>
                  </button>
                </div>
              </>
            )}
            </div>
          </div>

        {/* Title block — above gallery (Concept C) */}
        <header className="col-start-1 row-start-2 col-span-2 lg:col-span-1 min-w-0">
            <div className="min-w-0">
              <h1 className="text-[1.65rem] sm:text-[1.75rem] lg:text-[2.125rem] font-extrabold tracking-tight text-xpx-text leading-[1.18]">
                {propertyTitle}
              </h1>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <PropertyTrustLine property={property} variant="page" />
                <span className="hidden sm:inline text-xpx-subtle" aria-hidden>
                  ·
                </span>
                <p className="inline-flex items-center gap-1.5 text-sm text-xpx-muted min-w-0">
                  <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--xpx-trust)' }} />
                  <span className="truncate">
                    {[property.city, stateLabel].filter(Boolean).join(', ')}
                  </span>
                </p>
              </div>
              {propertyBrand && (
                <p className="mt-1.5 text-sm text-xpx-muted">
                  Operated by{' '}
                  <span className="font-semibold text-xpx-text">{propertyBrand.name}</span>
                </p>
              )}
              {(subtitle || property.is_verified) && (
                <div className="mt-2 flex items-center gap-2.5 flex-wrap">
                  {subtitle && (
                    <p className="text-sm text-xpx-muted">{subtitle}</p>
                  )}
                  {property.is_verified && (
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide"
                      style={{
                        background: 'var(--xpx-verified-bg)',
                        color: 'var(--xpx-verified)',
                        border: '1px solid var(--xpx-accent-a28)',
                      }}
                      title="Host has an active paid plan on XpressBnB — badge on this listing."
                    >
                      <CheckCircle className="w-3.5 h-3.5" fill="currentColor" />
                      Premium listing
                    </span>
                  )}
                </div>
              )}
            </div>
          <PropertySocialProofBand
            propertyId={property.id}
            city={property.city}
            variant="whisper"
          />
        </header>
        </div>

        {/* Bento gallery */}
        <div className="mt-4 sm:mt-5">
          <PropertyGallery images={property.images ?? []} title={propertyTitle} />
        </div>

        {/* Two-column content + sticky sidebar */}
        <div className="mt-6 sm:mt-8 lg:mt-10 grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] xl:grid-cols-[minmax(0,1fr)_400px] 2xl:grid-cols-[minmax(0,1fr)_420px] gap-8 lg:gap-10 xl:gap-12 items-start">
          <div className="min-w-0 space-y-8 sm:space-y-10">
            <PropertyQuickInfo property={property} />

            <DeferredMount rootMargin="400px 0px">
            {/* About + amenities */}
            <section id="about-section">
              <h2 className="xpx-property-section-h2">About this space</h2>
              <p className="mt-4 text-[15px] sm:text-base text-xpx-muted leading-relaxed whitespace-pre-line">
                {aboutExpanded ? property.description : descriptionPreview}
              </p>
              {descriptionLong && (
                <button
                  type="button"
                  onClick={() => setAboutExpanded((v) => !v)}
                  className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-xpx-text underline underline-offset-4 hover:opacity-80"
                >
                  {aboutExpanded ? 'Show less' : 'Show more'}
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 motion-reduce:transition-none ${
                      aboutExpanded ? 'rotate-180' : ''
                    }`}
                    aria-hidden
                  />
                </button>
              )}
              {featureHighlights.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {featureHighlights.map((h) => (
                    <span
                      key={h}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold"
                      style={{
                        background: 'var(--xpx-accent-a12)',
                        color: 'var(--xpx-warm-dark)',
                        border: '1px solid var(--xpx-accent-a32)',
                      }}
                    >
                      <Sparkles className="w-3 h-3" />
                      {h}
                    </span>
                  ))}
                </div>
              )}
            </section>

            {amenitiesAll.length > 0 && (
              <section id="amenities-section">
                <div className="flex items-end justify-between gap-3 flex-wrap">
                  <h2 className="xpx-property-section-h2">What this place offers</h2>
                  {moreAmenities > 0 && (
                    <a
                      href="#all-amenities"
                      className="inline-flex items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline"
                      style={{ color: 'var(--xpx-warm-dark)' }}
                    >
                      View all amenities
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {amenitiesPreview.map((amenity) => {
                    const Icon = getAmenityIcon(amenity);
                    const category = getAmenityCategoryName(amenity);
                    return (
                      <div
                        key={amenity}
                        className="xpx-property-amenity-card rounded-xl px-4 py-3.5 flex items-start gap-3"
                        style={{
                          background: 'var(--xpx-surface)',
                          border: '1px solid var(--xpx-border)',
                        }}
                      >
                        <Icon
                          className="w-5 h-5 shrink-0 mt-0.5"
                          style={{ color: 'var(--xpx-warm-dark)' }}
                          aria-hidden
                        />
                        <div className="min-w-0">
                          <span className="text-sm text-xpx-text font-semibold block truncate">
                            {amenity}
                          </span>
                          <span className="text-xs text-xpx-muted block truncate mt-0.5">
                            {category}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {moreAmenities > 0 && (
                  <details
                    id="all-amenities"
                    className="mt-4 group rounded-2xl px-4 py-3"
                    style={{
                      background: 'var(--xpx-surface-light)',
                      border: '1px solid var(--xpx-border)',
                    }}
                    onToggle={(e) => {
                      if ((e.target as HTMLDetailsElement).open) {
                        trackXpressEvent('amenities_toggled', {
                          property_id: property.id,
                          action: (e.target as HTMLDetailsElement).open ? 'expand' : 'collapse',
                        });
                      }
                    }}
                  >
                    <summary className="cursor-pointer text-sm font-semibold text-xpx-text inline-flex items-center gap-2 list-none">
                      <span>Show all {amenitiesAll.length} amenities</span>
                      <span
                        className="ml-auto transition-transform group-open:rotate-180 text-xpx-muted text-xs"
                        aria-hidden
                      >
                        ▾
                      </span>
                    </summary>
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {amenitiesAll.map((amenity) => {
                        const Icon = getAmenityIcon(amenity);
                        return (
                          <div
                            key={`all-${amenity}`}
                            className="flex items-center gap-2 text-xs text-xpx-text"
                          >
                            <Icon className="w-3.5 h-3.5 text-xpx-subtle" />
                            <span>{amenity}</span>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                )}
              </section>
            )}

            <section>
              <h2 className="xpx-property-section-h2 mb-5">Meet your host</h2>
              <Suspense fallback={null}>
                <HostCard
                  hostId={property.host_id}
                  fallbackCity={property.city}
                  propertyTitle={property.title}
                  onRequestToBook={handlePrimaryBookingCta}
                />
              </Suspense>
            </section>

            <section>
              <h2 className="xpx-property-section-h2">Location &amp; nearby insights</h2>
              <div className="mt-5 grid lg:grid-cols-[1fr_320px] gap-4 sm:gap-5 items-stretch">
                <div
                  className="relative rounded-2xl overflow-hidden aspect-[16/10] lg:aspect-auto lg:min-h-[340px]"
                  style={{
                    background: 'var(--xpx-surface-light)',
                    border: '1px solid var(--xpx-border)',
                  }}
                >
                  <iframe
                    title={`Map of ${propertyTitle}`}
                    src={getMapEmbedUrl(property)}
                    className="absolute inset-0 w-full h-full"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                    style={{ border: 0 }}
                  />
                </div>
                <aside
                  className="rounded-2xl p-4 sm:p-5"
                  style={{
                    background: 'var(--xpx-surface)',
                    border: '1px solid var(--xpx-border)',
                  }}
                >
                  <p className="xpx-eyebrow mb-3">Around the property</p>
                  <ul className="space-y-3">
                    {nearbyPlaces.slice(0, 5).map((place) => (
                      <li
                        key={place.name}
                        className="flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-xpx-text truncate">
                            {place.name}
                          </p>
                          <p className="text-xs text-xpx-muted truncate">{place.category}</p>
                        </div>
                        <span className="text-xs font-bold text-xpx-text tabular-nums shrink-0">
                          {place.distance}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <a
                    href={getMapLinkUrl(property)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold text-white transition-transform active:scale-[0.97]"
                    style={{
                      background: 'var(--accent)',
                      boxShadow: 'var(--xpx-cta-glow)',
                    }}
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    View on Google Maps
                  </a>
                </aside>
              </div>
            </section>

            <section aria-labelledby="confidence-heading">
              <h2 id="confidence-heading" className="xpx-property-section-h2">
                Why book with confidence
              </h2>
              <ul className="mt-4 flex flex-col gap-3 sm:gap-2.5">
                {getTrustPillsForProperty(property).map((pill) => (
                  <li key={pill.title} className="flex items-start gap-2.5 text-sm">
                    {pill.tone === 'verified' ? (
                      <CheckCircle
                        className="w-4 h-4 shrink-0 mt-0.5"
                        style={{ color: 'var(--xpx-verified)' }}
                      />
                    ) : (
                      <ShieldCheck
                        className="w-4 h-4 shrink-0 mt-0.5"
                        style={{ color: 'var(--xpx-trust)' }}
                      />
                    )}
                    <span>
                      <span className="font-semibold text-xpx-text">{pill.title}</span>
                      <span className="text-xpx-muted"> — {pill.subtitle}</span>
                    </span>
                  </li>
                ))}
              </ul>

              <h3 className="mt-8 text-lg sm:text-xl font-extrabold tracking-tight text-xpx-text">
                Why guests love staying here
              </h3>
              <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                {WHY_LOVE_DEFAULTS.map((item) => {
                  const Icon = WhyLoveIcon[item.icon];
                  return (
                    <div key={item.title} className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 shrink-0" style={{ color: 'var(--accent)' }} />
                        <h4 className="text-sm font-bold text-xpx-text leading-snug">
                          {item.title}
                        </h4>
                      </div>
                      <p className="mt-1 text-xs sm:text-[13px] text-xpx-muted leading-relaxed">
                        {item.subcopy}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-8">
                <Suspense fallback={null}>
                  <PropertyReviews property={property} />
                </Suspense>
              </div>
            </section>

            <section id="house-rules">
              <h2 className="xpx-property-section-h2">House rules</h2>
              <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                {houseRules.map((rule) => {
                  const Icon = HouseRuleIcon[rule.icon];
                  return (
                    <div
                      key={rule.label}
                      className="rounded-2xl p-4 flex items-start gap-3"
                      style={{
                        background: 'var(--xpx-surface)',
                        border: '1px solid var(--xpx-border)',
                      }}
                    >
                      <div
                        className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5"
                        style={{
                          background: 'var(--xpx-surface-light)',
                          color: 'var(--xpx-text)',
                          border: '1px solid var(--xpx-border)',
                        }}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-xpx-text leading-snug">
                          {rule.label}
                        </p>
                        <p className="text-xs text-xpx-muted leading-snug mt-0.5">
                          {rule.detail}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <Suspense fallback={null}>
              <NearbyPropertiesSection originProperty={property} />
            </Suspense>
            </DeferredMount>
          </div>

          {/* Sticky booking sidebar (desktop) / below main content on mobile. */}
          <aside
            ref={sidebarRef}
            id="booking-sidebar"
            className={`xpx-booking-sidebar-sticky scroll-mt-24 lg:self-start${
              showBooking ? ' pb-28 lg:pb-0' : ''
            }`}
          >
            {renderBookingColumn()}
          </aside>
        </div>
      </main>

      {/* Mobile-only fixed bottom action bar — replaces the global
          MobileBottomNav (which auto-hides on /property/* routes). Keeps
          the user one tap away from the booking sidebar at all times. */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 xpx-mobile-booking-bar xpx-mobile-booking-bar-surface">
        <div className="xpx-container pt-3 pb-0 flex items-center justify-between gap-3">
          <div className="min-w-0">
            {hasValidDates ? (
              <>
                <div className="flex items-baseline gap-1 flex-wrap">
                  <span className="text-lg font-extrabold text-xpx-text tabular-nums">
                    {formatInr(tripQuote?.guestTotal ?? 0)}
                  </span>
                  <span className="text-xs text-xpx-muted">total</span>
                </div>
                <p className="text-xs text-xpx-subtle leading-snug">
                  {GUEST_PRICING_TRIP_HINT(bookingNights)}
                </p>
              </>
            ) : (
              <>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-extrabold text-xpx-text tabular-nums">
                    ₹{basePrice.toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs text-xpx-muted">/ night</span>
                </div>
                <p className="text-xs text-xpx-subtle leading-snug">
                  Starting price · host sets the rate
                </p>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={handleMobileBarCta}
            className="xpx-btn-primary shrink-0 rounded-2xl px-5 py-3 text-sm min-h-[48px] min-w-[44px] touch-manipulation"
          >
            {showBooking
              ? 'Finish inquiry'
              : hasValidDates
                ? inquiryCtaLabel('property_with_dates')
                : inquiryCtaLabel('property_no_dates')}
          </button>
        </div>
      </div>

      {showOfferModal && property && (
        <Suspense fallback={null}>
          <OfferModal
            open={showOfferModal}
            onClose={() => setShowOfferModal(false)}
            property={property}
            checkInDate={selectedCheckIn}
            checkOutDate={selectedCheckOut}
          />
        </Suspense>
      )}
    </div>
  );
}
