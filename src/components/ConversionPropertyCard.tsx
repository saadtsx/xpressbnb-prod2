/**
 * MARKETPLACE FROZEN (Phase MP-Freeze)
 *
 * Comparison-first property card for browsing surfaces only:
 * homepage featured, city listings, saved, map discovery, search results.
 *
 * Do NOT convert this into editorial UI. Do NOT remove price, save, host,
 * specs, or stay score. Editorial discovery on `/property/*` uses
 * `components/property/editorial/DiscoveryPropertyWindow` instead.
 *
 * @see components/marketplace/README.md
 */
import { memo, useEffect, useRef, useState } from 'react';
import type { Property } from '../lib/database.types';
import { computeXpressbnbStayScore } from '../lib/xpressbnbStayScore';
import { openStayScoreInfo } from '../lib/stayScoreEducation';
import SaveListingButton from './SaveListingButton';
import PropertyCardHostRow from './PropertyCardHostRow';
import PropertyCardGallery from './PropertyCardGallery';
import './glass/cardGlass.css';
import { snapshotFromProperty } from '../lib/savedListingsStorage';
import { listPropertyImages } from '../lib/propertyImages';
import { trackXpressEvent } from '../lib/analytics';
import { useGuestOnboardingOptional } from '../contexts/GuestOnboardingContext';
import { bucketDistanceKm } from '../lib/nearbyDistanceCopy';
import {
  prefetchPropertyOnInteraction,
  prefetchPropertyOnViewport,
} from '../lib/propertyPrefetch';
import {
  ImageGalleryIcon,
  LocationPinIcon,
  GuestsIcon,
  BedroomIcon,
  BathroomIcon,
  StarOutlineIcon,
  InfoCircleIcon,
} from './icons/PropertyCardIcons';

interface ConversionPropertyCardProps {
  property: Property;
  /** Preserve hero search (?checkin=&checkout=&guests=) when opening the listing */
  tripQuery?: string;
  /** Optional layout classes (e.g. homepage carousel snap widths) */
  className?: string;
  /** Distance from user when shown in nearby context */
  nearbyDistanceKm?: number;
  /** Analytics source for nearby funnel */
  nearbySource?: string;
  /** When carousel swipe is active, block card navigation */
  carouselSuppressClickRef?: React.MutableRefObject<boolean>;
}

function countImages(images: Property['images']): number {
  return listPropertyImages(images).length;
}

function formatLocation(city: string, state: string): string {
  const c = city?.trim() ?? '';
  const s = state?.trim() ?? '';
  if (c && s) return `${c}, ${s}`;
  return c || s || 'Location coming soon';
}

