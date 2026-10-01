import type { ReactNode } from 'react';
import { X } from 'lucide-react';

type TelAvivEditorialFrameProps = {
  kicker: string;
  onClose: () => void;
  children: ReactNode;
};

/** Full-viewport ivory chrome for About / Journal — Tel Aviv White City system. */
export default function TelAvivEditorialFrame({
  kicker,
  onClose,
  children,
}: TelAvivEditorialFrameProps) {
  return (
    <div className="min-h-screen w-full" style={{ background: '#FAFAF8', color: '#0f172a' }}>
      <header
        className="sticky top-0 z-20"
        style={{
          background: 'rgba(250,250,248,0.94)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(15,23,42,0.08)',
        }}
      >
        <div className="xpx-container flex items-center justify-between gap-4 py-3.5 sm:py-4">
          <p className="text-[11px] sm:text-xs font-semibold tracking-[0.22em] uppercase text-xpx-subtle">
            XpressBnB · {kicker}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full"
            style={{ border: '1px solid rgba(15,23,42,0.12)', background: '#fff' }}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>
      {children}
    </div>
  );
}
