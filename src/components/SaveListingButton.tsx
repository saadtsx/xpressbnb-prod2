import { Heart } from 'lucide-react';
import { useSavedListings } from '../hooks/useSavedListings';
import type { SavedListingSnapshot } from '../lib/savedListingsStorage';
import { theme } from '../lib/theme';
import { trackXpressEvent } from '../lib/analytics';
import { HeartOutlineIcon } from './icons/PropertyCardIcons';
import './glass/cardGlass.css';

type SaveListingButtonProps = {
  propertyId: string;
  getSnapshot: () => SavedListingSnapshot;
  className?: string;
  /** Larger tap target for Rishikesh-style cards */
  size?: 'sm' | 'md';
  /** `card` = absolute on listing image; `inline` = toolbar button */
  variant?: 'card' | 'inline';
  align?: 'left' | 'right';
  presentation?: 'default' | 'editorial' | 'glass';
};

export default function SaveListingButton({
  propertyId,
  getSnapshot,
  className = '',
  size = 'sm',
  variant = 'card',
  align = 'right',
  presentation = 'default',
}: SaveListingButtonProps) {
  const { isSaved, toggleSnapshot } = useSavedListings();
  const saved = isSaved(propertyId);
  const glass = variant === 'card' && presentation === 'glass';

  const dim = size === 'md' || glass ? 'w-11 h-11' : variant === 'card' ? 'w-10 h-10' : 'w-8 h-8';
  const icon = variant === 'card' ? 'w-[18px] h-[18px]' : 'w-4 h-4';

  const positionClass =
    variant === 'card'
      ? `absolute top-3 z-10 ${align === 'left' ? 'left-3' : 'right-3'} ${dim}`
      : presentation === 'editorial'
        ? 'inline-flex items-center gap-1.5'
        : 'inline-flex items-center gap-1.5 px-3 py-2';

  const interactionClass =
    presentation === 'editorial' || glass
      ? ''
      : 'transition-transform hover:scale-110 active:scale-95';

  const inlineClass =
    variant === 'inline' && presentation !== 'editorial'
      ? 'hover:bg-slate-100 text-sm font-semibold text-xpx-text'
      : variant === 'inline' && presentation === 'editorial'
        ? 'text-sm font-normal'
        : '';

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        const nextSaved = !saved;
        toggleSnapshot(getSnapshot());
        trackXpressEvent('save_clicked', {
          property_id: propertyId,
          action: nextSaved ? 'save' : 'unsave',
        });
      }}
      className={`${positionClass} ${presentation === 'editorial' ? '' : 'rounded-full'} flex items-center justify-center ${interactionClass} ${inlineClass} ${glass ? 'xpx-card-glass xpx-card-glass-save' : ''} ${className}`}
      style={
        glass ? undefined : variant === 'card'
          ? {
              background: '#FFFFFF',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }
          : { minHeight: 44 }
      }
      aria-label={saved ? 'Remove from saved' : 'Save stay'}
      aria-pressed={saved}
    >
      {variant === 'card' ? (
        saved ? (
          <Heart className={`${icon} text-[#f97316]`} fill="#f97316" aria-hidden />
        ) : (
          <HeartOutlineIcon className={`${icon} text-[#111827]`} aria-hidden />
        )
      ) : (
        <Heart
          className={`${icon} transition-colors`}
          style={{ color: saved ? '#f97316' : theme.accent }}
          fill={saved ? '#f97316' : 'none'}
        />
      )}
      {variant === 'inline' && (
        <span className="hidden sm:inline">{saved ? 'Saved' : 'Save'}</span>
      )}
    </button>
  );
}
