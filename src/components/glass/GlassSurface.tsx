import { Component, lazy, Suspense, useCallback, useEffect, useState, type ReactNode, type RefObject } from 'react';
import type { RenderingDiagnostics } from 'simple-liquid-glass';
import './glass.css';

const LiquidGlass = lazy(() => import('simple-liquid-glass').then(module => ({ default: module.LiquidGlass })));

type GlassSurfaceProps = {
  children: ReactNode;
  className?: string;
  kind?: 'navigation' | 'lens';
  radius?: number;
  backdropRef?: RefObject<HTMLElement | null>;
};

/** The optical renderer can fail without unmounting links, losing focus or hiding controls. */
class OpticsBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}

/** Pinned simple-liquid-glass material, with one small photo lens and CSS navigation. */
export default function GlassSurface({ children, className = '', kind = 'navigation', radius = 26, backdropRef }: GlassSurfaceProps) {
  const [policy, setPolicy] = useState<'pending' | 'full' | 'calm' | 'solid'>('pending');
  const [failed, setFailed] = useState(false);
  const [diagnostics, setDiagnostics] = useState<RenderingDiagnostics | null>(null);
  const onFailure = useCallback(() => setFailed(true), []);
  const onDiagnostics = useCallback((next: RenderingDiagnostics) => setDiagnostics(previous =>
    previous?.strategy === next.strategy && previous?.reason === next.reason && previous?.quality === next.quality ? previous : next), []);

  useEffect(() => {
    const queries = ['(prefers-reduced-motion: reduce)', '(prefers-reduced-transparency: reduce)', '(prefers-contrast: more)', '(forced-colors: active)'].map(query => window.matchMedia(query));
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; addEventListener?: (name: string, callback: () => void) => void; removeEventListener?: (name: string, callback: () => void) => void } }).connection;
    const sync = () => {
      const supportsBlur = typeof CSS !== 'undefined' && (CSS.supports('backdrop-filter', 'blur(1px)') || CSS.supports('-webkit-backdrop-filter', 'blur(1px)'));
      setPolicy(!supportsBlur || queries.slice(1).some(query => query.matches) ? 'solid' : queries[0].matches || connection?.saveData ? 'calm' : 'full');
    };
    sync();
    queries.forEach(query => query.addEventListener('change', sync));
    connection?.addEventListener?.('change', sync);
    return () => { queries.forEach(query => query.removeEventListener('change', sync)); connection?.removeEventListener?.('change', sync); };
  }, []);

  // The small lens captures only its sibling photo. No full-page snapshots or DOM mirrors.
  const renderOptics = policy === 'full' && !failed;
  const strategy = failed ? 'fallback' : policy === 'solid' ? 'off' : renderOptics ? diagnostics?.strategy ?? 'pending' : 'blur';
  return <div className={`xpx-glass xpx-glass-${kind} ${className}`} style={{ borderRadius: radius }} data-glass-strategy={strategy} data-glass-policy={policy} data-glass-reason={diagnostics?.reason}>
    <div className="xpx-glass-base" aria-hidden />
    {renderOptics && <div className="xpx-glass-optics" aria-hidden>
      <OpticsBoundary onFailure={onFailure}><Suspense fallback={null}>
        <LiquidGlass
          material="frosted" radius={radius} quality="low" liquid={false} track={false} mirror={false}
          renderer={kind === 'lens' ? 'webgl' : 'auto'} effectMode={kind === 'lens' ? 'auto' : 'blur'}
          backdropRef={kind === 'lens' ? backdropRef : undefined}
          lensProfile="material" lensOptions={{ strength: 0.07, depth: 0.3, bend: 0.2, sheen: 0.45, specular: 0.7 }}
          scale={110} blur={kind === 'lens' ? 2 : 14} saturation={115} aberrationIntensity={0}
          glassColor={kind === 'lens' ? 'rgba(247,252,248,0.68)' : 'rgba(250,252,249,0.78)'}
          borderColor="rgba(255,255,255,0.7)" frost={0.12} autoTextColor={false}
          onDiagnosticsChange={onDiagnostics}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        />
      </Suspense></OpticsBoundary>
    </div>}
    <div className="xpx-glass-content">{children}</div>
  </div>;
}
