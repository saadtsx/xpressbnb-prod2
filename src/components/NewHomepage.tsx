import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Heart, MapPin, Menu, Search, X } from 'lucide-react';
import { XPRESSBNB_LOGO_PATH } from '../lib/branding';
import SEOHead from './SEOHead';
import { generateOrganizationStructuredData } from '../lib/seo';
import { addDaysIso, parseTripFromSearch } from '../lib/tripSearch';
import { HOMEPAGE_CITY_BUCKETS } from '../lib/cityBuckets';
import { navigateTo } from '../lib/navigation';
import { prefetchStaysListingRouteChunk } from '../lib/listingRouteChunk';
import { useNearbyLocationOptional } from '../contexts/NearbyLocationContext';
import HomepageBelowFold from './HomepageBelowFold';
import HomepageSearch from './homepage/HomepageSearch';
import { buildHomepageSearchPath, isHomepageDate, localToday } from '../lib/homepageSearch';
import './homepage/homepage.css';
import GlassSurface from './glass/GlassSurface';

export default function NewHomepage() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const heroSearch = useRef<HTMLDivElement>(null);
  const heroBackdrop = useRef<HTMLDivElement>(null);
  const [stickySearch, setStickySearch] = useState(false);
  const nearby = useNearbyLocationOptional();
  const [city, setCity] = useState('Delhi');
  const [trip, setTrip] = useState(() => {
    const initial = parseTripFromSearch(window.location.search);
    return { checkin: isHomepageDate(initial.checkin || '') ? initial.checkin! : '', checkout: isHomepageDate(initial.checkout || '') ? initial.checkout! : '', guests: initial.guests || 2 };
  });

  useEffect(() => {
    const node = heroSearch.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      // Only show the shortcut after passing search, never while it is below the fold.
      setStickySearch(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    }, { rootMargin: '-76px 0px 0px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && mobileNavOpen) {
        setMobileNavOpen(false);
        menuButton.current?.focus();
      }
    };
    const desktop = window.matchMedia('(min-width: 1024px)');
    const onResize = () => { if (desktop.matches) setMobileNavOpen(false); };
    document.addEventListener('keydown', onKeyDown);
    desktop.addEventListener('change', onResize);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      desktop.removeEventListener('change', onResize);
    };
  }, [mobileNavOpen]);

  const go = (path: string) => { setMobileNavOpen(false); navigateTo(path); };
  const scrollTo = (id: string) => {
    setMobileNavOpen(false);
    document.getElementById(id)?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start',
    });
  };
  const onCityClick = (name: string) => {
    const slug = name.toLowerCase().replace(/\s+/g, '-');
    prefetchStaysListingRouteChunk(slug);
    go(`/stays/${slug}`);
  };
  const onSearch = () => {
    prefetchStaysListingRouteChunk(city.toLowerCase().replace(/\s+/g, '-'));
    go(buildHomepageSearchPath(city, trip, localToday()));
  };
  const editSearch = () => {
    scrollTo('home-search');
    heroSearch.current?.querySelector<HTMLSelectElement>('select')?.focus({ preventScroll: true });
  };

  return (
    <div className="hp-page">
      <SEOHead config={{
        title: 'XpressBnB - Direct Stays in Delhi NCR | Zero Guest Commission',
        description: 'Explore direct host stays in Delhi, Gurgaon, Noida and nearby escapes. Send a private inquiry. Zero guest commission.',
        keywords: 'direct stays delhi, no brokerage apartments, premium stays noida, gurgaon serviced apartments, rishikesh retreats',
        canonical: 'https://xpressbnb.com', structuredData: generateOrganizationStructuredData(),
      }} />
      <a className="hp-skip" href="#home-search">Skip to search</a>
      <header className="hp-header xpx-top-chrome">
        <GlassSurface className="hp-header-glass" radius={0}>
        <div className="xpx-container hp-nav">
          <a href="/" className="hp-brand" aria-label="XpressBnB home">
            <img src={XPRESSBNB_LOGO_PATH} alt="" width="34" height="34" />
            <span>Xpress<span>BnB</span></span>
          </a>
          <nav className="hp-desktop-nav" aria-label="Main navigation">
            <button onClick={() => scrollTo('listings')}>Explore stays</button>
            <button onClick={() => scrollTo('how-it-works')}>How it works</button>
          </nav>
          <div className="hp-nav-actions">
            <button className="hp-saved" onClick={() => go('/saved')} aria-label="Saved stays"><Heart size={18} /><span>Saved</span></button>
            <button className="hp-login" onClick={() => go('/auth/login')}>Log in</button>
            <button className="hp-button hp-button-outline hp-nav-host" onClick={() => go('/auth/register')}>List your property</button>
            <button ref={menuButton} className="hp-menu-button" aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileNavOpen} aria-controls="homepage-menu" onClick={() => setMobileNavOpen(!mobileNavOpen)}>
              {mobileNavOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
        {mobileNavOpen && <nav id="homepage-menu" className="hp-mobile-nav xpx-container" aria-label="Mobile navigation">
          <button onClick={() => scrollTo('listings')}>Explore stays <ArrowRight size={16} /></button>
          <button onClick={() => scrollTo('how-it-works')}>How it works</button>
          <button onClick={() => go('/explore')}>Explore nearby</button>
          <button onClick={() => go('/auth/login')}>Log in</button>
          <button onClick={() => go('/auth/register')}>List your property</button>
        </nav>}
        {stickySearch && !mobileNavOpen && <div className="hp-sticky-search xpx-container">
          <button onClick={editSearch}><Search size={17} /><span>{city}<small>Edit dates &amp; guests</small></span><span className="hp-sticky-edit">Search</span></button>
        </div>}
        </GlassSurface>
      </header>
      <main id="homepage-main">
        <section className="hp-hero" aria-labelledby="home-title">
          <div className="xpx-container">
            <div className="hp-hero-grid">
              <div className="hp-hero-copy">
                <p className="hp-eyebrow"><span /> DIRECT HOST STAYS</p>
                <h1 id="home-title">Your next stay.<br /><em>Closer to home.</em></h1>
                <p className="hp-hero-description">Thoughtful spaces for weekends, work trips, and everything in between.</p>
              </div>
              <figure className="hp-hero-photo">
                <div ref={heroBackdrop} className="hp-hero-backdrop">
                <img src="/images/homepage/warm/hero-warm-1280.webp" srcSet="/images/homepage/warm/hero-warm-640.webp 640w, /images/homepage/warm/hero-warm-1280.webp 1280w" sizes="(max-width: 767px) 100vw, 55vw" width="1280" height="853" alt="Illustrated inspiration: a sunlit apartment with warm oak, sage cushions and a city balcony" fetchPriority="high" />
                </div>
                <figcaption><GlassSurface kind="lens" radius={26} backdropRef={heroBackdrop} className="hp-photo-glass">
                  <button type="button" onClick={() => scrollTo('listings')}>Space to feel at home</button>
                </GlassSurface></figcaption>
              </figure>
            </div>
            <div ref={heroSearch} id="home-search" className="hp-search-anchor">
              <HomepageSearch cities={HOMEPAGE_CITY_BUCKETS} city={city} onCityChange={setCity}
                checkin={trip.checkin} checkout={trip.checkout} guests={trip.guests}
                onCheckinChange={(value) => setTrip(previous => ({ ...previous, checkin: value, checkout: value && (!previous.checkout || previous.checkout <= value) ? addDaysIso(value, 1) : previous.checkout }))}
                onCheckoutChange={(value) => setTrip(previous => ({ ...previous, checkout: value }))}
                onGuestsChange={(value) => setTrip(previous => ({ ...previous, guests: value }))} onSearch={onSearch} />
            </div>
            <div className="hp-discovery-links">
              <div><span className="hp-explore-label">Explore:</span>{['Delhi', 'Gurgaon', 'Noida', 'Rishikesh'].map(name => <button className={city === name ? 'hp-city-current' : undefined} key={name} onClick={() => onCityClick(name)}>{name}</button>)}</div>
              <button className="hp-location-link" onClick={() => nearby ? nearby.requestLocation() : go('/explore')} disabled={nearby?.isLoading}>
                <MapPin size={15} />{nearby?.isLoading ? 'Finding nearby stays…' : nearby?.permission === 'granted' ? 'Refresh my location' : 'Use my location'}
              </button>
            </div>
            {nearby?.errorReason && nearby.errorReason !== 'inventory_load_failed' && <p className="hp-location-note" role="status">We couldn’t find your location. You can choose a city above.</p>}
          </div>
        </section>
        <HomepageBelowFold onCityClick={onCityClick} onNavigate={go} scrollTo={scrollTo} />
      </main>
    </div>
  );
}
