import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AiAssistantAvatar } from '../src/components/ai/AiAssistantAvatar';
import '../src/index.css';
import './study.css';

type Concept = 'A' | 'B' | 'C' | 'D';
const concepts: { id: Concept; name: string; detail: string }[] = [
  { id: 'A', name: 'Classic Orbit', detail: 'Path-following particles · slow rings · subtle surface drift' },
  { id: 'B', name: 'Premium Atomic', detail: 'Gentle drift · rotating rings · breathing core' },
  { id: 'C', name: 'Quantum Inspired', detail: 'Controlled regions · faint rotating rings · quiet surface motion' },
  { id: 'D', name: 'Hybrid Recommended', detail: 'Slow orbital rhythm · independent rings · living core' },
];

// One clock for every instance. Export uses the very same renderer at exact frame times.
const renderers = new Set<(seconds: number) => void>();
let frameTime = 0;
let frozen = false;
let recording = false;
function draw(seconds: number) {
  frameTime = seconds;
  renderers.forEach(render => render(seconds));
}
declare global {
  interface Window {
    motionStudy: { frame: (seconds: number, scene?: string) => void; ready: boolean };
  }
}

function Orb({ concept }: { concept: Concept }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = root.current!;
    // Reuse the production artwork; animate its layers independently in this study only.
    const svg = host.querySelector<SVGSVGElement>('svg:has(ellipse)')!;
    const canvas = svg.parentElement!.parentElement!;
    const sphere = canvas.children[1] as HTMLElement;
    const highlight = sphere.children[0] as HTMLElement;
    const surface = document.createElement('div');
    surface.className = 'orb-surface';
    surface.setAttribute('aria-hidden', 'true');
    surface.style.backgroundImage = getComputedStyle(sphere).backgroundImage;
    sphere.prepend(surface);
    highlight.classList.add('orb-specular');
    sphere.classList.add('orb-core');
    const aura = host.querySelector<HTMLElement>('[data-testid="ai-character-placeholder"] > div:first-child')!;
    const ellipses = Array.from(svg.querySelectorAll('ellipse'));
    ellipses.forEach(ellipse => ellipse.classList.add('rotating-orbit'));
    if (concept === 'C') ellipses.forEach(ellipse => { ellipse.style.opacity = String(Number(ellipse.getAttribute('opacity')) * .42); });
    const circles = Array.from(svg.querySelectorAll('circle'));
    const glow = svg.querySelector('filter')!;
    const glowId = `study-glow-${concept}-${host.dataset.instance}`;
    glow.id = glowId;
    circles.forEach(circle => { if (circle.hasAttribute('filter')) circle.setAttribute('filter', `url(#${glowId})`); });
    const front = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    front.setAttribute('viewBox', '0 0 220 220');
    front.classList.add('front-particles');
    front.setAttribute('aria-hidden', 'true');
    canvas.append(front);
    const foreground = circles.map(circle => {
      const copy = circle.cloneNode(true) as SVGCircleElement;
      front.append(copy);
      return copy;
    });
    // Arc-length lookup on the actual SVG ellipse, including its original rotation.
    // Layout/geometry is read once; each frame writes transforms and opacity only.
    const tracks = ellipses.map(ellipse => {
      const length = ellipse.getTotalLength();
      const matrix = ellipse.transform.baseVal.consolidate()!.matrix;
      return Array.from({ length: 513 }, (_, index) => {
        const point = ellipse.getPointAtLength(length * index / 512);
        return { x: matrix.a * point.x + matrix.c * point.y + matrix.e,
          y: matrix.b * point.x + matrix.d * point.y + matrix.f };
      });
    });
    const durations = [5.5, 7, 9, 7.8, 10.5];
    const phases = [0.48, 0.05, 0.23, 0.72, 0.88];
    const initial = circles.map(circle => ({ x: Number(circle.getAttribute('cx')), y: Number(circle.getAttribute('cy')) }));
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const ringDurations: Record<Concept, number[]> = { A: [20, 28], B: [28, 36], C: [34, 40], D: [36, 40] };
    const coreDurations: Record<Concept, number> = { A: 30, B: 36, C: 40, D: 42 };
    const render = (seconds: number) => {
      const still = media.matches;
      const t = still ? 0 : seconds;
      const breath = still ? 0 : (1 - Math.cos(t * Math.PI * 2 / 9)) / 2;
      const lift = concept === 'A' ? .5 : concept === 'B' ? 2.5 : 2;
      sphere.style.transform = `translateY(${-lift * Math.sin(t * Math.PI * 2 / 8)}px) scale(${1 + breath * (concept === 'A' ? .006 : .012)})`;
      aura.style.opacity = still ? '1' : String(.9 + breath * .1);
      // An independent gloss cycle implies slow axial rotation; the cap never rotates.
      // Keep lighting close to the source rather than spinning the whole shaded ball.
      const coreAngle = t * Math.PI * 2 / coreDurations[concept];
      surface.style.transform = `rotate(${5 * Math.sin(coreAngle)}deg)`;
      highlight.style.transform = `translate(${5 * Math.sin(coreAngle)}px, ${1.5 * (1 - Math.cos(coreAngle))}px) scaleX(${.98 + .02 * Math.cos(coreAngle)})`;
      const ringAngles = ellipses.map((ellipse, index) => {
        const angle = (index === 0 ? 1 : -1) * t * Math.PI * 2 / ringDurations[concept][index];
        // The SVG transform attribute contains the original -22° / +30° tilt.
        // Compose it explicitly because CSS transforms override that attribute.
        ellipse.style.transform = `rotate(${(index === 0 ? -22 : 30) + angle * 180 / Math.PI}deg)`;
        return angle;
      });
      circles.forEach((circle, i) => {
        const reverse = i === 1 || i === 4 ? -1 : 1;
        const duration = durations[i] * (concept === 'D' ? 1.65 : concept === 'C' ? 1.35 : 1);
        const organic = concept !== 'A' && !still ? .014 * Math.sin(t * .63 + i * 1.7) : 0;
        const phase = ((phases[i] + reverse * t / duration + organic) % 1 + 1) % 1;
        const index = phase * 512;
        const lo = Math.floor(index);
        const mix = index - lo;
        const track = tracks[i % 2];
        let x = track[lo].x + (track[lo + 1].x - track[lo].x) * mix;
        let y = track[lo].y + (track[lo + 1].y - track[lo].y) * mix;
        if (concept === 'C') {
          const region = .78 + .14 * Math.sin(t * .43 + i * 2.2);
          x = 110 + (x - 110) * region + 9 * Math.sin(t * .39 + i);
          y = 110 + (y - 110) * (1.1 + .24 * Math.cos(t * .31 + i)) + 13 * Math.sin(t * .47 + i * 2);
        } else if (concept !== 'A') {
          const drift = concept === 'D' ? 1.4 : 2.6;
          x += drift * Math.sin(t * .71 + i * 2);
          y += drift * Math.cos(t * .59 + i * 1.3);
        }
        // Carry each point with its own moving ellipse, preserving exact A alignment.
        const angle = ringAngles[i % 2];
        const px = x - 110;
        const py = y - 110;
        x = 110 + px * Math.cos(angle) - py * Math.sin(angle);
        y = 110 + px * Math.sin(angle) + py * Math.cos(angle);
        const depth = Math.sin(phase * Math.PI * 2);
        const isFront = depth >= 0;
        const scale = still ? 1 : .9 + .2 * (depth + 1) / 2;
        const pulse = concept === 'A' || still ? 1 : .92 + .08 * Math.sin(t * .9 + i * 1.9);
        const fade = concept === 'C' && !still ? .52 + .48 * (1 + Math.sin(t * .7 + i * 2)) / 2 : 1;
        const opacity = (still ? 1 : isFront ? 1 : .42) * pulse * fade;
        if (still) { x = initial[i].x; y = initial[i].y; }
        const transform = `translate(${x}px, ${y}px) scale(${scale}) translate(${-initial[i].x}px, ${-initial[i].y}px)`;
        circle.style.transform = transform;
        foreground[i].style.transform = transform;
        circle.style.opacity = still || !isFront ? String(opacity) : '0';
        foreground[i].style.opacity = !still && isFront ? String(opacity) : '0';
      });
    };
    renderers.add(render);
    render(frameTime);
    return () => {
      renderers.delete(render); front.remove(); surface.remove();
      highlight.classList.remove('orb-specular');
      sphere.classList.remove('orb-core');
    };
  }, [concept]);
  return <div className="orb-study" ref={root} data-instance={React.useId()} data-concept={concept}>
    <AiAssistantAvatar size="hero" state="idle" interactive={false} />
  </div>;
}

