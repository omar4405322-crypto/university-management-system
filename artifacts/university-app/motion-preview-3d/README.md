# AI Orb 3D Motion Study

Preview: http://localhost:5173/motion-preview-3d/

Development-only HTML entry; no production route, component, dependency manifest
or build input was changed. Earlier motion studies are preserved.

Source identity: `../src/components/ai/AiAssistantAvatar.tsx` hero renderer, used
by `../src/pages/ai/AiAssistantPage.tsx`. This temporary reinterpretation retains
the olive/green palette, sphere-to-orbit proportions, Lucide GraduationCap at the
same relative size/stroke, original two elliptical projections (98/34 at -22°;
92/38 at +30°), dashed/solid ring styles and five original bead colors/sizes.

## What creates depth

- Actual Three.js sphere geometry, rotating slowly in 3D; not a rotating image.
- Procedural material detail anchored to the surface, revealing rotation.
- Six samples through a spherical chord simulate translucent internal depth;
  subsurface bands and surface detail move at different rates for parallax.
- Normal-based key lighting with a darker hemisphere, moving specular reflection,
  broad soft reflection and restrained Fresnel edge lighting.
- True 3D orbital planes and depth-buffer occlusion for both lines and particles.
- Soft atmospheric glow, grounding shadow, 2.5px floating and 1–1.012 breathing.
- Stable cap billboard follows the tiny float/breath while remaining upright.

The interior is an artistic shader approximation, not a full optical refraction
or physically based volumetric simulation. It needs WebGL; unavailable WebGL is
reported visibly. No new library was installed: Three.js already exists here.

1. Balanced 3D: restrained internal density; 42s material rotation cycle.
2. Rich 3D: deeper internal bands; 36s material rotation cycle.
3. Maximum Premium: strongest layered interior; 32s rotation cycle.

Variant 3 is the strongest visual proposal; it remains a preview, not a production
choice. The hero uses the original 192px canvas. Film close-ups are larger.
Both rings rotate independently over 34/40s in opposite directions; particles
have five distinct 8.5–14s cycles. No extra particles or rings were introduced.

One shared requestAnimationFrame clock drives five renderers. Geometry/materials
are created once; a ResizeObserver resizes buffers only when needed. Shader work
is bounded to six interior samples per pixel, without postprocessing bloom or
shadow maps. Static reduced motion skips rendering between preference/resize
changes; pause and hidden-tab behavior freeze time. Unmount disposes geometries,
materials, textures, renderers, WebGL contexts, observers and event listeners.

## Interactive section

The large "Interactive 3D Orb" is independent of the three visual comparisons.
Its sphere stays centered. A circular, keyboard-focusable hit region accepts
Pointer Events with capture; touch scrolling is disabled only inside that region.
Drag horizontal/vertical to rotate real Y/X orientation. World-space quaternion
increments avoid Euler-axis snapping, and the shader receives the full inverse
orientation for the internal view ray. Rings receive a restrained 18% view tilt.

Release velocity is capped at 2.2rad/s and damped by exp(-3.1 × elapsed seconds),
approximately 0.95 per 60fps frame. A stationary hold cancels stale momentum.
After a calm period, idle rotation blends in without resetting orientation.
Arrows rotate; Q/E roll; Space toggles idle; R resets. Keys are handled on the
focused orb button only. Reset View and double-click slerp back over 700ms.
Reduced motion preserves direct pointer/keyboard control but disables inertia
and automatic motion. The explicit reset remains a short, user-requested action.

Idle Rotation, Orbit Motion and Particle Motion have independent controls/clocks.
Both cap modes are temporary evaluation choices: camera-facing keeps the original
DOM icon upright, while surface mode rasterizes the original Lucide vector paths
into a texture on a curved mesh attached to the sphere. It foreshortens naturally
and disappears behind the sphere using the renderer's depth buffer.

## Verify / export

Start existing Vite with `pnpm --filter @workspace/university-app dev`, then:

```powershell
node artifacts/university-app/motion-preview-3d/export-video.mjs --verify-only
node --test artifacts/university-app/motion-preview-3d/interaction.test.mjs
pnpm exec tsc -p artifacts/university-app/motion-preview-3d/tsconfig.json
node artifacts/university-app/motion-preview-3d/export-video.mjs
```

The exporter reuses workspace Playwright/FFmpeg from `scratch/video-production`,
Sharp from the app, and installed Microsoft Edge. Do not edit the preview while
capturing; Vite reloads can interrupt capture. Set `MOTION_PREVIEW_ORIGIN` for a
different development server port.

Latest outputs: `artifacts/video/ai-orb-interactive-3d-study/` (earlier videos preserved):

- `ai-orb-interactive-3d-study.mp4`: 1920×1080, 30fps, 30s, H.264, no audio.
- `ai-orb-interaction.webm`: sixteen-second VP9 interaction excerpt.
- Desktop/mobile/variant screenshots and browser/video verification reports.

Timeline: title 0–2s; Balanced 2–5s; Rich 5–8s; Maximum 8–11s; comparison
11–14s; interactive 14–30s. The browser renderer is driven at exact frame times.
The interaction uses actual Playwright mouse down/move/up, radio controls and R
keypress. A cursor overlay follows those pointer events because screenshots do
not capture the operating system cursor. Horizontal and vertical drags, release
momentum, idle return, attached cap, smooth reset and camera-facing cap are shown.
Checks cover actual sphere geometry, advancing material/ring motion, pause,
mobile overflow, static reduced motion, visibly changing central surface pixels,
upright cap, no API calls/browser/shader errors, and complete MP4 decoding.
