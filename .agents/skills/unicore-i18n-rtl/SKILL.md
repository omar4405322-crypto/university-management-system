---
name: unicore-i18n-rtl
description: Arabic and English (RTL and LTR) rules for UniCore's university-app covering i18n keys, direction, Tailwind logical utilities, typography, direction-sensitive icons, number and date formatting and RTL tests. Use when adding or changing UI text, layout, icons, tables, dates or numbers, or when writing RTL tests.
---

# UniCore i18n and RTL (artifacts/university-app)

## Facts (checked in the code on 2026-11-01)
- Stack: i18next 26 and react-i18next 17. Initialised in `src/i18n/index.ts`, imported in `src/main.tsx`. Dictionaries: `src/i18n/ar.json` and `src/i18n/en.json` (one `translation` namespace, 3438 lines each). Default and fallback language: `ar`. Supported: `ar`, `en`.
- The language is stored in `localStorage` under the key `language`. `src/context/LanguageContext.tsx` sets `document.documentElement.dir` and `.lang`; `index.html` has an inline script that does the same before React loads; `App.tsx` also sets `dir` on its root div.
- There is no `.rtl` class. Use `[dir="rtl"]` selectors, Tailwind `rtl:` / `ltr:` variants, and `isRTL` from the language context.
- Keys are nested objects with dot paths in camelCase (`aiAssistant.title`, `courses.editCourseTitle`). Only `roles.*` uses UPPER_SNAKE_CASE, to match backend enums. A key missing in `en` falls back to `ar`; a key missing in both renders the raw key.
- Two tests enforce identical key sets in `ar.json` and `en.json`: `tests/arabic_rtl_localization_phase6.test.mjs` and `tests/p4_02_language_parts_translation.test.mjs`. Keep them green.

## Rules for every UI change
1. Text. No hard-coded user-visible text, `aria-label`, `title` or `placeholder`. Use `t('namespace.key')` and add the key to BOTH dictionaries in the same change. Do not write inline `isRTL ? '<Arabic text>' : '<English text>'` ternaries for text; use keys.
2. Layout. Use logical utilities: `ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`, `text-end`, `border-s`, `border-e`, `rounded-s-*`, `rounded-e-*`. Do not add `ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `text-left`, `text-right` for layout that must mirror. Use `rtl:` / `ltr:` only when no logical utility exists (sticky columns, gradients, shadows). Physical utilities are allowed only for things that must not mirror, with a short comment.
3. Icons. Directional icons must flip in RTL: `rtl:rotate-180` for arrows and chevrons (`ArrowLeft`, `ArrowRight`, `ChevronLeft`, `ChevronRight`, `ChevronsLeft`, `ChevronsRight`) and `rtl:-scale-x-100` for `Send`, `LogOut`, `ExternalLink`. This matches breadcrumbs, pagination and the carousel. Do not flip symmetric icons (search, check, plus, calendar).
4. Typography. Fonts come from theme tokens in `src/index.css` (`--font-sans-ar` IBM Plex Sans Arabic, headings Cairo, `--font-mono` IBM Plex Mono). Never set `letter-spacing`, `tracking-*` or inline `letterSpacing` on text that can be Arabic: it breaks letter joining. A global rule in `src/index.css` resets `tracking-*` to normal in RTL (except `.font-mono` and `dir="ltr"`), but custom CSS classes and inline styles bypass it. For uppercase tracking on Latin text use `ltr:tracking-wider`.
5. Mixed direction. Emails, codes, URLs, phone numbers and IDs inside Arabic text go in `<bdi>` or an element with `dir="ltr"` and `unicode-bidi: isolate` (see `TimeRange`, `MaskedEmail`, `TakeQuiz`).
6. Numbers and dates (PROPOSED DEFAULT, Omar to confirm): Western digits 0-9 in both languages. Use one shared helper in `src/utils` built on `Intl` with `numberingSystem: 'latn'` (locale `ar-EG-u-nu-latn` for Arabic) and the date-fns locales `ar` and `enUS` for names of months and days. Do not call `toLocaleString()`, `toLocaleDateString()` or `toLocaleTimeString()` without an explicit locale, and do not hard-code `'ar-EG'` or `'en-US'` at call sites. The locale comes from the language context.
7. Shared primitives. `src/components/ui` (sheet, toast, dropdown-menu, context-menu, menubar) contains physical classes. When you touch a file there, convert it to logical utilities and flip directional chevrons. `.select-brand` in `src/index.css` hardcodes `pr-10` and `background-position: right 1rem center` with no RTL override.

## Tests
- Test files are `artifacts/university-app/tests/*.test.mjs` using `node:test`. Read `artifacts/university-app/package.json` for the exact test command.
- Browser tests use `serveBuiltApp()` and `mockSessionPage(browser, { role, language, collapsed, user })` from `tests/helpers/built-app.mjs`. Pass `language: 'ar'`, mock the page's `/api/**` routes, then assert `html[lang="ar"]` and `html[dir="rtl"]`. Example: `tests/t8a_course_details_links_browser.test.mjs`. The built app must exist first.
- After any dictionary change run the two key-symmetry tests.

## Verification
- Back every claim about a class, key or line with `rg -n` output scoped to `artifacts/university-app/src` or `artifacts/university-app/tests`.
- Check the changed page in `ar` and `en`. List anything not checked under "Could not verify".

## Known backlog (do not copy these patterns; fix when you touch the file)
Confirmed with `rg` on 2026-11-01:
- `ArrowLeft` without a flip: `pages/courses/CourseGradeStructure.tsx` lines 367 and 400; `pages/courses/CourseGradebook.tsx` lines 548 and 593.
- Arabic text with letter-spacing: `components/FeatureShowcase.tsx` line 578 (inline `0.12em`); `.features-carousel-subtitle` (`letter-spacing: 2px`, CSS line 51) applied to a `<p>` at `components/FeaturesCarousel/FeaturesCarousel.tsx` line 160.
- `.select-brand` in `src/index.css` (see rule 7).
- Hard-coded English: `components/ui/ColumnPicker.tsx` lines 41 and 52; `components/ui/ViewManager.tsx` lines 95, 120 and 162.

Reported by an agent, not yet re-checked: pagination chevrons without a flip in `components/tasks/SubmissionsGradingModal.tsx`; `ml-1` on labels in several add and edit modals; user role shown as `user?.role.replace('_', ' ')` in `components/layout/Sidebar.tsx`; inconsistent number and date formatting in `ExamDetails.tsx`, `StudentDetails.tsx`, `AiAssistantPage.tsx`, `StudentAttendanceScanner.tsx`, `CountUp.tsx` and `FinanceDashboard.tsx`.