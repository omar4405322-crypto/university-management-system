# SHAHEEN Transformation — Phase 0 Baseline & Product Contract
**Product Identity:** SHAHEEN / شاهين  
**Document Classification:** Architectural Baseline, Security Invariants & Implementation Contract  
**Phase:** 0 (Read-Only Audit & Contract Definition — Zero Code Modifications)  
**Date:** October 2026

---

## Executive Summary
This document establishes the authoritative implementation contract for transforming the university's AI Assistant into the unified product identity **SHAHEEN (شاهين)**. 
- **SHAHEEN is not merely the 3D Orb**, **not merely the LLM**, and **not merely the current AI Assistant page**. 
- SHAHEEN is the complete intelligent university assistant product and personality.
- All existing backend architectures, database schemas, RBAC systems, tool registries, and execution guards remain authoritative and intact. SHAHEEN is a clean domain and product identity layered above this proven infrastructure.

---

## A. Current SHAHEEN-Relevant Architecture

### 1. Frontend AI Architecture
- **Interactive Chat Workspace:** [`AiAssistantPage.tsx`](file:///d:/Projects/UN/University%20management%20system/artifacts/university-app/src/pages/ai/AiAssistantPage.tsx)
  - Full-page responsive layout with session history drawer (mobile) / collapsible sidebar (desktop), search debouncing (300ms), and session lifecycle actions (rename, pin/unpin, archive, delete modal).
  - Native Fullscreen API integration via `workspaceRef.current.requestFullscreen()` with vendor fallbacks (`webkit`), focus restoration, and error toasts.
  - Streaming token presentation, auto-scrolling with user interrupt detection, markdown rendering with custom code block controls, citation chips, and proposal action cards (`AiActionCard.tsx`).
- **3D Core Rendering Engine:** [`renderer.js`](file:///d:/Projects/UN/University%20management%20system/artifacts/university-app/src/components/ai/interactive-orb/renderer.js) & [`Interactive3DOrb.tsx`](file:///d:/Projects/UN/University%20management%20system/artifacts/university-app/src/components/ai/interactive-orb/Interactive3DOrb.tsx)
  - Custom Three.js procedural Ray-marched sphere shader (radius 0.64, 64x48 segments) with 6-sample internal spherical chord density, dynamic parallax noise bands, specular gloss, softbox highlights, and rim lighting.
  - Quaternion-based free rotation with pointer momentum throw and exponential velocity damping (`Math.exp(-3.1 * dt)`).
  - Dual orbital rings with 5 glowing satellite beads undergoing sinusoidal orbital phase animation.
  - Projected graduation cap emblem mapped onto the 3D sphere curvature.
  - Standalone preview & export harness at `/motion-preview-3d/` ([`motion.tsx`](file:///d:/Projects/UN/University%20management%20system/artifacts/university-app/motion-preview-3d/motion.tsx)).
- **Identity Abstraction Layer:** [`AiAssistantAvatar.tsx`](file:///d:/Projects/UN/University%20management%20system/artifacts/university-app/src/components/ai/AiAssistantAvatar.tsx)
  - Multi-renderer adapter architecture supporting `'placeholder' | 'static-image' | 'rive' | 'live2d' | 'three'`.
  - Sizing tiers: `sm` (32px), `md` (48px), `lg` (56-64px), and `hero` (80-96px).
  - State configuration map: `idle`, `listening`, `thinking`, `speaking`, `success`, `error`.
  - Error boundaries (`ModelBoundary`), page visibility suspension (`usePageVisibility`), and accessibility query detection (`usePrefersReducedMotion`).
- **Brand System Integration:** [`index.css`](file:///d:/Projects/UN/University%20management%20system/artifacts/university-app/src/index.css) & [`ThemeContext.tsx`](file:///d:/Projects/UN/University%20management%20system/artifacts/university-app/src/context/ThemeContext.tsx)
  - Tailwind v4 theme with strict typography (`Cairo` display/headings, `IBM Plex Sans` / `IBM Plex Sans Arabic` body).
  - Central brand tokens rooted in canonical university palette: Primary Green `#8BB83C`, Dark Green `#70952F`, Light Green `#A1C04F`, Navy `#132231`, Surface Light `#F4F6F7`, Surface Dark `#091119`.

### 2. Backend Engine & Safety Layer
- **Orchestration & Provider Resilience:** [`aiOrchestrator.service.ts`](file:///d:/Projects/UN/University%20management%20system/artifacts/api-server/src/services/aiOrchestrator.service.ts)
  - Multi-round tool execution (up to 3 rounds) with request-scoped caching, multi-provider fallback (OpenAI / Gemini), circuit breakers, timeout budgeting, and streaming event dispatch (`onDelta`, `onStatus`, `onCitation`).
- **Authoritative RBAC & Capability Registry:** [`aiCapabilityRegistry.service.ts`](file:///d:/Projects/UN/University%20management%20system/artifacts/api-server/src/services/aiCapabilityRegistry.service.ts)
  - Strict role partitioning (`STUDENT`, `DOCTOR`, `TEACHING_ASSISTANT`, `ADMIN`).
  - Zero-bypass invariant: tools are filtered server-side based on verified session actor before prompt assembly.
  - Action Proposal Framework: the LLM never executes direct mutations; proposals create preview cards requiring explicit UI human confirmation.
- **RAG & Regulations Grounding:** [`aiTools.service.ts`](file:///d:/Projects/UN/University%20management%20system/artifacts/api-server/src/services/aiTools.service.ts)
  - Vector knowledge retrieval with versioning, article/page metadata extraction, and mandatory citations.

---

## B. What Is Already Complete
1. **Interactive 3D WebGL Sphere Core:**
   - Ray-marched internal shader depth, breathing, lift, surface noise, and reflections are approved and verified.
   - Pointer drag with pointer capture, inertial throw velocity, and damping.
   - Keyboard manipulation: Arrow keys (pitch/yaw), Q/E (roll), Space (toggle idle), R / double-click (cubic slerp reset).
2. **Motion Study Preview:**
   - Dedicated route at `/motion-preview-3d/` with controls for idle rotation, orbital motion, particle streams, and 3 visual quality variants (Balanced, Rich, Maximum Premium).
3. **Avatar Layer Architecture:**
   - Pluggable renderer abstraction (`AiAssistantAvatar`) with `ModelBoundary` fallback and size classes (`sm`, `md`, `lg`, `hero`).
4. **Lifecycle & Environmental Controls:**
   - Tab backgrounding pauses animations (`usePageVisibility()`).
   - Viewport exit pauses WebGL frames (`IntersectionObserver`).
   - Hardware detection respects `(prefers-reduced-motion: reduce)`.
   - WebGL failure fallback triggers CSS/SVG approved fallback aura and sphere.
5. **AI Workspace Capabilities:**
   - Fullscreen mode with clean exit, focus return, and vendor prefix safety.
   - Dynamic server-backed Quick Actions + role-based static fallbacks.
   - Streamed token generation, proposal cards, and copy/retry workflows.

---

## C. What Is Partially Complete
1. **3D Shader State Coupling:**
   - While `AiAssistantAvatar` has 6 states (`idle`, `listening`, `thinking`, `speaking`, `success`, `error`), the underlying Three.js shader in `renderer.js` is completely decoupled from these states. The 3D orb currently renders identical colors, speeds, and uniform values regardless of whether the AI is thinking, speaking, or in an error state. State is currently only reflected in the 2D status badge.
2. **Avatar Presence in Header & Transcript:**
   - In `AiAssistantPage.tsx`, `AiAssistantAvatar` is only rendered once in the empty hero state (`size="hero"`).
   - In the top header (line 1409) and transcript message headers (line 120), a raw static `GraduationCap` icon inside a generic `bg-brand-primary-600` box is rendered rather than the `sm` avatar component.
3. **Reduced-Motion Fidelity:**
   - When reduced-motion is active, WebGL animations stop, but transitions between states lack gentle non-animated visual indications.
4. **Touch Gestures on Mobile:**
   - Single pointer drag works via pointer events, but lacks explicit `touch-action: none` rules on the canvas wrapper, risking browser scroll conflicts on mobile touch devices.
5. **Persona Grounding:**
   - System instructions in `aiCapabilityRegistry.service.ts` establish identity as generic "University AI Assistant", lacking the unified name **SHAHEEN**, its core traits, and role-adapted tone guidelines.
6. **i18n Brand Copy:**
   - Locales in `ar.json` and `en.json` use "المساعد الذكي للجامعة" / "University AI Assistant" and "مساعد الجامعة" without mentioning SHAHEEN / شاهين.

---

## D. What Is Missing
1. **The SHAHEEN Lab Route (`/shaheen-lab`):**
   - No interactive developer/test harness exists to preview, debug, and benchmark SHAHEEN states (`idle`, `thinking`, `responding`, `success`, `warning`, `error`), shader uniforms, quality settings, reduced-motion overrides, and particle/orbit toggles in isolation.
2. **Dedicated SHAHEEN Brand Tokens:**
   - No explicit CSS token suite for `--shaheen-core`, `--shaheen-glow`, `--shaheen-eye`, `--shaheen-energy`, `--shaheen-orbits`, or state-driven color matrices.
3. **Shaheen 3D State Shader Uniforms:**
   - Lack of `uState`, `uStateTransition`, and dynamic energy pulses inside `renderer.js` to express thinking pulses, response luminescence, warning amber, and error dissipation.
4. **Adaptive Quality Control:**
   - No dynamic FPS monitor or configurable quality levels (`Low` / `Medium` / `High`) with automatic degradation on low-end devices.
5. **Small Icon / Compact Identity Component:**
   - No lightweight 2D SVG / CSS micro-avatar component representing SHAHEEN for headers, transcript items, and navigation sidebars.

---

## E. Requirement to File Map

| Requirement | Current Status | Current Files | Action | Implementation Owner |
| :--- | :--- | :--- | :--- | :--- |
| **Interactive 3D Orb Shader & Renderer** | Approved baseline; lacks state uniforms & quality levels | `artifacts/university-app/src/components/ai/interactive-orb/renderer.js` | **EXTEND** | **CODEX** |
| **3D Orb Component & Controls** | Complete baseline; needs state prop wiring & touch-action | `artifacts/university-app/src/components/ai/interactive-orb/Interactive3DOrb.tsx`, `orb.css` | **EXTEND** | **CODEX** |
| **Motion Study Preview** | Functional standalone | `artifacts/university-app/motion-preview-3d/motion.tsx`, `index.html` | **KEEP** | **CODEX** |
| **SHAHEEN Lab Route (`/shaheen-lab`)** | Missing | `artifacts/university-app/src/pages/ai/ShaheenLabPage.tsx`, `App.tsx` | **CREATE** | **CODEX** |
| **Avatar Abstraction & Sizing** | Functional; lacks SHAHEEN state mapping & micro-emblem | `artifacts/university-app/src/components/ai/AiAssistantAvatar.tsx` | **EXTEND** | **ANTIGRAVITY** |
| **Compact Identity Badge / Icon** | Missing (currently raw icon) | `artifacts/university-app/src/components/ai/ShaheenBadge.tsx` | **CREATE** | **ANTIGRAVITY** |
| **AI Assistant Page Integration** | Functional; needs SHAHEEN branding, header & transcript avatar | `artifacts/university-app/src/pages/ai/AiAssistantPage.tsx` | **EXTEND** | **ANTIGRAVITY** |
| **Brand Token Definition** | University tokens exist; SHAHEEN derivatives missing | `artifacts/university-app/src/index.css` | **EXTEND** | **ANTIGRAVITY** |
| **Product Copy & Localization** | Generic assistant naming | `artifacts/university-app/src/i18n/ar.json`, `en.json` | **EXTEND** | **ANTIGRAVITY** |
| **Backend System Instructions & Tone** | Generic prompt | `artifacts/api-server/src/services/aiCapabilityRegistry.service.ts` | **EXTEND** | **ANTIGRAVITY** |
| **Backend RBAC, Tools & Security Invariants** | Fully authoritative & tested | `artifacts/api-server/src/services/aiOrchestrator.service.ts`, `aiTools.service.ts`, `ai.routes.ts` | **KEEP** (Authoritative) | **ANTIGRAVITY** |
| **Brand Identity & Visual Approval** | Conceptualized | `SHAHEEN-BASELINE-AND-IMPLEMENTATION-CONTRACT.md` | **APPROVE** | **USER APPROVAL** |

*Note: No file is simultaneously assigned to Antigravity and Codex.*

---

## F. Antigravity Responsibilities
Antigravity owns the product identity layer, application integration, state coordination, and backend personality alignment:
1. **Avatar & Badge Components:**
   - Extend `AiAssistantAvatar.tsx` to support the two-layer state model and expose state cleanly to 3D and 2D renderers.
   - Create `ShaheenBadge.tsx` for consistent compact identity rendering in headers, transcripts, and mobile views.
2. **Workspace Integration (`AiAssistantPage.tsx`):**
   - Replace raw SVG headers and transcript icons with the official SHAHEEN identity.
   - Wire application states (idle, thinking, responding, success, warning, error) seamlessly into avatar props.
3. **Brand Token Styling (`index.css`):**
   - Declare canonical derived `--shaheen-*` tokens strictly referencing existing university colors.
4. **i18n & Product Terminology (`ar.json`, `en.json`):**
   - Update user-facing strings to feature **SHAHEEN / شاهين** across Arabic and English locales.
5. **Backend System Prompt Alignment (`aiCapabilityRegistry.service.ts`):**
   - Update `buildCapabilitySystemInstructions()` with SHAHEEN product identity, traits, and role-specific tones (Student, Doctor, Administrator) without altering any authorization logic or tool definitions.

---

## G. Codex Responsibilities
Codex owns the 3D graphics pipeline, WebGL performance, shader mathematical models, and the testing laboratory:
1. **Shader State Extensions (`renderer.js`):**
   - Add state uniforms (`uState`, `uTransition`, `uEnergy`) to the fragment and vertex shaders.
   - Implement smooth shader transitions between `idle` (calm breathing), `thinking` (accelerated internal depth circulation / amber resonance), `responding` (luminescent emerald emission), `success` (focused radiant bloom), `warning` (steady amber key), and `error` (subtle ruby shift).
2. **Quality Tier Engineering (`renderer.js`):**
   - Implement Low (dpr 1.0, 3 internal depth samples, no antialias), Medium (dpr 1.25, 4 samples), and High (dpr 1.75, 6 samples, full reflections) presets.
   - Add FPS measurement and automatic downscaling on frame drops below 30 FPS.
3. **Touch & Interaction Hardening (`Interactive3DOrb.tsx`, `orb.css`):**
   - Apply `touch-action: none` to the hit element.
   - Ensure pointer capture release works flawlessly on all mobile devices and touch cancellations.
4. **SHAHEEN Lab Development (`ShaheenLabPage.tsx`):**
   - Build `/shaheen-lab` testing route exposing manual state switching, orbit/particle toggles, eye glow toggles, quality selector, and telemetry readouts.

---

## H. User-Approval Gates
The following gates require explicit User confirmation before proceeding to subsequent implementation phases:
1. **Gate 1: Baseline Contract Sign-off**
   - User approval of this document (`SHAHEEN-BASELINE-AND-IMPLEMENTATION-CONTRACT.md`), confirming state models, token strategy, and ownership division.
2. **Gate 2: 3D Visual Shader Transition Sign-off**
   - User review of `/shaheen-lab` demonstrating 3D orb behavior across all application states (thinking, responding, warning, error) before merging to production workspace.
3. **Gate 3: Identity & Copy Review**
   - User approval of the revised Arabic and English system prompts and UI text strings.
4. **Gate 4: Final Release Verification**
   - End-to-end production readiness review across mobile, desktop, dark mode, and reduced motion.

---

## I. State Model

### Two-Layer Architecture
To prevent UI interaction states (e.g. mouse hover or dragging) from corrupting the assistant's functional lifecycle (e.g. thinking or waiting for network response), SHAHEEN uses a strict two-layer decoupled state model:

```
+-------------------------------------------------------------------------+
|                        APPLICATION STATE LAYER                          |
|  (Driven by Backend AI Execution, Network Events & Action Proposals)    |
|                                                                         |
|  [idle] <----> [thinking] <----> [responding]                           |
|     ^               |                   |                               |
|     |               v                   v                               |
|     +-------- [success] / [warning] / [error] / [disabled]              |
+-------------------------------------------------------------------------+
                                   |
                                   v  Composed with
+-------------------------------------------------------------------------+
|                     LOCAL INTERACTION STATE LAYER                       |
|         (Driven by Client Device, Pointer, Keyboard & OS A11y)          |
|                                                                         |
|        [resting] <----> [hover] <----> [interacting (drag/key)]         |
|                                 |                                       |
|                                 v                                       |
|                       [reduced-motion mode]                             |
+-------------------------------------------------------------------------+
```

### Application States (Authoritative)
1. `idle`: Assistant is ready, connected, awaiting prompt. Core rotates calmly at base frequency.
2. `thinking`: Prompt dispatched to server; orchestrator executing tools / RAG retrieval. Core exhibits internal fluid acceleration and warm amber/emerald resonance.
3. `responding`: Active text/token streaming arriving from server. Core breathes with rhythmic luminescent waves synchronized with reply generation.
4. `success`: Action proposal confirmed and executed successfully. Core produces a crisp radiant green pulse before returning to `idle`.
5. `warning`: Operation completed with non-fatal issue (e.g., partial records, conflicting regulations). Steady warm amber ring.
6. `error`: Network failure, rate limit, or backend exception. Core displays a restrained, elegant rose tint with damped oscillation.
7. `disabled`: Offline or unauthorized state. Core is desaturated, stationary, and unlit.

### Local Interaction States (Client-Only)
1. `resting`: Pointer outside boundary, default inertial state.
2. `hover`: Pointer within interactive bounds. Core exhibits subtle scale increase (1.03x) and increased specular gloss.
3. `interacting`: User is actively dragging, rotating via arrow keys, or rolling via Q/E. Local physics velocity directly controls sphere orientation.
4. `reduced-motion`: OS or user preference enabled. Kinetic rotation, orbital translation, and continuous animations are suppressed; crisp static orientation and gentle opacity shifts replace dynamic motion.

---

## J. Brand Token Strategy

SHAHEEN strictly inherits the university's canonical palette. No arbitrary greens or conflicting hues are permitted.

### Canonical Foundation Tokens
- **Brand Primary Green:** `#8BB83C` (`--color-brand-primary-500`, `--brand-green`)
- **Dark Brand Green:** `#70952F` (`--color-brand-primary-600`, `--brand-green-dark`)
- **Light Brand Green:** `#A1C04F` (`--color-brand-primary-400`, `--brand-green-light`)
- **Deep Navy:** `#132231` (`--color-brand-navy-500`, `--brand-navy`)
- **Navy Light:** `#263744` (`--brand-navy-light`)
- **Navy Dark:** `#091119` (`--brand-navy-dark`)
- **Accent Amber/Gold:** `#D6BA34` (`--color-brand-accent-gold`, `--brand-yellow`)
- **Semantic Error/Rose:** `#EF4444` (`--error`)
- **Surfaces (Light):** `#F4F6F7` (Page), `#FFFFFF` (Card/Elevated)
- **Surfaces (Dark):** `#091119` (Page), `#132231` (Card), `#263744` (Elevated)

### Derived SHAHEEN Tokens
All SHAHEEN visual properties are derived directly from the canonical system:

```css
:root {
  /* SHAHEEN Visual Core Tokens */
  --shaheen-core: var(--brand-green, #8BB83C);
  --shaheen-core-shadow: var(--brand-green-dark, #70952F);
  --shaheen-core-highlight: var(--brand-green-light, #A1C04F);
  --shaheen-glow: rgba(139, 184, 60, 0.45);
  --shaheen-eye: #FFFFFF;
  --shaheen-energy: var(--brand-green-light, #A1C04F);
  --shaheen-orbits-primary: var(--brand-green, #8BB83C);
  --shaheen-orbits-secondary: var(--color-blue-500, #2F6B87);

  /* SHAHEEN State Glows */
  --shaheen-state-idle: rgba(139, 184, 60, 0.35);
  --shaheen-state-thinking: rgba(214, 186, 52, 0.50);
  --shaheen-state-responding: rgba(161, 192, 79, 0.60);
  --shaheen-state-success: rgba(139, 184, 60, 0.70);
  --shaheen-state-warning: rgba(214, 186, 52, 0.65);
  --shaheen-state-error: rgba(239, 68, 68, 0.55);
}

.dark {
  --shaheen-glow: rgba(139, 184, 60, 0.25);
  --shaheen-state-idle: rgba(139, 184, 60, 0.20);
  --shaheen-state-thinking: rgba(214, 186, 52, 0.35);
  --shaheen-state-responding: rgba(161, 192, 79, 0.40);
}
```

---

## K. SHAHEEN Lab Contract (`/shaheen-lab`)

### Route & Access Control
- **Path:** `/shaheen-lab`
- **Environment:** Development and Staging only (guarded in production via `process.env.NODE_ENV !== 'production'`).
- **Purpose:** Isolated testing, benchmarking, and visual sign-off of the 3D SHAHEEN Core without network dependencies.

### Specification & Controls
1. **Interactive Stage:**
   - Central view displaying `Interactive3DOrb` at scalable sizes (Hero 192px, Large 128px, Medium 64px, Compact 32px).
2. **State Emulation Panel:**
   - Radio selector for: `Idle`, `Thinking`, `Responding`, `Success`, `Warning`, `Error`, `Disabled`.
3. **Motion & Subsystem Toggles:**
   - `Idle Rotation`: Checked / Unchecked
   - `Orbit Motion`: Checked / Unchecked
   - `Particles / Beads`: Checked / Unchecked
   - `Eye / Emblem Glow`: Checked / Unchecked
   - `Emblem Mode`: Surface (curved on sphere) / Camera (facing screen)
4. **Performance & Quality Controls:**
   - `Quality Level`: Low (variant 1) / Medium (variant 2) / High (variant 3)
   - `Reduced Motion Override`: System / Force Reduced / Force Normal
   - `FPS Meter`: Real-time rendering framerate display
   - `Draw Call & Memory Telemetry`: Active WebGL programs and geometry buffer size
5. **Action Triggers:**
   - `Trigger Success Pulse` (fires 1.2s state flash then returns to previous)
   - `Trigger Warning Pulse`
   - `Trigger Error Flash`
   - `Reset Orientation` (smooth cubic slerp)

---

## L. Security & RBAC Invariants

### Immutable Guard Rules
1. **Non-Authoritative Personality:**
   - SHAHEEN is a conversational interface and domain personality. SHAHEEN does **not** decide, evaluate, or grant authorization.
2. **Backend Authority:**
   - All permissions are evaluated exclusively by the server via `AuthActor` session verification, verified JWT claims, and database constraints.
   - `getCapabilitiesForActor(actor)` strictly controls what tools the LLM can see.
3. **No Prompt Injection Bypass:**
   - The user cannot prompt the model to "ignore permissions," "act as admin," or "execute as doctor." Any such attempt is blocked server-side because the tool registry never exposes unauthorized tools to the session.
4. **Action Proposal Confirmation Invariant:**
   - No data-altering action can be performed directly by SHAHEEN.
   - All mutating actions (e.g. creating tasks, broadcasting announcements, submitting grades) must generate a structured Proposal Card.
   - Execution requires an explicit human user interaction (clicking the UI Confirm button). The model is completely incapable of executing actions from chat affirmative words ("yes", "confirm", "نفذ").
5. **Clear Permission Refusal Tone:**
   - When a requested record or action falls outside the user's role, SHAHEEN must state clearly and politely in the user's language that the data is not accessible within their account permissions, without exposing internal database schemas or API endpoints.

---

## M. Product Identity Contract

### Canonical Specifications
- **Name:** SHAHEEN
- **Arabic Name:** شاهين
- **Core Archetype:** The Peregrine Falcon of Knowledge — high-altitude vision, lightning precision, disciplined intellect.
- **Core Character Traits:**
  1. **Intelligence (ذكاء):** Deep understanding of academic structures, bylaws, and student pathways.
  2. **Vision (بصيرة):** Synthesizes cross-domain data into clear priorities.
  3. **Precision (دقة):** Relies strictly on verified facts and official citations; never fabricates.
  4. **Speed (سرعة):** Immediate, responsive, streamlined assistance.
  5. **Control (انضباط):** Calm, grounded, adheres strictly to governance rules.
- **Tone of Voice:**
  - Calm, confident, direct, respectful, non-theatrical.
  - Never arrogant, never fawning, does not overclaim capabilities.
- **Role Adaptation Guidelines:**
  - **Student View:** Clear, structured, encouraging, supportive, and accessible. Avoids bureaucratic jargon; focuses on academic success and next steps.
  - **Doctor / Faculty View:** Professional, academic, organized, respecting academic workload and course management realities.
  - **Administration View:** Concise, executive, operational, grounded in verified metrics, rosters, and institutional workflows.

---

## N. Conflict Risks Between Agents

To ensure smooth collaboration between **ANTIGRAVITY** and **CODEX**, the following boundaries are strictly enforced:

1. **File Overlap Prevention:**
   - Antigravity must never edit `renderer.js` or `Interactive3DOrb.tsx`.
   - Codex must never edit `AiAssistantPage.tsx`, `AiAssistantAvatar.tsx`, `index.css`, or `i18n/*.json`.
2. **Prop Interface Stability:**
   - Any new props added to `Interactive3DOrbProps` (e.g. `state: ShaheenApplicationState`, `quality: 'low' | 'medium' | 'high'`) must be non-breaking and backwards-compatible with defaults.
3. **CSS Class Scoping:**
   - All 3D WebGL styling remains isolated within `.orb3d` and `orb.css`.
   - Antigravity handles global tokens in `index.css` under the `--shaheen-*` namespace.
4. **Vite Build Integrity:**
   - Neither agent may modify root build aliases, Tailwind core plugins, or deployment configs without explicit mutual alignment.

---

## O. Recommended Execution Order

```
[ PHASE 0: Baseline & Contract ] <--- CURRENT (Completed)
               │
               ▼
[ GATE 1: User Approval of Implementation Contract ]
               │
               ▼
┌───────────────────────────────────────────────┐
│           PARALLEL PHASE 1 EXECUTION          │
├───────────────────────┬───────────────────────┤
│ CODEX:                │ ANTIGRAVITY:          │
│ 1. Extend renderer.js │ 1. Define tokens in   │
│    (state uniforms,   │    index.css          │
│     quality tiers)    │ 2. Create ShaheenBadge│
│ 2. Touch-action fix   │ 3. Update i18n locales│
│ 3. Build /shaheen-lab │ 4. Update system      │
│                       │    prompt personality │
└───────────────────────┴───────────────────────┘
               │
               ▼
[ GATE 2: User Approval in /shaheen-lab ]
               │
               ▼
[ PHASE 2: Integration & Wiring (ANTIGRAVITY) ]
- Connect Shaheen states to Interactive3DOrb
- Integrate ShaheenBadge in AiAssistantPage header & transcript
- Test full flow: idle -> thinking -> streaming -> success/error
               │
               ▼
[ GATE 3: End-to-End Visual & Functional Review ]
               │
               ▼
[ PHASE 3: Hardening & Performance Benchmarking (JOINT) ]
- Reduced motion validation
- Touch drag validation on iOS / Android
- WebGL crash / context loss verification
- Final Code Review & Quality Gates
```

---

## P. Blockers & Risks
- **No blocking architectural issues:** The existing Three.js renderer, error boundaries, fallback system, and RBAC backend are robust and clean.
- **Zero Breaking Risk:** Because Phase 0 introduces no code changes and all subsequent phases use non-breaking extensions, existing production functionality remains fully stable throughout the transformation.
