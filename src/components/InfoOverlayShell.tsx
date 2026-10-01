import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface InfoOverlayShellProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}

/** Full-screen About / Blog / legal overlays — matches XpressBnB emerald brand. */
export default function InfoOverlayShell({ title, subtitle, onClose, children }: InfoOverlayShellProps) {
  return (
    <div className="min-h-screen w-full overflow-y-auto bg-slate-950/50 backdrop-blur-sm">
      <div className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-10 border-b border-emerald-900/30 bg-[#032E25] text-white">
          <div className="xpx-container flex items-center justify-between gap-4 py-4 sm:py-5">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight truncate">{title}</h1>
              {subtitle ? <p className="mt-1 text-sm text-emerald-100/90">{subtitle}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 p-2.5 rounded-full hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        </header>

        <div className="flex-1 xpx-container py-8 sm:py-10">
          <div className="mx-auto w-full max-w-4xl xpx-card p-6 sm:p-8 lg:p-10">{children}</div>
        </div>
      </div>
    </div>
  );
}
