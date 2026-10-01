import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Property } from '../lib/database.types';
import ConversionPropertyCard from './ConversionPropertyCard';
import HomepageStaysRail from './homepage/HomepageStaysRail';
import { useInViewport, usePrefersReducedMotion } from '../hooks/useGalleryMotion';

const MOBILE_AUTOPLAY_MS = 4000;
const TRANSITION_MS = 600;
const RESUME_AFTER_MS = 5000;
const SWIPE_THRESHOLD_PX = 40;
const VELOCITY_THRESHOLD = 0.35;
const GAP_PX = 16;
const MOBILE_PEEK_RATIO = 0.85;
const EASE_OUT = 'cubic-bezier(0.25, 0.1, 0.25, 1)';

type VelocitySample = { x: number; t: number };

function visibleSlideCount(containerWidth: number): number {
  if (containerWidth >= 1280) return 4;
  if (containerWidth >= 1024) return 3;
  if (containerWidth >= 768) return 2;
  return 1;
}

function slideWidthForContainer(containerWidth: number, visible: number): number {
  if (visible <= 1) {
    return Math.min(380, Math.round(containerWidth * MOBILE_PEEK_RATIO));
  }
  const totalGap = GAP_PX * (visible - 1);
  return Math.min(380, Math.floor((containerWidth - totalGap) / visible));
}

const CarouselSlide = memo(function CarouselSlide({
  property,
  width,
  hidden,
  nearbyDistanceKm,
  carouselSuppressClickRef,
}: {
  property: Property;
  width: number;
  hidden: boolean;
  nearbyDistanceKm?: number;
  carouselSuppressClickRef?: React.MutableRefObject<boolean>;
}) {
  return (
    <div className="flex h-full shrink-0" style={{ width }} aria-hidden={hidden}>
      <ConversionPropertyCard
        property={property}
        className="mx-0 h-full w-full max-w-none md:mx-0"
        nearbyDistanceKm={nearbyDistanceKm}
        nearbySource="nearby_carousel"
        carouselSuppressClickRef={carouselSuppressClickRef}
      />
    </div>
  );
});

type FeaturedStaysCarouselProps = {
  properties: Property[];
  /** Approved homepage: three desktop cards, one full-width mobile card. */
  presentation?: 'default' | 'homepage';
  /** Optional distance map for nearby personalization */
  distanceByPropertyId?: Record<string, number>;
};

/**
 * GPU-accelerated Featured Stays carousel — VRBO-level mobile UX.
 * Mobile: peek layout, velocity swipe, idle autoplay. Desktop: manual arrows.
 */
export default function FeaturedStaysCarousel(props: FeaturedStaysCarouselProps) {
  return props.presentation === 'homepage' ? <HomepageStaysRail properties={props.properties} distanceByPropertyId={props.distanceByPropertyId} /> : <LegacyFeaturedStaysCarousel {...props} />;
}

