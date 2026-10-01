import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Briefcase, Building2, ChevronDown, CloudOff, Home, Map as MapIcon, MapPin, Mountain, Trees } from 'lucide-react';
import { DPIIT_EMBLEM_PATH, IIT_ROORKEE_EMBLEM_PATH, XPRESSBNB_LOGO_PATH } from '../lib/branding';
import type { Property } from '../lib/database.types';
import { HOMEPAGE_CITY_BUCKETS, normalizeCityBucket } from '../lib/cityBuckets';
import { openHomeOverlay } from '../lib/navigation';
import { TEAM_EMAIL } from '../lib/team';
import { ManageCookiesLink } from './CookieConsent';
import FeaturedStaysCarousel from './FeaturedStaysCarousel';
import ListingPropertyCardSkeleton from './listing/ListingPropertyCardSkeleton';
import { OnboardingListingsEngagement } from './onboarding/OnboardingListingsEngagement';
import { getPublicListings, invalidatePublicListingsCache } from '../lib/publicListings';
import { warmPublicHostCache } from '../lib/hostPublicCache';
import { useNearbyLocationOptional } from '../contexts/NearbyLocationContext';
import XpModeSwitch from './XpModeSwitch';
import { rankPropertiesForNearby } from '../lib/nearbyRanking';
import { matchesHomepageCategory, type HomepageCategory } from '../lib/homepageCategories';

const NearbyMapDiscovery = lazy(() => import('./nearby/NearbyMapDiscovery'));

const DESTINATIONS = [
  { city: 'Delhi', image: 'delhi', description: 'Coffee dates. Old-city detours.', alt: 'Delhi-inspired heritage courtyard with coffee for two' },
  { city: 'Gurgaon', image: 'gurgaon', description: 'Log off. Stay a little longer.', alt: 'Gurgaon-inspired sunset balcony with two seats overlooking the city' },
  { city: 'Noida', image: 'noida', description: 'Slow mornings, close to home.', alt: 'Noida-inspired apartment morning with two coffees and a leafy city view' },
  { city: 'Rishikesh', image: 'rishikesh', description: 'Two cups. A little more quiet.', alt: 'Rishikesh-inspired riverside morning with chai for two' },
];
const STEPS = [
  { image: 'step-find', title: 'Find your place', text: 'Compare homes, prices and details.' },
  { image: 'step-details', title: 'Get the details', text: 'Share your dates and what you need.' },
  { image: 'step-home', title: 'Feel at home', text: 'Connect with the host and plan your stay.' },
];
const CATEGORIES = [
  { id: 'all', label: 'All stays', icon: null },
  { id: 'apartment', label: 'Apartments', icon: Building2 },
  { id: 'villa', label: 'Villas', icon: Home },
  { id: 'cottage', label: 'Cottages', icon: Trees },
  { id: 'work', label: 'Work-friendly', icon: Briefcase },
  { id: 'mountain', label: 'Mountain stays', icon: Mountain },
] as const;
const FAQS = [
  { question: 'How does an inquiry work?', answer: 'Choose a stay and send your dates and requirements. Your inquiry is reviewed before it is shared with the host. The host can then contact you directly to discuss availability and the next steps. Sending an inquiry does not confirm a booking.' },
  { question: 'Does XpressBnB charge guest commission?', answer: 'XpressBnB does not add a guest commission. Prices are listed by hosts. Confirm your dates, the final amount, any additional charges and payment terms with the host before agreeing to a stay.' },
  { question: 'When is a listing marked verified?', answer: 'A listing with a verified badge has passed our quality review. Other listings are provided directly by hosts. Review the property details and confirm anything important to your trip with the host.' },
];

export type HomepageBelowFoldProps = {
  onCityClick: (city: string) => void;
  onNavigate: (path: string) => void;
  scrollTo: (id: string) => void;
};

