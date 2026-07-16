# UMS Landing Page Redesign — QoderWork Prompt

## Context (give the agent this first)
You are working inside an existing React 19 + TypeScript + Tailwind CSS v4 project — a University Management System (UMS) for October 6 University of Technology (O6U), Egypt. The landing page already exists at `localhost:5173` and has a working Navbar and Hero section with stats. This is a **full restructure of the public landing page**, not a new build from scratch — read the existing component tree first (likely under `src/pages/Landing` or similar — locate it before editing) and preserve the existing design tokens:

- Primary brand color: `#84BD3A` (olive-green)
- Brand navy: `#142632`
- Backgrounds: `bg-slate-50` (light) / `bg-slate-900` (dark)
- Cards: `bg-white dark:bg-slate-800 rounded-2xl`
- RTL is the primary layout direction (Arabic first). Use Tailwind **logical properties only**: `ms-`, `me-`, `ps-`, `pe-`, `border-s-`, `border-e-`, `text-start`, `text-end` — never `ml-`/`mr-`/`left-`/`right-`.
- i18n: every string must go through the existing `ar.json` / `en.json` translation files. Do not hardcode any visible text.
- Dual language: Arabic is primary/default, English is secondary.

## New design tokens to introduce (additive, not a replacement)
Add these to the existing Tailwind theme/config, alongside the current palette — do not remove or rename existing tokens.

- `--accent-gold: #E8A23D` — used **sparingly**: only for big stat numbers, small status badges, and one highlighted word in the hero headline. Never used as a background fill for large areas.
- Typography additions:
  - Display/headings: `Cairo` ExtraBold, slightly tightened tracking, for all `h1`/`h2`.
  - Body: keep existing body font (do not change paragraph styles).
  - **Numeric/data text**: any number (stats, course codes, percentages, counts) must use a monospace face — add `IBM Plex Mono` (or `font-mono` if a Tailwind mono stack is already configured) specifically wrapped around numeral spans, e.g. `<span className="font-mono">15,420+</span>`. Import via Google Fonts `@import` or `next/font`-equivalent depending on the project's font-loading pattern — check how the current Cairo/body font is loaded and follow the same pattern.

## Section-by-section spec

