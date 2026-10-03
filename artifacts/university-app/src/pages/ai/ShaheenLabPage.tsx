import { useCallback, useEffect, useRef, useState } from 'react';
import Interactive3DOrb from '../../components/ai/interactive-orb/Interactive3DOrb';
import type { OrbControls, OrbRenderer, OrbState, ShaheenApplicationState, ShaheenQuality } from '../../components/ai/interactive-orb/renderer.js';
import './shaheen-lab.css';

const states: ShaheenApplicationState[] = ['idle', 'thinking', 'responding', 'success', 'warning', 'error', 'disabled'];
export default function ShaheenLabPage() {
  const [state, setState] = useState<ShaheenApplicationState>('idle');
  const [quality, setQuality] = useState<ShaheenQuality>('high');
  const [reduced, setReduced] = useState(false);
  const [interaction, setInteraction] = useState(true);
  const [reset, setReset] = useState(0);
  const [controls, setControls] = useState<OrbControls>({ idle: true, orbits: true, particles: true, capMode: 'surface', energy: 1, glow: 1 });
  const renderer = useRef<OrbRenderer | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [telemetry, setTelemetry] = useState<{ fps: number; frameTime: number; runtime: OrbState | null }>({ fps: 0, frameTime: 0, runtime: null });
  const [ready, setReady] = useState(false);
  const register = useCallback((value: OrbRenderer) => {
    renderer.current = value;
    return () => { renderer.current = null; };
  }, []);
  const idleChange = useCallback((idle: boolean) => setControls(previous => ({ ...previous, idle })), []);
  useEffect(() => {
    if (state !== 'success' && state !== 'error') return;
    const timer = window.setTimeout(() => setState('idle'), state === 'success' ? 1400 : 1100);
    return () => window.clearTimeout(timer);
  }, [state]);
  useEffect(() => {
    let previous = performance.now();
    let previousFrames = Number(stage.current?.querySelector('.orb3d')?.getAttribute('data-frame') || 0);
    const timer = window.setInterval(() => {
      const now = performance.now();
      const frames = Number(stage.current?.querySelector('.orb3d')?.getAttribute('data-frame') || 0);
      const fps = Math.max(0, (frames - previousFrames) * 1000 / (now - previous));
      setTelemetry({ fps, frameTime: fps > 0 ? 1000 / fps : 0, runtime: renderer.current?.state() || null });
      previous = now;
      previousFrames = frames;
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);
  const change = (key: 'idle' | 'orbits' | 'particles', value: boolean) => setControls(previous => ({ ...previous, [key]: value }));
  return <main className="shaheen-lab" dir="ltr">
    <a className="lab-skip" href="#lab-controls">Skip to Controls</a>
    <header><p>Internal Runtime Harness · Phase 1</p><h1 translate="no">SHAHEEN Lab</h1><p>Review the approved Core, motion and lifecycle states.</p></header>
    <div className="lab-layout">
      <section className="lab-stage" aria-label="SHAHEEN Core" ref={stage}>
        <Interactive3DOrb state={state} quality={quality} controls={controls} interactionEnabled={interaction}
          reducedMotionOverride={reduced ? true : undefined} resetToken={reset} onRenderer={register} onReady={setReady} onIdleChange={idleChange} showError />
        <p aria-live="polite">{state.charAt(0).toUpperCase() + state.slice(1)}{state === 'success' || state === 'error' ? ' · Settles Automatically' : ''}</p>
        <p>Drag · Arrow Keys · Q/E Roll · R Reset · Space Idle</p>
      </section>
      <section id="lab-controls" className="lab-controls" aria-label="Runtime Controls">
        <fieldset><legend>Application State</legend><div className="lab-states">{states.map(value =>
          <button key={value} type="button" aria-pressed={state === value} onClick={() => setState(value)}>{value.charAt(0).toUpperCase() + value.slice(1)}</button>)}</div></fieldset>
        <fieldset><legend>Motion</legend>{(['idle', 'orbits', 'particles'] as const).map((key, index) =>
          <label key={key}><input type="checkbox" checked={controls[key]} onChange={event => change(key, event.target.checked)} />{['Idle Rotation', 'Orbit Motion', 'Particles'][index]}</label>)}</fieldset>
        <fieldset><legend>Visual</legend>{(['energy', 'glow'] as const).map(key =>
          <label key={key}>{key === 'energy' ? 'Eye/Core Energy' : 'Glow Strength'} <input aria-label={key === 'energy' ? 'Eye/Core Energy' : 'Glow Strength'} type="range" min=".5" max="1.4" step=".05" value={controls[key]} onChange={event => setControls(previous => ({ ...previous, [key]: Number(event.target.value) }))} /></label>)}</fieldset>
        <fieldset><legend>Quality</legend><label>Rendering Tier<select aria-label="Rendering Tier" value={quality} onChange={event => setQuality(event.target.value as ShaheenQuality)}>{(['low', 'medium', 'high'] as const).map(value => <option key={value} value={value}>{value.charAt(0).toUpperCase() + value.slice(1)}</option>)}</select></label></fieldset>
        <fieldset><legend>Accessibility & Interaction</legend>
          <label><input type="checkbox" checked={reduced} onChange={event => setReduced(event.target.checked)} />Force Reduced Motion</label>
          <label><input type="checkbox" checked={interaction} onChange={event => setInteraction(event.target.checked)} />Enable Drag Interaction</label>
          <button type="button" onClick={() => setReset(previous => previous + 1)}>Reset Orientation</button>
        </fieldset>
      </section>
    </div>
    <section className="lab-telemetry" aria-label="Performance Telemetry"><h2>Performance Telemetry</h2>
      <dl>{Object.entries({
        FPS: telemetry.fps.toFixed(1), 'Frame Time': telemetry.frameTime ? telemetry.frameTime.toFixed(1) + ' ms' : 'Paused',
        DPR: telemetry.runtime?.dpr.toFixed(2) || '—', Quality: quality, 'Reduced Motion': telemetry.runtime?.reduced ? 'On' : 'Off',
        WebGL: ready ? 'Ready' : 'Fallback', Interaction: telemetry.runtime?.interactionState || 'resting',
        Energy: telemetry.runtime?.energy.toFixed(3) || '—', 'Orbit Speed': telemetry.runtime?.orbitSpeed.toFixed(3) || '—',
      }).map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>
    </section>
    <footer>Manual quality only. No adaptive policy is enabled. This route is available only in development.</footer>
  </main>;
}
