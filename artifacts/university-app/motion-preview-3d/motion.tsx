import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Interactive3DOrb from '../src/components/ai/interactive-orb/Interactive3DOrb';
import type { OrbControls } from '../src/components/ai/interactive-orb/renderer.js';
import { createOrb } from './orb.js';
import '../src/index.css';
import './study.css';

const variants = [
  { id: 1, name: 'Balanced 3D', detail: 'Quiet surface detail. Soft internal light. Calm product motion.' },
  { id: 2, name: 'Rich 3D', detail: 'Deeper internal layers. Stronger material presence.' },
  { id: 3, name: 'Maximum Premium', detail: 'Layered energy and glass reflections, held in balance.' },
];
type Renderer = ReturnType<typeof createOrb>;
const renderers = new Set<Renderer>();
let time = 0;
let paused = false;
let exporting = false;
const media = matchMedia('(prefers-reduced-motion: reduce)');
function draw(seconds: number) { time = seconds; renderers.forEach(renderer => renderer.draw(seconds, media.matches, paused)); }
declare global { interface Window { motion3d: { ready: boolean; frame: (seconds: number, scene?: string) => void; states: () => unknown[] }; } }

type Controls = OrbControls;
function registerRenderer(renderer: Renderer) {
  renderers.add(renderer);
  renderer.draw(time, media.matches);
  return () => { renderers.delete(renderer); };
}
function Orb({ variant, interactive = false, controls, resetToken = 0, onIdleChange }: { variant: number; interactive?: boolean; controls?: Controls; resetToken?: number; onIdleChange?: (enabled: boolean) => void }) {
  return <Interactive3DOrb variant={variant} interactive={interactive} controls={controls}
    resetToken={resetToken} onIdleChange={onIdleChange} onRenderer={registerRenderer}
    autoplay={false} instructionsId="orb-instructions" showError />;
}
function App() {
  const [isPaused, setPaused] = useState(false);
  const [controls, setControls] = useState<Controls>({ idle: true, orbits: true, particles: true, capMode: 'surface' });
  const [resetToken, setResetToken] = useState(0);
  const changeIdle = React.useCallback((idle: boolean) => setControls(previous => ({ ...previous, idle })), []);
  useEffect(() => {
    let raf = 0;
    let previous = performance.now();
    const refreshPreference = () => draw(time);
    media.addEventListener('change', refreshPreference);
    const tick = (now: number) => {
      if (!exporting && !document.hidden) {
        const dt = Math.min((now - previous) / 1000, .1);
        time += dt;
        if ((!paused && !media.matches) || Array.from(renderers).some(renderer => renderer.state().resetting)) draw(time);
        else renderers.forEach(renderer => renderer.syncTime(time));
      }
      previous = now;
      raf = requestAnimationFrame(tick);
    };
    window.motion3d = { ready: true, frame: (seconds, scene = 'comparison') => {
      exporting = true;
      document.body.classList.add('recording');
      document.body.dataset.scene = scene;
      draw(seconds);
    }, states: () => Array.from(renderers, renderer => renderer.state()) };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); media.removeEventListener('change', refreshPreference); };
  }, []);
  return <main>
    <header><div><h1>AI Orb 3D Motion Study</h1><p>Light, material and movement.</p></div>
      <button aria-pressed={isPaused} onClick={() => { paused = !isPaused; setPaused(!isPaused); }}>{isPaused ? 'Resume motion' : 'Pause motion'}</button>
    </header>
    <section className="hero" aria-label="Welcome-screen scale">
      <Orb variant={3} /><h2>University AI Assistant</h2><p>Maximum Premium at the original welcome-screen scale</p>
      <div className="input-context">Ask the assistant…<span aria-hidden="true">↑</span></div>
    </section>
    <section className="interactive-study" aria-label="Interactive 3D Orb">
      <h2>Interactive 3D Orb</h2>
      <div className="interactive-stage"><Orb variant={3} interactive controls={controls} resetToken={resetToken} onIdleChange={changeIdle} /></div>
      <p id="orb-instructions">Drag to rotate · Arrow keys to control · R to reset</p>
      <div className="prototype-controls">
        {(['idle', 'orbits', 'particles'] as const).map((key, index) => <label key={key}>
          <input type="checkbox" checked={controls[key]} onChange={event => setControls(previous => ({ ...previous, [key]: event.target.checked }))} />
          {['Idle Rotation', 'Orbit Motion', 'Particle Motion'][index]}
        </label>)}
        <fieldset><legend>Cap Mode</legend>
          <label><input type="radio" name="cap-mode" value="surface" checked={controls.capMode === 'surface'} onChange={() => setControls(previous => ({ ...previous, capMode: 'surface' }))} />Cap follows sphere</label>
          <label><input type="radio" name="cap-mode" value="camera" checked={controls.capMode === 'camera'} onChange={() => setControls(previous => ({ ...previous, capMode: 'camera' }))} />Cap faces camera</label>
        </fieldset>
        <button onClick={() => setResetToken(previous => previous + 1)}>Reset View</button>
      </div>
    </section>
    <section className="comparison" aria-label="Three variants">
      {variants.map(variant => <article key={variant.id} data-card={variant.id}>
        <div className="orb-stage"><Orb variant={variant.id} /></div>
        <h2>{variant.id} — {variant.name}</h2><p>{variant.detail}</p>
      </article>)}
    </section>
    <footer>Temporary visual study. Production artwork and behavior remain unchanged.</footer>
    <section className="film-title"><h1>AI Orb 3D Motion Study</h1><p>University AI Assistant</p><span>Three interpretations of a living core</span></section>
  </main>;
}
createRoot(document.getElementById('root')!).render(<App />);