### 1. Navbar
Keep the current Navbar implementation as-is structurally. Only addition: a small search icon button placed beside the "تسجيل الدخول" button (icon-only, no label, opens a lightweight search input on click — can be a simple controlled input that's purely visual/non-functional for now, just wire the open/close state).

### 2. Hero Section — full rework
Two-column layout (right column = text content since RTL puts primary content on the right; left column = visual). On mobile, stack: text first, visual second.

**Right column (text):**
- Small pill/eyebrow label above the headline (already exists as "منصة إدارة أكاديمية متكاملة" — keep it, just restyle to sit inside the new layout instead of centered/floating over the photo).
- Headline: two lines, `Cairo ExtraBold`. Keep current copy structure ("جامعة 6 أكتوبر" / "التكنولوجية") — second line keeps the brand olive-green color as it already does. Do not introduce the gold accent here; the green-on-headline is already the page's accent move.
- One short paragraph (existing copy, keep as is).
- Two CTA buttons: filled olive-green primary ("ابدأ التسجيل الآن", with a leading icon since RTL = icon on the right of text), and an outline secondary ("تعرف علينا أكثر"). Reuse existing button components/styles if they exist in the codebase.

**Left column (visual) — THE SIGNATURE ELEMENT:**
Replace the current full-bleed background photo with a contained visual card:
- A stylized, simplified preview of the platform's own `TimetableGrid` component — a small grid showing 3–4 days (Arabic day names: الأحد، الإثنين، الثلاثاء) as columns and 3–4 time slots as rows, with a few colored sample blocks (use the existing course/section color conventions if any exist in `TimetableGrid.tsx`, otherwise default to olive-green/slate blocks). This should visually reference the real component, not be a generic illustration — if `TimetableGrid.tsx` exists, base the simplified preview's visual language directly on it (same border-radius, same card styling, same color blocks) so it looks like a real screenshot of the product, not stock art.
- Render it inside a `bg-white dark:bg-slate-800 rounded-2xl` card with a soft shadow, slightly rotated or with a subtle floating/parallax hover (small, restrained — a few degrees of rotation or a 4-6px translateY on hover, nothing more).
- Overlay a small status badge on top of the card, e.g. a pill that reads "0 تعارضات" or "تم التحقق تلقائيًا ✓" (auto-validated) with a small green dot — this should tie to the real four-layer conflict validation system from the backend. Keep copy honest and simple — i18n key required.
- Keep the campus photo, but demote it: use it as a smaller decorative background fragment behind/around the timetable card rather than the dominant full-bleed image, OR move it down into the new "عن الجامعة" (About) section as a proper full-width photo there instead. Pick whichever reads cleaner once built — note both options to the user in your summary so they can choose.

### 3. Stats Card — floating overlap
Move the 5 stats (Top 20, 30+, 10+, 15,420+, 8) out of being layered on the hero photo. Make them a **separate white card component** (`bg-white dark:bg-slate-800 rounded-2xl shadow-lg`) that sits with a negative top margin so it visually overlaps the bottom of the Hero section and the top of the next section (e.g. `-mt-16` or similar, test for the right value against final hero height). Each stat: circular icon badge (existing olive-green-tinted circle style) + number in `font-mono` + short label + one-line description underneath (currently missing — add it, e.g. under "Top 20": "ضمن أفضل 20 جامعة تقنية" — needs an i18n key, ask the user for real copy if unsure, otherwise placeholder clearly marked `TODO: confirm copy`).

### 4. Colleges Section ("الكليات")
- Small colored eyebrow label: "الكليات" in olive-green, above a large `h2` heading (Cairo ExtraBold) like "اختر مسارك الأكاديمي" (placeholder copy — confirm with user).
- Below: a horizontal row of cards (grid on desktop, horizontal scroll-snap on mobile) — one per college, each with an image/icon, college name, and short description. Pull real college names from the existing data/seed if available in the codebase (check Prisma schema/seed for College entities) rather than inventing fictional ones.

### 5. Why Us Section ("ليه تختارنا")
Grid of 3–4 cards, same visual language as the stats cards (icon badge + heading + description) so the two sections feel like one family. Content must reflect real product facts, not generic marketing fluff — e.g. "4 مستويات صلاحيات: من المدير العام للطالب" (role hierarchy), "نظام جدولة ذكي يكتشف التعارضات تلقائيًا" (the conflict validation system), "دعم كامل للغة العربية مع تخطيط RTL أصلي". Confirm exact wording with the user before finalizing copy if uncertain.

### 6. About Section ("عن الجامعة")
Split layout: image on one side, text on the other (alternate which side vs. the Hero for rhythm — if Hero put visual on the left, put the About photo on the right, or vice versa). If the campus photo was demoted out of the Hero in step 2, this is where it can live as the primary photo.

### 7. CTA Banner
Full-width band, `bg-[#142632]` (navy) background, white text, centered or RTL-aligned heading + single primary CTA button (olive-green). Keep it short — one heading, one line of supporting text, one button.

### 8. Footer
Standard footer: logo + short tagline, link columns (الرئيسية، عن الجامعة، الكليات، التواصل), social icons, copyright line. Match `bg-slate-900` dark footer convention if that's the existing pattern elsewhere in the app — check existing Footer component before creating a new one.

## Engineering constraints — do not skip these
1. Search the codebase first for any existing Hero/Landing/Footer/StatsCard components before creating new files — extend/refactor existing ones rather than duplicating.
2. Every visible string goes into `ar.json` and `en.json` under a clear new namespace, e.g. `landing.hero.*`, `landing.stats.*`, `landing.colleges.*`. Do not leave hardcoded Arabic or English strings in JSX.
3. All spacing/alignment must use RTL logical Tailwind classes — verify by checking how the page renders with `dir="ltr"` (English) as a sanity check; layout should mirror correctly, not break.
4. Keep TypeScript strict — no `any`, proper prop typing for any new components (`StatsCard`, `CollegeCard`, `TimetablePreviewCard`, etc.).
5. Responsive: mobile-first, test at 375px, 768px, 1280px. The two-column Hero must stack cleanly on mobile (text above visual).
6. Respect `prefers-reduced-motion` for the hover/float animation on the timetable preview card — disable the transform animation when reduced motion is requested.
7. After building, give a short summary of: (a) which existing components you reused vs. created new, (b) where you used placeholder copy that needs confirmation, (c) the two options for the campus photo placement (decorative hero fragment vs. About section) and which one you went with and why.

## What NOT to do
- Do not invent a new color palette outside the tokens listed above.
- Do not use stock numbered markers (01 / 02 / 03) anywhere — none of these sections are a sequential process.
- Do not make the timetable preview card interactive/functional — it's a visual reference only, not a live data component.
- Do not change the existing Navbar's core link structure.