export default function HomepageBelowFold({ onCityClick, onNavigate, scrollTo }: HomepageBelowFoldProps) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState<string | null>(null);
  const [category, setCategory] = useState<HomepageCategory>('all');
  const [mapOpen, setMapOpen] = useState(false);
  const nearby = useNearbyLocationOptional();
  const hasLocation = nearby?.permission === 'granted' && Boolean(nearby.coords);
  const activeFilter = filter ?? (hasLocation ? 'Nearby' : 'All stays');

  useEffect(() => {
    let active = true;
    setStatus('loading');
    // A stalled connection should not leave the homepage in an endless skeleton.
    const timeout = window.setTimeout(() => {
      if (active) { active = false; setStatus('error'); }
    }, 12_000);
    void getPublicListings({ forceRefresh: attempt > 0 }).then(result => {
      if (!active) return;
      window.clearTimeout(timeout);
      if (result.status === 'error') { setStatus('error'); return; }
      setProperties(result.listings);
      warmPublicHostCache(result.listings.map(property => property.host_id));
      setStatus('ready');
    }).catch(() => {
      if (active) { window.clearTimeout(timeout); setStatus('error'); }
    });
    return () => { active = false; window.clearTimeout(timeout); };
  }, [attempt]);

  const rankedNearby = useMemo(() => {
    if (!nearby?.coords) return [];
    const { lat, lng } = nearby.coords;
    const inCity = nearby.cityBucket ? rankPropertiesForNearby(lat, lng, properties, { limit: 12, maxKm: 60, cityBucket: nearby.cityBucket }) : [];
    return inCity.length ? inCity : rankPropertiesForNearby(lat, lng, properties, { limit: 8, maxKm: 120 });
  }, [properties, nearby?.coords, nearby?.cityBucket]);
  const filtered = useMemo(() => {
    const destinations = activeFilter === 'Nearby' ? rankedNearby : activeFilter === 'All stays' ? properties : properties.filter(property => normalizeCityBucket(property.city) === activeFilter);
    return destinations.filter(property => matchesHomepageCategory(property, category));
  }, [activeFilter, properties, rankedNearby, category]);
  const distanceByPropertyId = useMemo(() => {
    const distances: Record<string, number> = {};
    if (activeFilter === 'Nearby') for (const property of rankedNearby) distances[property.id] = property.distanceKm;
    return distances;
  }, [activeFilter, rankedNearby]);
  const waiting = status === 'loading';

  useEffect(() => {
    if (!nearby?.shouldScrollToNearby || nearby.isLoading) return;
    setFilter('Nearby');
    nearby.clearScrollToNearby();
    document.getElementById('nearby')?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start',
    });
  }, [nearby]);

  const retry = () => { invalidatePublicListingsCache(); setAttempt(value => value + 1); };
  return <>
    <OnboardingListingsEngagement id="listings" className="hp-section hp-listings">
      <div className="xpx-container">
        <div className="hp-section-heading">
          <div><h2>Find your kind of stay.</h2><p>Explore stays across Delhi NCR and nearby escapes.</p></div>
          <button className="hp-text-link" onClick={() => activeFilter !== 'All stays' && activeFilter !== 'Nearby' ? onCityClick(activeFilter) : onNavigate('/explore')}>View all stays <ArrowRight size={16} /></button>
        </div>
        <div className="hp-category-filters" role="group" aria-label="Filter stays by style">
          {CATEGORIES.map(item => <button key={item.id} aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>{item.icon && <item.icon size={22} strokeWidth={1.6} aria-hidden />}{item.label}</button>)}
        </div>
        <details className="hp-destination-filter"><summary><MapPin size={14} aria-hidden />{activeFilter === 'All stays' ? 'All destinations' : activeFilter === 'Nearby' ? 'Near you' : activeFilter}<ChevronDown size={14} aria-hidden /></summary><div className="hp-city-filters" role="group" aria-label="Filter stays by destination">
          {(hasLocation ? ['Nearby', 'All stays', ...HOMEPAGE_CITY_BUCKETS] : ['All stays', ...HOMEPAGE_CITY_BUCKETS]).map(city => <button key={city} aria-pressed={activeFilter === city} onClick={() => setFilter(city)}>{city === 'Nearby' && <MapPin size={14} />}{city === 'Nearby' ? 'Near you' : city === 'All stays' ? 'All destinations' : city}</button>)}
        </div></details>
        <div id="nearby" className="hp-inventory" aria-busy={waiting}>
          {waiting ? <><p className="sr-only" role="status">Loading stays</p><div className="hp-loading-grid">{[0, 1, 2, 3].map(index => <ListingPropertyCardSkeleton key={index} />)}</div></>
          : status === 'error' ? <div className="hp-empty" role="status">
              <span className="hp-depth-icon hp-depth-icon-muted"><CloudOff size={26} /></span>
              <div><h3>Stays are taking a moment to load</h3><p>Please try again shortly. You can still explore destinations below.</p></div>
              <button className="hp-button hp-button-primary" onClick={retry}>Try again <ArrowRight size={16} /></button>
            </div>
          : filtered.length ? <><span className="sr-only" role="status">{filtered.length} stays {activeFilter === 'All stays' ? 'across all destinations' : `in ${activeFilter}`}</span><FeaturedStaysCarousel key={`${activeFilter}-${category}`} presentation="homepage" properties={filtered.slice(0, 8)} distanceByPropertyId={distanceByPropertyId} />{activeFilter === 'Nearby' && <button className="hp-text-link" onClick={() => setMapOpen(true)}><MapIcon size={16} /> Explore nearby stays on a map</button>}</>
          : category !== 'all' ? <div className="hp-empty" role="status"><span className="hp-depth-icon hp-depth-icon-muted"><Home size={26} /></span><div><h3>No matching stays just yet</h3><p>Try another style or see all stays in this destination.</p></div><button className="hp-button hp-button-outline" onClick={() => setCategory('all')}>See all styles <ArrowRight size={16} /></button></div>
          : <div className="hp-empty" role="status"><span className="hp-depth-icon hp-depth-icon-muted"><Home size={26} /></span><div><h3>{activeFilter === 'All stays' ? 'New stays are on their way' : `No stays to show ${activeFilter === 'Nearby' ? 'near you' : `in ${activeFilter}`} yet`}</h3><p>Explore another destination while hosts add more homes.</p></div><button className="hp-button hp-button-outline" onClick={() => activeFilter === 'All stays' ? scrollTo('destinations') : setFilter('All stays')}>{activeFilter === 'All stays' ? 'Explore destinations' : 'See all destinations'} <ArrowRight size={16} /></button></div>}
        </div>
      </div>
    </OnboardingListingsEngagement>

    <section id="how-it-works" className="hp-section hp-process-section" aria-labelledby="process-title">
      <div className="xpx-container"><div className="hp-process" id="why">
        <div className="hp-process-intro"><h2 id="process-title">A good stay in three simple steps.</h2><p>From browsing to check-in, it’s designed to be effortless.</p></div>
        <ol className="hp-steps">{STEPS.map((step, index) => <li key={step.title}>
          <img className="hp-step-art" src={`/images/homepage/warm/${step.image}-160.webp`} srcSet={`/images/homepage/warm/${step.image}-160.webp 160w, /images/homepage/warm/${step.image}-320.webp 320w`} sizes="(min-width: 1200px) 112px, 96px" width="160" height="160" alt="" loading="lazy" decoding="async" />
          <div><span className="hp-step-number">0{index + 1}</span><h3>{step.title}</h3><p>{step.text}</p></div>
        </li>)}</ol>
      </div></div>
    </section>

    <section id="destinations" className="hp-section hp-destinations" aria-labelledby="destinations-title">
      <div className="xpx-container">
        <div className="hp-section-heading"><div><h2 id="destinations-title">Where would you like to go?</h2><p>A city break or a change of pace.</p></div><button className="hp-text-link" onClick={() => onNavigate('/explore')}>All destinations <ArrowRight size={16} /></button></div>
        <div className="hp-destination-grid">{DESTINATIONS.map(destination => <button className="hp-destination" key={destination.city} onClick={() => onCityClick(destination.city)}>
          <div className="hp-destination-image"><img src={`/images/homepage/city-moods/${destination.image}-480.webp`} srcSet={`/images/homepage/city-moods/${destination.image}-480.webp 480w, /images/homepage/city-moods/${destination.image}-960.webp 960w`} sizes="(max-width: 767px) calc((100vw - 46px) / 2), (max-width: 1280px) calc((100vw - 108px) / 4), 293px" alt={destination.alt} loading="lazy" decoding="async" width="960" height="640" /><span><ArrowRight size={18} /></span></div>
          <h3>{destination.city}</h3><p>{destination.description}</p>
        </button>)}</div>
      </div>
    </section>

    <section className="hp-section hp-faq" aria-labelledby="faq-title"><div className="xpx-container hp-faq-layout">
      <div><p className="hp-eyebrow">BEFORE YOU GO</p><h2 id="faq-title">A few things<br className="hp-desktop-break" /> to know</h2><p>More questions?<br /><a href={`mailto:${TEAM_EMAIL}`}>We’re here to help <ArrowRight size={14} /></a></p></div>
      <div className="hp-faq-list">{FAQS.map(faq => <details key={faq.question}><summary>{faq.question}<ChevronDown size={18} aria-hidden /></summary><p>{faq.answer}</p></details>)}</div>
    </div></section>

    <section id="host" className="hp-section hp-host-section" aria-labelledby="host-title"><div className="xpx-container"><div className="hp-host">
      <span className="hp-depth-icon" aria-hidden><Home size={26} /></span><div><h2 id="host-title">Have a place to share?</h2><p>Meet guests looking for their next stay.</p></div><button className="hp-button hp-button-outline" onClick={() => onNavigate('/auth/register')}>List your property <ArrowRight size={16} /></button>
    </div></div></section>

    <div className="xpx-container hp-credentials" aria-label="Recognition and ecosystem">
      <span><img src={DPIIT_EMBLEM_PATH} width="30" height="30" alt="" loading="lazy" />DPIIT Recognized Startup</span>
      <span><img src={IIT_ROORKEE_EMBLEM_PATH} width="30" height="30" alt="" loading="lazy" />Born from the IIT Roorkee Ecosystem</span>
    </div>
    <footer className="hp-footer"><div className="xpx-container">
      <div className="hp-footer-grid">
        <div className="hp-footer-brand"><a className="hp-brand" href="/"><img src={XPRESSBNB_LOGO_PATH} width="30" height="30" alt="" /><span>Xpress<span>BnB</span></span></a><p>Direct stays. Real hosts.<br />A little closer to home.</p><XpModeSwitch /></div>
        <nav aria-label="Explore destinations"><h3>Explore</h3>{HOMEPAGE_CITY_BUCKETS.map(city => <button key={city} onClick={() => onCityClick(city)}>{city}</button>)}</nav>
        <nav aria-label="Hosting and company"><h3>XpressBnB</h3><button onClick={() => onNavigate('/auth/register')}>Become a host</button><button onClick={() => scrollTo('how-it-works')}>How it works</button><button onClick={() => openHomeOverlay('about')}>About us</button><button onClick={() => openHomeOverlay('blog')}>Journal</button></nav>
        <nav aria-label="Help and legal"><h3>Here to help</h3><a href={`mailto:${TEAM_EMAIL}`}>Contact us</a><button onClick={() => openHomeOverlay('privacy')}>Privacy</button><button onClick={() => openHomeOverlay('terms')}>Terms</button><ManageCookiesLink /><a href="/images/homepage/credits.html" target="_blank" rel="noopener noreferrer">Photo credits</a></nav>
      </div>
      <div className="hp-footer-bottom"><span>© {new Date().getFullYear()} XpressBnB. All rights reserved.</span><span>Made for your next chapter.</span></div>
    </div></footer>
    {mapOpen && <Suspense fallback={<div role="status" className="hp-map-loading">Opening map… <button className="hp-button hp-button-outline" onClick={() => setMapOpen(false)}>Cancel</button></div>}><NearbyMapDiscovery properties={rankedNearby} distanceByPropertyId={distanceByPropertyId} userCity={nearby?.detectedCity} onClose={() => setMapOpen(false)} /></Suspense>}
  </>;
}
