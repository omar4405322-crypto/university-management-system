# AI Orb Motion Study

Standalone, development-only entry: http://localhost:5173/motion-preview/

Start the existing app's Vite server with `pnpm --filter @workspace/university-app dev`.
The prototype has its own HTML/React entry. No app route, production component,
build input, dependency manifest, or lockfile was changed.

## Artwork

Source: `../src/components/ai/AiAssistantAvatar.tsx`, hero placeholder renderer,
used by `../src/pages/ai/AiAssistantPage.tsx` on the welcome screen.
Every instance renders the actual production component. Its sphere, gradients,
highlight, shadow, cap, two ellipse geometries, five bead sizes/colors and glow
filter are reused. The unrelated status badge and wide decorative wave are hidden
only inside this study. C intentionally makes the ellipse lines fainter.

Motion samples the actual SVG ellipses by arc length, including their transforms.
Each ellipse now rotates independently, and its particles rotate with its frame
of reference. A remains exactly on the path; B/D drift slightly, and C uses regions.
The central orb reuses its original gradient in a separate surface layer (5° slow
yaw) and its existing specular highlight drifts across a small elliptical cycle.
This implies slow axial rotation while the graduation cap stays centered and upright.
Five beads share the two original paths with distinct speeds and phases; no third
orbit is invented. Back beads stay underneath the actual opaque sphere; front
beads use a separate SVG above it. Depth changes size, opacity and effective glow.

- A — Classic Orbit: 5.5/7/9/7.8/10.5-second particle cycles; two beads reverse
  direction; rings rotate in opposite directions every 20/28s; core cycle 30s.
- B — Premium Atomic: smooth speed modulation, up to 2.6px drift, light pulses,
  2.5px float and 1–1.012 breathing; ring cycles 28/36s; core cycle 36s.
- C — Quantum Inspired: bounded, deterministic orbital regions, depth and fades;
  a stylized probability-inspired motion treatment, not a physics simulation;
  ring cycles 34/40s; core cycle 40s; 2px float and subtle breathing/glow.
- D — Hybrid Recommended: 1.65× longer particle cycles, 1.4px drift, 2px float,
  subtle breathing and glow; ring cycles 36/40s; core cycle 42s.
  This is a proposal, not an integrated winner.

One requestAnimationFrame clock drives all five instances without per-frame React
renders. Geometry is read once, then only transforms and opacity change. Hidden
tabs pause time advancement; the effect removes its renderer when unmounted.
Reduced motion stops travel, ring rotation, surface drift, scaling and floating,
preserving static beads.
Pause/resume applies to every concept.

## Export / verification

From repository root:

```powershell
node artifacts/university-app/motion-preview/export-video.mjs --verify-only
node artifacts/university-app/motion-preview/export-video.mjs
pnpm exec tsc -p artifacts/university-app/motion-preview/tsconfig.json
```

Set `MOTION_PREVIEW_ORIGIN` if Vite is on a different port.
The exporter reuses existing `playwright-core` and `ffmpeg-static` from
`scratch/video-production/node_modules`, plus installed Microsoft Edge.
No tools were installed for this task. Export depends on those local tools.

Output directory: `artifacts/video/ai-orb-motion-study-v2/` (previous videos preserved).

- `ai-orb-motion-study.mp4`: H.264, 1920×1080, 30fps, 30 seconds, no audio.
- `ai-orb-motion-comparison.webm`: six-second VP9 comparison excerpt; not a
  mathematically seamless loop.
- `preview-page.png`, `preview-mobile.png`, `A.png`, `B.png`, `C.png`, `D.png`,
  `comparison.png`: browser screenshots.
- `verification.json`: live motion, pause, mobile, reduced-motion and API isolation.
- `video-verification.txt`: full MP4 decode and metadata verification.

Timeline: title 0–2s; A 2–7s; B 7–12s; C 12–17s; D 17–24s; comparison 24–30s.
The export drives the same renderer at exact 1/30-second times, independently of
capture speed. The interactive D section retains the original 192px hero canvas;
the video magnifies it for inspection.
