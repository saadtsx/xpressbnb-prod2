import { ArrowRight, CalendarDays, ChevronDown, MapPin, Users } from 'lucide-react';
import type { HeroSearchBarProps } from '../search/HeroSearchBar';
import { addDaysIso } from '../../lib/tripSearch';
import { localToday } from '../../lib/homepageSearch';

export default function HomepageSearch({ cities, city, onCityChange, checkin, onCheckinChange, checkout, onCheckoutChange, guests, onGuestsChange, onSearch }: HeroSearchBarProps) {
  const today = localToday();
  return <form className="hp-search" aria-label="Find your stay" onSubmit={event => { event.preventDefault(); onSearch(); }}>
    <label className="hp-search-field hp-search-city">
      <MapPin aria-hidden size={20} />
      <span><span className="hp-field-label">Where to?</span><select name="city" value={city} onChange={event => onCityChange(event.target.value)}>{cities.map(name => <option key={name}>{name}</option>)}</select></span>
      <ChevronDown className="hp-select-chevron" aria-hidden size={14} />
    </label>
    <label className="hp-search-field hp-search-date">
      <CalendarDays aria-hidden size={19} />
      <span><span className="hp-field-label">Check in</span><input className={!checkin ? 'hp-date-empty' : undefined} name="checkin" type="date" min={today} value={checkin} onChange={event => onCheckinChange(event.target.value)} />{!checkin && <span className="hp-date-placeholder" aria-hidden>Add dates</span>}</span>
    </label>
    <label className="hp-search-field hp-search-date">
      <CalendarDays aria-hidden size={19} />
      <span><span className="hp-field-label">Check out</span><input className={!checkout ? 'hp-date-empty' : undefined} name="checkout" type="date" min={checkin && checkin >= today ? addDaysIso(checkin, 1) : addDaysIso(today, 1)} value={checkout} onChange={event => onCheckoutChange(event.target.value)} />{!checkout && <span className="hp-date-placeholder" aria-hidden>Add dates</span>}</span>
    </label>
    <label className="hp-search-field hp-search-guests">
      <Users aria-hidden size={19} />
      <span><span className="hp-field-label">Guests</span><select name="guests" value={guests} onChange={event => onGuestsChange(Number(event.target.value))}>{Array.from({ length: 16 }, (_, index) => index + 1).map(count => <option key={count} value={count}>{count} {count === 1 ? 'guest' : 'guests'}</option>)}</select></span>
      <ChevronDown className="hp-select-chevron" aria-hidden size={14} />
    </label>
    <button className="hp-button hp-button-primary hp-search-submit" type="submit">Explore stays <ArrowRight size={18} aria-hidden /></button>
  </form>;
}
