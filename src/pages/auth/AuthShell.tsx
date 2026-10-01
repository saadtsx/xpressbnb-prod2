import { ReactNode } from 'react';
import { Lock, ShieldCheck, Sparkles } from 'lucide-react';
import { XPRESSBNB_LOGO_IMG_CLASS, XPRESSBNB_LOGO_PATH } from '../../lib/branding';
import { theme } from '../../lib/theme';
import GlassSurface from '../../components/glass/GlassSurface';

export type AuthVisual = {
  /** Background photo/illustration for the visual panel. */
  image: string;
  imageAlt: string;
  /** Short label above the headline, e.g. "For guests" / "For hosts". */
  kicker: string;
  /** Emotionally-led headline — not a restatement of the form title. */
  headline: string;
  /** One supporting line under the headline. */
  caption: string;
  /** Two short reassurance lines shown in the floating trust chip. */
  trustLines: [string, string];
};

const DEFAULT_VISUAL: AuthVisual = {
  image: '/images/homepage/warm/hero-warm-1280.webp',
  imageAlt: '',
  kicker: 'XpressBnB',
  headline: 'Your stay, your host, your way.',
  caption: 'Everything here happens directly between you and the people who host you.',
  trustLines: ['0% commission on stays', 'You deal with your host directly'],
};

interface AuthShellProps {
  /** Eyebrow above the title (e.g. "Welcome back"). */
  eyebrow?: string;
  /** Big page title. */
  title: string;
  /** Sub-headline under the title. */
  subtitle?: string;
  /** Left-panel story — defaults to a calm brand visual when omitted. */
  visual?: AuthVisual;
  /** The auth form / card body. */
  children: ReactNode;
  /** Footer line beneath the card (links to switch screens, etc.). */
  footer?: ReactNode;
}

function BackToHome({ light = false }: { light?: boolean }) {
  return (
    <button
      onClick={() => {
        window.history.pushState({}, '', '/');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }}
      className={`flex items-center gap-2 text-base leading-none transition-opacity hover:opacity-80 ${
        light ? 'text-white' : 'text-xpx-text'
      }`}
    >
      <img
        src={XPRESSBNB_LOGO_PATH}
        alt=""
        className={XPRESSBNB_LOGO_IMG_CLASS}
        width={36}
        height={36}
        decoding="async"
      />
      <span className="font-extrabold tracking-tight">
        Xpress<span style={{ color: light ? '#D1FAE5' : theme.accent }}>BnB</span>
      </span>
    </button>
  );
}

/**
 * Shared shell for /auth/*. Split layout on large screens — a real photo with
 * a one-line promise on the left, the form on the right — collapsing to a
 * photo banner over the form on mobile. Replaces the old floating-card-on-
 * gradient-blobs look with something that reads as XpressBnB, not a template.
 */
export default function AuthShell({
  eyebrow,
  title,
  subtitle,
  visual = DEFAULT_VISUAL,
  children,
  footer,
}: AuthShellProps) {
  return (
    <div className="min-h-screen-safe xpx-page lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Visual panel — hidden on mobile in favor of a shorter banner below */}
      <div className="relative hidden lg:block lg:min-h-screen-safe overflow-hidden">
        <img
          src={visual.image}
          alt={visual.imageAlt}
          className="absolute inset-0 h-full w-full object-cover"
          fetchPriority="high"
          decoding="async"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(4,20,14,0.55) 0%, rgba(4,20,14,0.15) 38%, rgba(4,20,14,0.25) 72%, rgba(3,16,11,0.82) 100%)',
          }}
        />
        <div className="relative flex h-full flex-col justify-between p-10 xl:p-12">
          <BackToHome light />

          <div className="max-w-md">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {visual.kicker}
            </p>
            <h2 className="mt-4 text-4xl xl:text-[2.75rem] font-extrabold leading-[1.1] tracking-tight text-white">
              {visual.headline}
            </h2>
            <p className="mt-4 text-base text-emerald-50/90 leading-relaxed">{visual.caption}</p>

            <GlassSurface className="mt-7 inline-flex" radius={18}>
              <div className="xpx-glass-content flex flex-col gap-2.5 px-5 py-4">
                {visual.trustLines.map((line) => (
                  <span key={line} className="flex items-center gap-2.5 text-sm font-semibold text-[#0F2A1F]">
                    <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: theme.accentDark }} />
                    {line}
                  </span>
                ))}
              </div>
            </GlassSurface>
          </div>
        </div>
      </div>

      {/* Mobile banner — compact photo strip, visible below lg */}
      <div className="relative h-40 sm:h-48 overflow-hidden lg:hidden">
        <img
          src={visual.image}
          alt={visual.imageAlt}
          className="absolute inset-0 h-full w-full object-cover"
          fetchPriority="high"
          decoding="async"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(4,20,14,0.55) 0%, rgba(4,20,14,0.1) 55%, var(--xpx-page) 100%)',
          }}
        />
        <div className="relative flex h-full flex-col justify-between p-5 pt-safe">
          <BackToHome light />
        </div>
      </div>

      {/* Form panel */}
      <div className="relative flex items-start lg:items-center justify-center px-5 sm:px-10 lg:px-14 xl:px-20 pb-10 sm:pb-14 pb-safe -mt-6 sm:-mt-8 lg:mt-0">
        <div className="relative w-full max-w-md">
          <div className="hidden lg:block mb-2" />

          <div
            className="rounded-t-[28px] lg:rounded-3xl px-6 py-7 sm:p-8 lg:p-9"
            style={{
              background: '#FFFFFF',
              border: '1px solid var(--xpx-border)',
              boxShadow: '0 24px 64px rgba(15,23,42,0.10)',
            }}
          >
            <div className="lg:hidden mb-5">
              <div className="mx-auto h-1 w-10 rounded-full" style={{ background: 'var(--xpx-border-strong, #cbd5e1)' }} />
            </div>

            <div className="mb-7">
              {eyebrow && <p className="xpx-eyebrow mb-2.5">{eyebrow}</p>}
              <h1 className="text-[1.7rem] sm:text-3xl font-extrabold tracking-tight text-xpx-text leading-tight">
                {title}
              </h1>
              {subtitle && <p className="mt-2.5 text-xpx-muted text-[0.95rem] leading-relaxed">{subtitle}</p>}
            </div>

            {children}

            <div className="mt-6 pt-5 xpx-divider flex items-center justify-center gap-2 text-xs text-xpx-subtle">
              <Lock className="w-3.5 h-3.5" aria-hidden="true" />
              Your details are encrypted and never sold.
            </div>
          </div>

          {footer && <div className="mt-6 text-center text-sm text-xpx-muted">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
