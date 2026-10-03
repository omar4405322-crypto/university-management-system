import { memo, useEffect, useId, useRef, useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { createOrb, type OrbControls, type OrbRenderer, type ShaheenApplicationState, type ShaheenQuality } from './renderer.js';
import './orb.css';

export interface Interactive3DOrbProps {
  state?: ShaheenApplicationState;
  quality?: ShaheenQuality;
  interactionEnabled?: boolean;
  reducedMotionOverride?: boolean;
  variant?: number;
  interactive?: boolean;
  controls?: OrbControls;
  resetToken?: number;
  onIdleChange?: (enabled: boolean) => void;
  onRenderer?: (renderer: OrbRenderer) => (() => void);
  onReady?: (ready: boolean) => void;
  autoplay?: boolean;
  prefersReducedMotion?: boolean;
  isPageVisible?: boolean;
  className?: string;
  instructionsId?: string;
  showError?: boolean;
}

// The same component and canonical createOrb renderer power the preview and hero.
// Preview supplies its existing shared/export clock; the hero owns one local clock.
export default memo(function Interactive3DOrb({
  variant = 3, interactive = true, controls, resetToken = 0, onIdleChange,
  onRenderer, onReady, autoplay = true, prefersReducedMotion = false,
  isPageVisible = true, className = '', instructionsId, showError = false,
  state = 'idle', quality = 'high', interactionEnabled = true, reducedMotionOverride,
}: Interactive3DOrbProps) {
  const host = useRef<HTMLDivElement>(null);
  const cap = useRef<HTMLDivElement>(null);
  const aura = useRef<HTMLDivElement>(null);
  const shadow = useRef<HTMLDivElement>(null);
  const hit = useRef<HTMLButtonElement>(null);
  const rendererRef = useRef<OrbRenderer | null>(null);
  const time = useRef(0);
  const frame = useRef(0);
  const failed = useRef(false);
  const [error, setError] = useState(false);
  const descriptionId = useId();
  const [systemReduced, setSystemReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const reducedMotion = reducedMotionOverride ?? (prefersReducedMotion || systemReduced);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setSystemReduced(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);

  useEffect(() => {
    const element = host.current!;
    let renderer: OrbRenderer | undefined;
    let unregister: (() => void) | undefined;
    let frames = 0;
    failed.current = false;
    setError(false);
    const fail = () => {
      failed.current = true;
      cancelAnimationFrame(frame.current);
      element.dataset.ready = 'false';
      onReady?.(false);
      setError(true);
    };
    try {
      renderer = createOrb(element, variant, cap.current!, aura.current!, shadow.current!, hit.current, {
        onFrame() {
          element.dataset.frame = String(++frames);
          element.dataset.ready = 'true';
          if (frames === 1) onReady?.(true);
        },
        onError: fail,
      });
      rendererRef.current = renderer;
      unregister = onRenderer?.(renderer);
    } catch { fail(); }
    return () => {
      failed.current = true;
      cancelAnimationFrame(frame.current);
      unregister?.();
      renderer?.dispose();
      rendererRef.current = null;
    };
  }, [variant, interactive, onRenderer, onReady]);

  useEffect(() => { if (controls) rendererRef.current?.configure(controls); }, [controls]);
  useEffect(() => {
    rendererRef.current?.configure({ applicationState: state, quality, interactionEnabled });
  }, [state, quality, interactionEnabled, variant, interactive, onRenderer, onReady]);
  useEffect(() => { if (resetToken) rendererRef.current?.reset(); }, [resetToken]);
  useEffect(() => {
    const element = host.current!;
    const change = (event: Event) => onIdleChange?.((event as CustomEvent<boolean>).detail);
    element.addEventListener('idlechange', change);
    return () => element.removeEventListener('idlechange', change);
  }, [onIdleChange]);

  useEffect(() => {
    if (!autoplay) return;
    const renderer = rendererRef.current;
    const element = host.current!;
    const button = hit.current;
    if (!renderer || failed.current) return;
    let inView = true;
    const visible = () => isPageVisible && !document.hidden;
    let previous = 0;
    const draw = () => {
      try { renderer.draw(time.current, reducedMotion); }
      catch {
        failed.current = true;
        element.dataset.ready = 'false';
        onReady?.(false);
        setError(true);
      }
    };
    const tick = (now: number) => {
      if (failed.current || !visible() || !inView) return;
      const resetting = renderer.state().resetting;
      if (previous) time.current += Math.min((now - previous) / 1000, .1);
      previous = now;
      if (!reducedMotion || resetting) draw();
      else renderer.syncTime(time.current);
      if (!failed.current && (!reducedMotion || renderer.state().resetting)) frame.current = requestAnimationFrame(tick);
    };
    const schedule = () => {
      cancelAnimationFrame(frame.current);
      previous = 0;
      if (visible() && inView && !failed.current && (!reducedMotion || renderer.state().resetting)) frame.current = requestAnimationFrame(tick);
    };
    draw();
    const observer = new IntersectionObserver(entries => { inView = entries[0].isIntersecting; schedule(); });
    observer.observe(element);
    // The renderer handles input first; these listeners only wake a requested reset.
    button?.addEventListener('keydown', schedule);
    button?.addEventListener('dblclick', schedule);
    document.addEventListener('visibilitychange', schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame.current);
      observer.disconnect();
      document.removeEventListener('visibilitychange', schedule);
      button?.removeEventListener('keydown', schedule);
      button?.removeEventListener('dblclick', schedule);
    };
  }, [autoplay, reducedMotion, isPageVisible, onReady, variant, interactive, onRenderer, resetToken]);

  return (
    <div className={`orb3d ${className}`} ref={host} data-variant={variant}
      data-testid="ai-hero-model" data-orb-source="interactive-3d-orb" data-ready="false"
      data-application-state={state} data-quality={quality} data-failed={error}
      data-animation-paused={!isPageVisible || reducedMotion}
      role={interactive ? 'group' : 'img'} aria-label={`${['Balanced 3D', 'Rich 3D', 'Maximum Premium'][variant - 1]} green university AI orb`}>
      <div className="atmosphere" ref={aura} aria-hidden="true" />
      <div className="grounding" ref={shadow} aria-hidden="true" />
      <div className="cap-layer" ref={cap}><GraduationCap size={36} strokeWidth={2} aria-hidden="true" /></div>
      {interactive ? <button ref={hit} type="button" className="orb-hit" aria-disabled={!interactionEnabled || state === 'disabled'} aria-label="Interactive 3D orb" aria-describedby={instructionsId || descriptionId} /> : null}
      {interactive && !instructionsId ? <span id={descriptionId} className="sr-only">Drag to rotate. Arrow keys to control. Q and E to roll. Space toggles idle. R or double-click resets.</span> : null}
      {error ? <div className="orb-static-fallback" aria-hidden="true"><GraduationCap /></div> : null}
      {error && showError ? <p className="webgl-error">WebGL is unavailable in this browser.</p> : null}
    </div>
  );
});