/** Compact host-listed price chip — stays inside the image, no flip gimmick. */
function HostPriceTag({ price }: { price: string }) {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[calc(100%-5.5rem)]">
      <div className="xpx-card-glass xpx-card-glass-price rounded-xl px-2.5 py-2">
        <p className="leading-none whitespace-nowrap">
          <span className="text-[15px] font-bold tabular-nums text-[#111827]">₹{price}</span>
          <span className="text-[11px] font-medium text-[#46594f]"> / night</span>
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          <span
            className="inline-block h-px w-5 shrink-0"
            style={{
              background:
                'repeating-linear-gradient(90deg, #d1d5db 0, #d1d5db 2px, transparent 2px, transparent 4px)',
            }}
            aria-hidden
          />
          <span className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[#046348]">
            Host listed
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Marketplace property card — city listings, saved page, featured carousel.
 */
export default memo(function ConversionPropertyCard({
  property,
  tripQuery = '',
  className = '',
  nearbyDistanceKm,
  nearbySource,
  carouselSuppressClickRef,
}: ConversionPropertyCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const swipeRef = useRef(false);
  const [isHovered, setIsHovered] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const onboarding = useGuestOnboardingOptional();

  useEffect(() => {
    const node = cardRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          prefetchPropertyOnViewport();
        }
      },
      { rootMargin: '0px', threshold: [0, 0.55, 0.85] },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [property.id]);

  const handlePrefetchInteraction = () => {
    prefetchPropertyOnInteraction(property);
  };

  const handleClick = () => {
    if (carouselSuppressClickRef?.current) {
      carouselSuppressClickRef.current = false;
      return;
    }
    if (swipeRef.current) {
      swipeRef.current = false;
      return;
    }
    trackXpressEvent('property_card_click', {
      property_id: property.id,
      property_slug: property.slug ?? undefined,
      city: property.city,
      ...(nearbyDistanceKm != null
        ? {
            nearby_source: nearbySource ?? 'nearby',
            distance_km_bucket: bucketDistanceKm(nearbyDistanceKm),
          }
        : {}),
    });
    onboarding?.recordListingEngagement();
    if (nearbyDistanceKm != null) {
      trackXpressEvent('nearby_card_clicked', {
        property_id: property.id,
        property_slug: property.slug ?? undefined,
        city: property.city,
        nearby_source: nearbySource ?? 'nearby',
        distance_km_bucket: bucketDistanceKm(nearbyDistanceKm),
      });
    }
    const q = tripQuery.startsWith('?') ? tripQuery : tripQuery ? `?${tripQuery}` : '';
    const nearbyParam =
      nearbyDistanceKm != null
        ? `${q ? '&' : '?'}nearby=${encodeURIComponent(nearbySource ?? 'nearby')}`
        : '';
    window.history.pushState({}, '', `/property/${property.id}${q}${nearbyParam}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const price = (property.price_per_day || property.price_full_day || 0).toLocaleString('en-IN');
  const imageCount = countImages(property.images);
  const stayScore = computeXpressbnbStayScore(property);
  const locationLabel = formatLocation(property.city, property.state);
  const guests = property.max_guests ?? 0;
  const bedrooms = property.bedrooms ?? 0;
  const bathrooms = property.bathrooms ?? 0;

  const openStayScore = (e: React.MouseEvent) => {
    e.stopPropagation();
    openStayScoreInfo();
  };

  return (
    // div (not article) — role="link" is not an allowed ARIA role on <article>
    <div
      ref={cardRef}
      onClick={handleClick}
      onMouseEnter={() => {
        setIsHovered(true);
        handlePrefetchInteraction();
      }}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handlePrefetchInteraction}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && e.key === 'Enter') handleClick();
      }}
      className={`xpx-property-card group flex h-full w-full max-w-[380px] cursor-pointer flex-col overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[#059669] motion-reduce:transition-none ${className}`}
    >
      <PropertyCardGallery
        images={property.images}
        alt={property.title}
        isCardHovered={isHovered}
        onIndexChange={setGalleryIndex}
        onSwipe={() => {
          swipeRef.current = true;
        }}
      >
        <SaveListingButton
          propertyId={property.id}
          getSnapshot={() => snapshotFromProperty(property)}
          presentation="glass"
        />

        <HostPriceTag price={price} />

        {imageCount > 0 && (
          <div
            className="xpx-card-glass xpx-card-glass-counter pointer-events-none absolute bottom-3 right-3 z-10 inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-semibold"
            aria-label={`Photo ${Math.min(galleryIndex + 1, imageCount)} of ${imageCount}`}
          >
            <ImageGalleryIcon className="h-3.5 w-3.5" />
            <span className="tabular-nums">
              {Math.min(galleryIndex + 1, imageCount)} / {imageCount}
            </span>
          </div>
        )}
      </PropertyCardGallery>

      <div className="xpx-property-card-body">
        <h3 className="xpx-property-card-zone-title" title={property.title}>
          {property.title}
        </h3>

        <div className="xpx-property-card-zone-location" title={locationLabel}>
          <LocationPinIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="xpx-property-card-zone-location__text">{locationLabel}</span>
        </div>

        <div className="xpx-property-card-zone-host">
          <PropertyCardHostRow hostId={property.host_id} propertyVerified={property.is_verified} />
        </div>

        <div className="xpx-property-card-zone-meta">
          <div className="xpx-property-card-zone-meta__grid">
            <SpecCell icon={<GuestsIcon className="h-[18px] w-[18px]" />} value={guests} label="Guests" />
            <SpecCell icon={<BedroomIcon className="h-[18px] w-[18px]" />} value={bedrooms} label="Bedroom" />
            <SpecCell icon={<BathroomIcon className="h-[18px] w-[18px]" />} value={bathrooms} label="Bathroom" />
          </div>
        </div>

        <div className="xpx-property-card-zone-score">
          <button
            type="button"
            onClick={openStayScore}
            className="xpx-property-card-zone-score__btn transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]"
            aria-label={stayScore.label}
          >
            <StarOutlineIcon className="h-4 w-4 shrink-0 text-[#059669]" aria-hidden />
            <span className="xpx-property-card-zone-score__label" title={stayScore.label}>
              {stayScore.label}
            </span>
            <InfoCircleIcon className="h-4 w-4 shrink-0 text-[#6B7280]" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
});

function SpecCell({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  const specLabel = `${value} ${label}`;
  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-0.5 px-1 text-center"
      title={specLabel}
    >
      <span className="text-[#6B7280]" aria-hidden>
        {icon}
      </span>
      <span className="text-sm font-bold tabular-nums leading-none text-[#111827]">{value}</span>
      <span className="truncate max-w-full text-xs leading-none text-[#6B7280]">{label}</span>
    </div>
  );
}