function LegacyFeaturedStaysCarousel({
  properties,
  distanceByPropertyId,
}: FeaturedStaysCarouselProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resumeTimerRef = useRef<number | null>(null);
  const autoplayTimerRef = useRef<number | null>(null);

  const count = properties.length;
  const loopEnabled = count > 1;

  const extendedSlides = useMemo(() => {
    if (!loopEnabled) return properties;
    return [properties[count - 1], ...properties, properties[0]];
  }, [properties, count, loopEnabled]);

  const [trackIndex, setTrackIndex] = useState(loopEnabled ? 1 : 0);
  const [enableTransition, setEnableTransition] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  const dragStartX = useRef(0);
  const dragStartY = useRef(0);
  const dragAxisLock = useRef<'x' | 'y' | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const pointerCapturedRef = useRef(false);
  const dragIntentRef = useRef(false);
  const velocitySamples = useRef<VelocitySample[]>([]);

  const prefersReducedMotion = usePrefersReducedMotion();
  const inViewport = useInViewport(rootRef, 0.25);

  const visible = visibleSlideCount(containerWidth || 360);
  const isMobileLayout = visible <= 1;
  /** Desktop uses arrows only — pointer capture on the track blocks card clicks. */
  const pointerDragEnabled = isMobileLayout && count > 1;
  const slideWidth = containerWidth > 0 ? slideWidthForContainer(containerWidth, visible) : 306;
  const stride = slideWidth + GAP_PX;

  const logicalIndex = loopEnabled
    ? (trackIndex - 1 + count) % count
    : Math.min(trackIndex, Math.max(count - 1, 0));

  const baseOffset = -trackIndex * stride;
  const translateX = baseOffset + dragOffset;

  const clearResumeTimer = useCallback(() => {
    if (resumeTimerRef.current != null) {
      window.clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  }, []);

  const clearAutoplayTimer = useCallback(() => {
    if (autoplayTimerRef.current != null) {
      window.clearInterval(autoplayTimerRef.current);
      autoplayTimerRef.current = null;
    }
  }, []);

  const pauseInteraction = useCallback(() => {
    setIsPaused(true);
    clearResumeTimer();
  }, [clearResumeTimer]);

  const scheduleResume = useCallback(() => {
    clearResumeTimer();
    resumeTimerRef.current = window.setTimeout(() => {
      setIsPaused(false);
    }, RESUME_AFTER_MS);
  }, [clearResumeTimer]);

  const goNext = useCallback(() => {
    if (!loopEnabled) {
      setTrackIndex((i) => Math.min(i + 1, count - 1));
      return;
    }
    setEnableTransition(true);
    setTrackIndex((i) => i + 1);
  }, [count, loopEnabled]);

  const goPrev = useCallback(() => {
    if (!loopEnabled) {
      setTrackIndex((i) => Math.max(i - 1, 0));
      return;
    }
    setEnableTransition(true);
    setTrackIndex((i) => i - 1);
  }, [loopEnabled]);

  const goNextRef = useRef(goNext);
  goNextRef.current = goNext;

  const handleTransitionEnd = useCallback(() => {
    if (!loopEnabled) return;
    if (trackIndex === count + 1) {
      setEnableTransition(false);
      setTrackIndex(1);
    } else if (trackIndex === 0) {
      setEnableTransition(false);
      setTrackIndex(count);
    }
  }, [count, loopEnabled, trackIndex]);

  useEffect(() => {
    setTrackIndex(loopEnabled ? 1 : 0);
    setEnableTransition(false);
  }, [properties, loopEnabled]);

  useEffect(() => {
    if (!enableTransition) {
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setEnableTransition(true));
      });
      return () => cancelAnimationFrame(id);
    }
  }, [enableTransition]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const observer = new ResizeObserver((entries) => {
      setContainerWidth(entries[0]?.contentRect.width ?? 0);
    });
    observer.observe(node);
    setContainerWidth(node.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    clearAutoplayTimer();
    if (
      !isMobileLayout ||
      !inViewport ||
      prefersReducedMotion ||
      isPaused ||
      isDragging ||
      count <= 1
    ) {
      return;
    }

    autoplayTimerRef.current = window.setInterval(() => {
      goNextRef.current();
    }, MOBILE_AUTOPLAY_MS);

    return clearAutoplayTimer;
  }, [
    clearAutoplayTimer,
    count,
    inViewport,
    isDragging,
    isMobileLayout,
    isPaused,
    prefersReducedMotion,
  ]);

  useEffect(
    () => () => {
      clearAutoplayTimer();
      clearResumeTimer();
    },
    [clearAutoplayTimer, clearResumeTimer],
  );

  const computeVelocity = (): number => {
    const samples = velocitySamples.current;
    if (samples.length < 2) return 0;
    const first = samples[0];
    const last = samples[samples.length - 1];
    const dt = last.t - first.t;
    if (dt <= 0) return 0;
    return (last.x - first.x) / dt;
  };

  const finishDrag = useCallback(
    (deltaX: number) => {
      const velocity = computeVelocity();
      velocitySamples.current = [];
      setIsDragging(false);
      dragAxisLock.current = null;
      pointerIdRef.current = null;
      pointerCapturedRef.current = false;
      dragIntentRef.current = false;

      if (Math.abs(velocity) >= VELOCITY_THRESHOLD) {
        dragIntentRef.current = true;
        setEnableTransition(true);
        setDragOffset(0);
        if (velocity < 0) goNext();
        else goPrev();
      } else if (Math.abs(deltaX) >= SWIPE_THRESHOLD_PX) {
        dragIntentRef.current = true;
        setEnableTransition(true);
        setDragOffset(0);
        if (deltaX < 0) goNext();
        else goPrev();
      } else {
        setEnableTransition(true);
        setDragOffset(0);
      }

      scheduleResume();
    },
    [goNext, goPrev, scheduleResume],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerDragEnabled) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pauseInteraction();
    dragStartX.current = e.clientX;
    dragStartY.current = e.clientY;
    dragAxisLock.current = null;
    pointerIdRef.current = e.pointerId;
    pointerCapturedRef.current = false;
    dragIntentRef.current = false;
    velocitySamples.current = [{ x: e.clientX, t: performance.now() }];
    setIsDragging(true);
    setEnableTransition(false);
    setDragOffset(0);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerDragEnabled || !isDragging || pointerIdRef.current !== e.pointerId) return;

    const dx = e.clientX - dragStartX.current;
    const dy = e.clientY - dragStartY.current;
    const now = performance.now();

    if (dragAxisLock.current == null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      dragAxisLock.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (dragAxisLock.current === 'y') return;

    if (!pointerCapturedRef.current) {
      pointerCapturedRef.current = true;
      dragIntentRef.current = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* already captured */
      }
    }

    e.preventDefault();
    setDragOffset(dx);

    velocitySamples.current.push({ x: e.clientX, t: now });
    if (velocitySamples.current.length > 6) velocitySamples.current.shift();
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerDragEnabled || pointerIdRef.current !== e.pointerId) return;
    const deltaX = e.clientX - dragStartX.current;
    if (pointerCapturedRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    }
    finishDrag(dragAxisLock.current === 'x' ? deltaX : 0);
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerDragEnabled || pointerIdRef.current !== e.pointerId) return;
    finishDrag(0);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      pauseInteraction();
      goPrev();
      scheduleResume();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      pauseInteraction();
      goNext();
      scheduleResume();
    }
  };

  if (count === 0) return null;

  return (
    <div ref={rootRef} className="relative">
      {loopEnabled && (
        <>
          <button
            type="button"
            onClick={() => {
              pauseInteraction();
              goPrev();
              scheduleResume();
            }}
            className="absolute left-0 top-[calc(110px)] z-[2] hidden h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-[#E5E7EB] bg-white shadow-[0_6px_16px_rgba(15,23,42,0.12)] transition-opacity hover:opacity-90 md:flex lg:top-[calc(50%-60px)]"
            aria-label="Previous featured stay"
          >
            <ChevronLeft className="h-4 w-4 text-[#0F172A]" />
          </button>
          <button
            type="button"
            onClick={() => {
              pauseInteraction();
              goNext();
              scheduleResume();
            }}
            className="absolute right-0 top-[calc(110px)] z-[2] hidden h-9 w-9 translate-x-1/2 items-center justify-center rounded-full border border-[#E5E7EB] bg-white shadow-[0_6px_16px_rgba(15,23,42,0.12)] transition-opacity hover:opacity-90 md:flex lg:top-[calc(50%-60px)]"
            aria-label="Next featured stay"
          >
            <ChevronRight className="h-4 w-4 text-[#0F172A]" />
          </button>
        </>
      )}

      <div
        ref={containerRef}
        className="overflow-hidden touch-pan-y"
        role="region"
        aria-roledescription="carousel"
        aria-label="Featured Stays"
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        <div
          className={
            pointerDragEnabled
              ? 'flex cursor-grab active:cursor-grabbing'
              : 'flex'
          }
          style={{
            gap: GAP_PX,
            transform: `translate3d(${translateX}px, 0, 0)`,
            transition:
              isDragging || !enableTransition
                ? 'none'
                : `transform ${TRANSITION_MS}ms ${EASE_OUT}`,
            willChange: 'transform',
          }}
          onTransitionEnd={handleTransitionEnd}
          {...(pointerDragEnabled
            ? {
                onPointerDown,
                onPointerMove,
                onPointerUp,
                onPointerCancel,
              }
            : {})}
        >
          {extendedSlides.map((property, index) => (
            <CarouselSlide
              key={`${property.id}-${index}`}
              property={property}
              width={slideWidth}
              hidden={loopEnabled ? index !== trackIndex : index !== logicalIndex}
              nearbyDistanceKm={distanceByPropertyId?.[property.id]}
              carouselSuppressClickRef={dragIntentRef}
            />
          ))}
        </div>
      </div>

      {loopEnabled && (
        <div className="mt-5 flex items-center justify-center gap-1.5" aria-hidden>
          {properties.map((property, index) => (
            <span
              key={property.id}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: index === logicalIndex ? 16 : 6,
                background: index === logicalIndex ? '#059669' : 'rgba(15,23,42,0.18)',
              }}
            />
          ))}
        </div>
      )}

      {loopEnabled && (
        <div className="mt-3 flex items-center justify-center gap-3 md:hidden">
          <button
            type="button"
            onClick={() => {
              pauseInteraction();
              goPrev();
              scheduleResume();
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E7EB] bg-white shadow-[0_6px_16px_rgba(15,23,42,0.12)]"
            aria-label="Previous featured stay"
          >
            <ChevronLeft className="h-4 w-4 text-[#0F172A]" />
          </button>
          <button
            type="button"
            onClick={() => {
              pauseInteraction();
              goNext();
              scheduleResume();
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E7EB] bg-white shadow-[0_6px_16px_rgba(15,23,42,0.12)]"
            aria-label="Next featured stay"
          >
            <ChevronRight className="h-4 w-4 text-[#0F172A]" />
          </button>
        </div>
      )}
    </div>
  );
}