function App() {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    let raf = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      if (!frozen && !recording && !document.hidden) draw(frameTime + Math.min((now - previous) / 1000, .1));
      previous = now;
      raf = requestAnimationFrame(tick);
    };
    window.motionStudy = { ready: true, frame: (seconds, scene = 'comparison') => {
      recording = true;
      document.body.dataset.scene = scene;
      document.body.classList.add('recording');
      draw(seconds);
    } };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <main>
    <header><div><h1>AI Orb Motion Study</h1><p>Four motion directions. One university identity.</p></div>
      <button onClick={() => { frozen = !paused; setPaused(!paused); }} aria-pressed={paused}>{paused ? 'Resume motion' : 'Pause motion'}</button>
    </header>
    <section className="comparison" aria-label="Four animation concepts">
      {concepts.map(concept => <article key={concept.id} data-card={concept.id}>
        <div className="orb-stage"><Orb concept={concept.id} /></div>
        <h2>{concept.id} — {concept.name}</h2><p>{concept.detail}</p>
      </article>)}
    </section>
    <section className="welcome" aria-label="Concept D at welcome screen size">
      <h2>D — Hybrid Recommended</h2><p>Welcome-screen scale</p>
      <div className="welcome-stage"><Orb concept="D" /></div>
      <h3>University AI Assistant</h3><p>A calm companion for your academic day.</p>
      <div className="input-context">Ask the assistant…<span aria-hidden="true">↑</span></div>
    </section>
    <footer>Motion prototype only. D is a proposal for comparison; no version has been integrated.</footer>
    <div className="film-title"><h1>AI Orb Motion Study</h1><p>University AI Assistant</p><span>Four motion directions · original artwork</span></div>
  </main>;
}
createRoot(document.getElementById('root')!).render(<App />);
