import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, MapPin, Navigation, RefreshCw, X } from 'lucide-react';
import { HOMEPAGE_CITY_BUCKETS } from '../../lib/cityBuckets';
import type { Property } from '../../lib/database.types';
import { getPublicListings } from '../../lib/publicListings';
import { warmPublicHostCache } from '../../lib/hostPublicCache';
import { buildHomepageSearchPath, localToday } from '../../lib/homepageSearch';
import { formatTripChip, parseTripFromSearch, type TripParams } from '../../lib/tripSearch';
import { selectExplorerProperties, type ExplorerRequest, type ExplorerSort } from '../../lib/locationExplorer';
import { useNearbyLocationOptional } from '../../contexts/NearbyLocationContext';
import { subscribeStayScoreInfoOpen } from '../../lib/stayScoreEducation';
import ConversionPropertyCard from '../ConversionPropertyCard';
import ListingPropertyCardSkeleton from '../listing/ListingPropertyCardSkeleton';
import './locationExplorer.css';

const CITY_ART: Record<string, string> = { Delhi: 'delhi', Gurgaon: 'gurgaon', Noida: 'noida', Rishikesh: 'rishikesh' };

export default function LocationExplorer({ request, trip, onRequestChange, onClose, onEditDates }: {
  request: ExplorerRequest;
  trip: TripParams;
  onRequestChange: (request: ExplorerRequest) => void;
  onClose: () => void;
  onEditDates: (guests: number) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const nearby = useNearbyLocationOptional();
  const reduceMotion = useReducedMotion();
  const [sort, setSort] = useState<ExplorerSort>('price-high');
  const [guests, setGuests] = useState(trip.guests);
  const [properties, setProperties] = useState<Property[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [visibleCount, setVisibleCount] = useState(12);
  const locating = request.mode === 'nearby' && Boolean(nearby?.phase === 'locating' || nearby?.phase === 'geocoding');
  const locationFailed = request.mode === 'nearby' && !locating && (!nearby?.coords || nearby.phase === 'unavailable');
  const city = request.mode === 'city' ? request.city : nearby?.cityBucket || nearby?.detectedCity || 'Near you';
  const art = CITY_ART[city];
  const selection = useMemo(() => selectExplorerProperties(properties, {
    city: request.mode === 'city' ? request.city : nearby?.cityBucket || undefined,
    coords: request.mode === 'nearby' ? nearby?.coords || undefined : undefined, guests, sort,
  }), [properties, request, nearby?.cityBucket, nearby?.coords, guests, sort]);
  const selectionKey = `${request.mode}-${city}-${guests}-${sort}`;
  const path = buildHomepageSearchPath(city, { ...trip, guests }, localToday());
  const tripQuery = path.includes('?') ? path.slice(path.indexOf('?')) : '';
  const normalizedTrip = { ...trip, ...parseTripFromSearch(tripQuery) };

  useEffect(() => {
    const node = dialog.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    if (node && !node.open) node.showModal();
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    return () => {
      node?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    let scoreTrigger: HTMLElement | null = null;
    // The existing global score sheet is not in the native dialog's top layer.
    // Temporarily yield that layer, then restore the explorer without losing filters.
    return subscribeStayScoreInfoOpen(open => {
      const node = dialog.current;
      if (!node) return;
      if (open && node.open) {
        scoreTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        node.close();
      } else if (!open && !node.open) {
        node.showModal();
        scoreTrigger?.focus({ preventScroll: true });
      }
    });
  }, []);

  useEffect(() => {
    let active = true;
    setStatus('loading');
    const timeout = window.setTimeout(() => { if (active) { active = false; setStatus('error'); } }, 12000);
    void getPublicListings({ forceRefresh: attempt > 0 }).then(result => {
      if (!active) return;
      clearTimeout(timeout);
      if (result.status === 'error') { setStatus('error'); return; }
      setProperties(result.listings);
      warmPublicHostCache(result.listings.map(property => property.host_id));
      setStatus('ready');
    }).catch(() => { if (active) { clearTimeout(timeout); setStatus('error'); } });
    return () => { active = false; clearTimeout(timeout); };
  }, [attempt]);

  useEffect(() => {
    setVisibleCount(12);
    if (resultsRef.current) {
      resultsRef.current.scrollTop = 0;
      if (resultsRef.current.parentElement) resultsRef.current.parentElement.scrollTop = 0;
    }
  }, [selectionKey]);

  const busy = locating || (!locationFailed && status === 'loading');
  return <dialog ref={dialog} className="lx-dialog" data-lenis-prevent aria-labelledby="lx-title" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <motion.div className="lx-shell" initial={reduceMotion ? false : { opacity: 0, y: 36, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 30 }}>
      <button ref={closeButton} className="lx-close" aria-label="Close location explorer" onClick={onClose}><X size={21} /></button>
      <motion.aside className="lx-scene" aria-label="Destination inspiration" initial={reduceMotion ? false : { opacity: 0, x: -36 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: reduceMotion ? 0 : .5, ease: [.22, 1, .36, 1] }}>
        <AnimatePresence initial={false} mode="sync">
          <motion.img key={art || 'generic'} className="lx-scene-image" src={art ? `/images/homepage/city-moods/${art}-960.webp` : '/images/homepage/warm/hero-warm-1280.webp'} alt="" initial={reduceMotion ? false : { opacity: 0, scale: 1.06 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : .65 }} />
        </AnimatePresence>
        <div className="lx-scene-shade" />
        <div className="lx-scene-copy"><span className="lx-eyebrow">A LITTLE CLOSER TO YOUR NEXT STAY</span>
          <div className="lx-pin" aria-hidden><MapPin size={28} /><i /><i /></div>
          <AnimatePresence mode="wait" initial={false}><motion.h2 id="lx-title" key={city} initial={reduceMotion ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : .2 }}>{locating ? 'Finding your corner.' : city === 'Near you' ? 'Closer than you think.' : `Hello, ${city}.`}</motion.h2></AnimatePresence>
          <p>{request.mode === 'nearby' ? 'A fresh perspective on places around you.' : 'A new view. A slower morning. A place that feels like you.'}</p>
          <span className="lx-scene-note">Destination inspiration</span>
        </div>
      </motion.aside>
      <section className="lx-results" aria-label="Explore properties">
        <div className="lx-toolbar">
          <span className="lx-eyebrow">EXPLORE YOUR NEXT CHAPTER</span><h3>{request.mode === 'nearby' ? 'Stays around you' : `Stays in ${city}`}</h3>
          <div className="lx-controls">
            <label>Destination<select value={request.mode === 'nearby' ? 'nearby' : city} onChange={event => onRequestChange(event.target.value === 'nearby' ? { mode: 'nearby' } : { mode: 'city', city: event.target.value })}>
              {(request.mode === 'nearby' || (nearby?.permission === 'granted' && nearby.coords)) && <option value="nearby">Near my location</option>}{HOMEPAGE_CITY_BUCKETS.map(name => <option key={name}>{name}</option>)}
            </select></label>
            <label>Sort by<select value={sort} onChange={event => setSort(event.target.value as ExplorerSort)}><option value="price-high">Price: high to low</option><option value="price-low">Price: low to high</option></select></label>
            <label>Guests<select value={guests} onChange={event => setGuests(Number(event.target.value))}>{Array.from({ length: 16 }, (_, index) => index + 1).map(count => <option key={count} value={count}>{count} {count === 1 ? 'guest' : 'guests'}</option>)}</select></label>
          </div>
          <div className="lx-trip-actions"><button className="lx-dates" onClick={() => onEditDates(guests)}>{formatTripChip(normalizedTrip.checkin || '', normalizedTrip.checkout || '', guests)} <span>Edit dates</span></button>
          <button className="lx-refresh" type="button" disabled={status === 'loading'} onClick={() => setAttempt(value => value + 1)} aria-label="Refresh property listings"><RefreshCw size={14} aria-hidden />Refresh stays</button></div>
          <p className="lx-count" role="status">{locating ? 'Finding your location…' : locationFailed ? 'Choose a city to keep exploring.' : status === 'loading' ? 'Loading host-listed stays…' : status === 'error' ? 'Stays are taking a moment to load.' : `${selection.properties.length} ${selection.properties.length === 1 ? 'stay' : 'stays'} · ${sort === 'price-high' ? 'Highest prices first' : 'Lowest prices first'}`}</p>
        </div>
        <div ref={resultsRef} className="lx-scroll" aria-busy={busy}>
          {busy ? <div className="lx-grid">{[0, 1, 2, 3].map(index => <ListingPropertyCardSkeleton key={index} />)}</div>
          : locationFailed ? <div className="lx-empty"><Navigation size={28} /><h4>Let’s choose your next stop.</h4><p>{nearby?.permission === 'denied' || nearby?.permission === 'blocked' ? 'Location access is off. Select a city above to explore its stays.' : 'We couldn’t find your location. Try again or choose a city above.'}</p><button onClick={() => nearby?.requestLocation()}>Try my location again</button></div>
          : status === 'error' ? <div className="lx-empty"><RefreshCw size={28} /><h4>Your next stay can wait a moment.</h4><p>We couldn’t load the listings. Please try again.</p><button onClick={() => setAttempt(value => value + 1)}>Reload stays</button></div>
          : !selection.properties.length ? <div className="lx-empty"><MapPin size={28} /><h4>A little further afield?</h4><p>No stays match this location and guest count yet. Choose another city or adjust the guests above.</p></div>
          : <><motion.div key={selectionKey} className="lx-grid" initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: reduceMotion ? 0 : .045 } } }}>
            {selection.properties.slice(0, visibleCount).map(property => <motion.div key={property.id} variants={{ hidden: { opacity: 1, y: reduceMotion ? 0 : 12 }, visible: { opacity: 1, y: 0, transition: { duration: reduceMotion ? 0 : .24 } } }}><ConversionPropertyCard property={property} tripQuery={tripQuery} nearbyDistanceKm={selection.distances[property.id]} nearbySource="location_explorer" className="max-w-none" /></motion.div>)}
          </motion.div>{selection.properties.length > visibleCount && <button className="lx-more" onClick={() => setVisibleCount(value => value + 12)}>Explore more stays <ArrowRight size={17} /></button>}</>}
        </div>
        <p className="lx-footnote">Host-listed prices per night. Confirm dates and availability with the host.</p>
      </section>
    </motion.div>
  </dialog>;
}
