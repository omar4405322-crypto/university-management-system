<!-- This file is the project black box. Every UI change 
must be logged here with: task number, what changed, 
which files, and why. -->
# UI/UX Improvement Log
## Project: University Management System (O6U)
## Started: June 27, 2026

---

## Phase 1 â€” Technical Foundation Fixes

### Task 1: RTL Logical Properties
**Prompt given:** Replace all manual RTL ternary checks in 
AppShell.tsx and Sidebar.tsx with Tailwind CSS logical properties 
(ms-*, ps-*, start-0, border-e, -end-3)
**Files modified:** AppShell.tsx, Sidebar.tsx
**What was done:** Replaced isRTL ternary blocks with logical 
properties. Removed sidebarInset ternary. Used ms-auto, start-0, 
border-e, -end-3.

### Task 2: CSS Grid Sidebar Layout
**Prompt given:** Refactor AppShell layout from margin-based 
sidebar pushing to CSS Grid with animated grid-template-columns
**Files modified:** AppShell.tsx
**What was done:** Converted root container to md:grid with 
--sidebar-width CSS variable toggling between 80px and 288px. 
Removed all sidebarInset margin logic.

### Task 3: Scrollbar Accessibility
**Prompt given:** Fix .custom-scrollbar thumb width from 4px 
to 6px resting / 8px on hover with smooth transition
**Files modified:** index.css
**What was done:** Updated scrollbar width, added hover expansion, 
added transition. Also fixed missing :root { syntax error that 
was causing a Tailwind build failure.

### Task 4: Sidebar Breakpoint lg
**Prompt given:** Change all sidebar-related md: breakpoints 
to lg: across AppShell.tsx, Sidebar.tsx, Header.tsx
**Files modified:** AppShell.tsx, Sidebar.tsx, Header.tsx
**What was done:** 6 class changes across 3 files. Sidebar now 
switches to desktop mode at 1024px instead of 768px.

### Task 5: PageWrapper + Route Cleanup
**Prompt given:** Create PageWrapper.tsx component and replace 
all inline <div className="animate-page"> wrappers in App.tsx
**Files modified:** App.tsx, created PageWrapper.tsx
**What was done:** Created src/components/layout/PageWrapper.tsx. 
Updated 33 Route definitions in App.tsx.

---

## Phase 2 â€” Visual Design Improvements

### Task 6: i18n Key Fix
**Prompt given:** Find and fix raw i18n keys appearing as visible 
text in UI: "common.change" and "COMMON.NAME"
**Files modified:** src/i18n/en.json, src/i18n/ar.json
**What was done:** Added missing translation values for `change` and `name` under the `"common"` namespace in English and Arabic translation files. The components were already correctly referencing these keys, resolving the issue.

### Task 7: Hero Banner Redesign
**Prompt given:** Redesign the Hero Banner to be a modern welcome card with a gradient background, decorative overlay, and glassmorphic buttons, while reclaiming vertical space.
**Files modified:** AdminDashboard.tsx, DoctorDashboard.tsx, StudentDashboard.tsx
**What was done:** Removed background images, added a linear gradient from brand-navy to brand-primary green, added a decorative semi-transparent circle, reduced height to `h-40`, and styled actions as glass buttons.

### Task 8: KPI Stat Cards Redesign
**Prompt given:** Upgrade dashboard stat cards with tinted icon backgrounds, thin colored left border accents, hover lift animations, larger 3xl font size, and move trend/change indicators below the number.
**Files modified:** AdminDashboard.tsx, DoctorDashboard.tsx, StudentDashboard.tsx
**What was done:** Replaced soft icon background classes with dynamic tinted opacities, added border-s-4 accents matching the icon color, added hover lift/shadow animations, bumped typography to text-3xl, and restructured the layout to move the trend indicator directly below the stat value.

### Task 9: Department Cards Redesign
**Prompt given:** Upgrade the Department cards with a top gradient strip, centered circular icon container with soft tint, refined typography, and full-width split action buttons.
**Files modified:** DepartmentsList.tsx
**What was done:** Added a `h-2` gradient header strip to the cards, restructured Checkbox and Action button positions, centered a rounded-full icon container with a `bg-brand-primary-500/10` background, styled the department and college typography to be centered and modern, and split the bottom action buttons into full-width 50/50 buttons with hover highlights.

### Task 10: College Details Page Redesign
**Prompt given:** Upgrade the College Details page with a hero-style gradient banner header, custom glass action buttons, customized stat boxes with dynamic left border accents and soft tinted icon circles, and a refined assigned admin card with small outline button fix.
**Files modified:** CollegeDetails.tsx
**What was done:** Replaced the plain college header with a full gradient block (`from-[#142632] to-[#9EBC48]`), aligned the title and metadata, styled actions as glass buttons, added left border accents to the 3 stat cards based on color context (navy, blue, green), wrapped stat icons in a `/10` tinted circular wrapper, increased typography to text-3xl font-black, and added a border-s-4 accent with small outline action details to the assigned admin block.

### Task 11: Global Layout Visual Polish & 2FA Banner Upgrade
**Prompt given:** Polish the main Header visual style (floating look, focus rings on search, avatar ring, and badge pulse animation) and make the SuperAdmin 2FA banner less intrusive with padding reductions, text adjustments, and session dismiss functionality.
**Files modified:** Header.tsx, GlobalSearch.tsx, SuperAdminTwoFactorBanner.tsx
**What was done:** Updated Header with a semi-transparent `bg-white/80 dark:bg-slate-900/80` backdrop blur and shadow, added `animate-pulse` to the notification unread badge, and added a hover ring to the avatar circle. Added a soft focus ring to the search input button container in `GlobalSearch.tsx`. Redesigned `SuperAdminTwoFactorBanner.tsx` with reduced `py-2` padding, `text-xs` sizes, smaller action button, and integrated a `useState` dismiss button (X icon) to let administrators close it for the current session.

---
### Task 12: Admin Dashboard Redesign (Simplicity is Elegance)
**Prompt given:** Redesign the AdminDashboard.tsx with a clean, simple, and professional layout following the "simplicity is elegance" philosophy, restricting KPIs to 4, reorganizing grid columns, and removing non-essential visual details.
**Files modified:** AdminDashboard.tsx, en.json, ar.json
**What was done:** Redesigned Hero to be a dark navy card without images/blur. Grouped the 4 main KPI stats with custom left borders and top-right icon wrappers. Replaced the layout with a 1/3 subscription pass and 2/3 academic trend grid, followed by equal-width columns for charts (financial and college distribution) and utility blocks (system health and activity log). Added and fixed the key `"common.active"` in both translation files.

---

### Task 13: Brand Primary Color Update
**What was done:** Updated brand-primary color palette in index.css to a richer olive-green: #84BD3A (500), #A8D45A (300), #6A9E2A (600). Also updated brand-green flat aliases and :root/.dark variables.

### Task 14: Sidebar Hover Effect
**What was done:** Updated inactive nav item hover in Sidebar.tsx to use subtle bg-white/5 full-width highlight with transition-all duration-150. Removed previous heavy glow effect.

### Task 15: KPI Cards Redesign (Clean)
**What was done:** Removed colored border-s-4 and icon backgrounds from AdminDashboard KPI cards. Cards now clean white with group-hover color tint (brand color /5 opacity) and icon color intensifies on hover per card color category.

### Task 16: Colleges Page Visual Polish
**What was done:** Redesigned CollegesList.tsx. Scaled down title and stylized sub-header, modified cards border-radius to rounded-2xl and applied subtle translate-y hover, aligned description texts with line-clamp limits, converted assigned admin section to text-only page background block, and standardized the actions to be custom outlined buttons. Styled the Add College trigger as solid brand-primary.

### Task 17: Colleges Page RTL and Button Hover Improvements
**What was done:** Updated CollegesList.tsx to resolve RTL translation alignment (added `dir="auto"` and `text-start` for description paragraph) and modified card title headings to render Arabic names (`college.nameAr`) when `isRTL` is true. Standardized action buttons to use identical classes and added a high-fidelity sliding backdrop overlay hover transition.

### Task 18: College Details Page Translation & Badges
**What was done:** Updated CollegeDetails.tsx to dynamically load college names in Arabic (`college.nameAr`) when `isRTL` is active, combined separate English and Arabic department columns into a single column with primary/secondary structure nested by active language (`isRTL`), and replaced the heavy success badge with a refined status pill.

### Task 19: College Details Page Layout Redesign
**What was done:** Redesigned CollegeDetails.tsx layout to follow consistent `rounded-2xl` borders and structure. Configured the Header card with breadcrumbs, title name, status pill, and action buttons aligned to the left. Transformed stat cards to use a dark accent stripe with `bg-brand-navy-500` and white text/icons. Cleaned up the Assigned Admin card to remove the amber background. Refactored the Departments table to render correct headers (`Ø§Ù„Ù‚Ø³Ù…` start-aligned, `Ø§Ù„Ù…Ù‚Ø±Ø±Ø§Øª` and `Ø§Ù„Ø·Ù„Ø§Ø¨` centered, `Ø¥Ø¬Ø±Ø§Ø¡Ø§Øª` centered), align numbers (centered, `text-brand-text-primary`), position action buttons together on the end side, and apply alternating row hover.

### Task 19b: College Details Table & Color Fix
- Fixed table headers alignment and column structure
- Added navy stat cards strip to break white monotony
- Action icons end-aligned

### Task 20: Sidebar Hover Full Width Fix  
- Fixed hover to cover full width of nav items
- Changed to bg-white/5 subtle tint
- Removed heavy glow effect

---

### Task 21: College Details Page Layout Inconsistencies Fix
**Prompt given:** Fix College Details Page layout inconsistencies (CollegeDetails.tsx)
1. Assigned Admin Card layout.
2. Stat Cards redesign.
3. Remove arrow icon next to college title.
4. Verify 2FA banner dismiss (X) button is visible and functional.
5. Departments Table center number values.
**Files modified:** CollegeDetails.tsx, SuperAdminTwoFactorBanner.tsx
**What was done:** 
- Restructured the Assigned Admin Card to use a proper flex `justify-between items-center` layout without the unnecessary nested wrapper div, keeping padding consistent.
- Reverted the 3 stat cards from dark navy back to light cards with a thin left accent stripe (`border-s-4`), matching the "simplicity is elegance" pattern.
- Removed the redundant arrow icon (â†’) next to the college title.
- Added a state-driven dismiss (X) button to the `SuperAdminTwoFactorBanner.tsx` component so it can be properly dismissed.
- Wrapped the number values in the Departments Table with `w-full flex justify-center text-center` to ensure they are perfectly centered, matching the headers.

---

### Task 22: Refine College Details Stat Cards
**Prompt given:** Refine College Details stat cards - remove side border accent, emphasize icon color instead (CollegeDetails.tsx)
1. Remove the colored left/end border accent (border-s-4).
2. Make the icon itself the main color highlight: increase background tint to /15 opacity, add colored glow/shadow, intensify glow on hover.
3. Keep everything else as-is.
**Files modified:** CollegeDetails.tsx
**What was done:** 
- Removed the `border-s-4` classes from the three stat cards, leaving a plain neutral border.
- Increased the opacity of the icon circle background tints from `/10` to `/15`.
- Added custom drop shadows around the icon circles (`shadow-[0_0_12px_rgba(...)]`) matching each icon's specific color (brand-primary green and blue).
- Implemented a hover effect (`group-hover:-translate-y-1` on the card and `group-hover:shadow-[0_0_20px_rgba(...)]` on the icon) to slightly lift the card and intensify the colored glow.

---

### Task 23: Increase Color Intensity of Stat Card Icons
**Prompt given:** Increase color intensity of stat card icons (CollegeDetails.tsx)
1. Icon background tint: increase opacity to /25.
2. Icon color: use stronger shade (brand-primary-600 and blue-600).
3. Glow shadow: increase opacity to 0.45 and blur to 15px.
4. On hover: intensify glow shadow to 0.65 opacity and 25px blur.
**Files modified:** CollegeDetails.tsx
**What was done:** 
- Increased the opacity of the icon circle background tints from `/15` to `/25`.
- Updated the icon SVG colors to use bolder shades (`text-brand-primary-600` and `text-blue-600`) to prevent washed-out appearance.
- Adjusted the resting box-shadow to be more visible by increasing the blur radius to `15px` and opacity to `0.45` (`shadow-[0_0_15px_rgba(...)]`).
- Intensified the hover box-shadow effect to be even more pronounced by increasing the blur radius to `25px` and opacity to `0.65` (`group-hover:shadow-[0_0_25px_rgba(...)]`).

---

## Notes for Team
- All prompts were directed by Claude (AI Technical Director)
- Executed via Antigravity IDE using Gemini 3.1 Pro (High) and Gemini 3.5 Flash
- RTL and Dark Mode are fully preserved across all changes
- No logic, roles, or routes were modified in any task

---

### Task 25: Fix Secondary Runtime Crash and Console Warning on Departments Page
**Prompt given:** Fix second runtime crash on Departments page - "loading is not defined" & Re-investigate regression
1. Fix undefined `loading` variable.
2. Fix `noPadding` prop warning in `Card.tsx`.
3. Fix regression where `useDepartments` was undefined again.
**Files modified:** DepartmentsList.tsx, Card.tsx
**What was done:** 
- In `DepartmentsList.tsx`, corrected the destructuring of `useDepartments` from `loading: _loading` to `loading` to match its usage in the component tree, preventing a ReferenceError on render.
- In `Card.tsx`, updated the component signature to explicitly accept and destructure the `noPadding` prop, preventing it from being leaked down to the underlying `div` element and resolving the React console warning.
- **Regression Fix**: The original fix for `useDepartments is not defined` (Task 24) failed to persist (likely due to a file conflict or revert). Re-added the missing `import { useDepartments } from '../../hooks/useDepartments';` to `DepartmentsList.tsx` and verified it compiles.
- **Auth Errors Investigation**: Confirmed that the 401 Unauthorized errors (`/api/auth/refresh`, etc.) are *expected behavior* when a user's session expires or is invalid. `AuthContext` tries to refresh the token, naturally gets a 401 from the API, and gracefully catches it to redirect to the login page. This is not a bug.

---

### Task 26: Fix Broken Filter Dropdown and Untranslated UI Strings on Departments Page
**Prompt given:** Fix broken filter dropdown and untranslated UI strings on Departments page (DepartmentsList.tsx + its sub-components)
1. Fix broken college filter dropdown rendering stacked inline.
2. Add missing i18n keys for Select All, density toggles, and college name badge.
3. Fix department name truncation for long Arabic text.
**Files modified:** DepartmentsList.tsx, ViewManager.tsx, TruncatedText.tsx, index.css, en.json, ar.json
**What was done:** 
- Replaced the Radix `<Select>` with a native `<select>` element styled as a collapsed dropdown, incorporating logical CSS padding (`ps-11 pe-10`), absolute layout positioning, and a chevron icon (`ChevronDown`), correcting the broken stacked inline layout.
- Added i18n keys to translation files (`en.json`, `ar.json`) for `departments.selectAll` ("ØªØ­Ø¯ÙŠØ¯ Ø§Ù„ÙƒÙ„" / "Select All"), `common.compact` ("Ù…Ø¶ØºÙˆØ·" / "Compact"), `common.comfortable` ("Ù…Ø±ÙŠØ­" / "Comfortable"), and `common.defaultView` ("Ø§Ù„Ø¹Ø±Ø¶ Ø§Ù„Ø§Ù�ØªØ±Ø§Ø¶ÙŠ" / "Default View").
- Translated density toggles in `DepartmentsList.tsx` and modified `ViewManager.tsx` to dynamically translate view names (like "Default View") through `t(view.name)`.
- Updated the college name badge above each card to show the Arabic name (`college.nameAr`) when RTL is active.
- Added `line-clamp-ltr` and `line-clamp-rtl` utilities to `index.css` and added `lineClamp` prop to `<TruncatedText>` to allow long titles to wrap nicely to two lines without clipping.

---

### Task 27: Fix Layout Overflow, Redundant Tooltips, and Dropdowns on Departments Page
**Prompt given:** Fix layout overflow, redundant hover tooltips, and Default View dropdown on Departments page
1. Fix page title overflow in PageHeader component.
2. Remove redundant tooltips on department cards.
3. Fix the icon color going white/blank on card hover.
4. Translate and fix dropdown alignment for Default View dropdown.
5. Standardize dividers color to a neutral tone.
6. Verify "Select All" checkbox is functional instead of no-op.
**Files modified:** PageHeader.tsx, DepartmentsList.tsx, ViewManager.tsx, en.json, ar.json
**What was done:** 
- Adjusted `PageHeader.tsx` wrapper to include `w-full min-w-0` and `max-w-full md:max-w-2xl` on the header text container. Applied `break-words text-3xl sm:text-4xl md:text-5xl` to the display heading, ensuring the Arabic title wraps gracefully instead of overflowing past the viewport/sidebar.
- Removed the redundant `<TruncatedText>` wrapper (which rendered tooltips) from the department card component inside `DepartmentsList.tsx`, replacing it with standard header tags styled with `line-clamp-2` so titles wrap without redundant overlays.
- Removed hover state overrides (`group-hover:bg-...`, `group-hover:text-...`, etc.) from the card's inner icon container, ensuring the green department icon stays visible on card hover.
- Added `departments.defaultView` key to `en.json` and `ar.json` and set the initial default view name inside `defaultView` state accordingly.
- Repositioned the `ViewManager` popover class from `right-0` (LTR) / `left-0` (RTL) to `left-0` (LTR) / `right-0` (RTL), making the popover render inwards and preventing it from overflowing the viewport boundaries on small screens.
- Standardized card dividers to use `border-slate-200 dark:border-slate-700` consistently, removing custom border coloring issues.
- Fixed the functional logic of the "Select All" and card checkbox controls by replacing their native HTML `onChange` handlers with the proper Radix `onCheckedChange` callbacks, making the checkboxes fully functional.

---

### Task 28: Fix Inconsistent Hover Highlight on Department Card Stats
**Prompt given:** Fix inconsistent/distracting hover highlight on department card stats (DepartmentsList.tsx)
1. Remove heavy solid dark background fill on courses stat.
2. Standardize hover background to use a soft, neutral tint on both stat blocks.
3. Align typography, spacing, and hover transitions.
**Files modified:** DepartmentsList.tsx
**What was done:** 
- Removed asymmetrical heavy solid color hover backgrounds (`group-hover:bg-brand-navy-500` and the invalid `group-hover:bg-brand-brand-green-dark`) from the card's courses and students stat containers.
- Implemented a consistent, subtle hover treatment on both stat blocks (`group-hover:bg-slate-100 dark:group-hover:bg-slate-800`) to highlight clickability without visual clutter.
- Standardized text coloring (`text-brand-text-primary dark:text-brand-text-main`) inside the stat blocks to maintain high readability and clean contrast against the soft hover background.

---

### Task 29: Improve Page Visual Contrast and Fix Bulk-Selection Toolbar on Departments Page
**Prompt given:** Reduce excessive whiteness/flatness and fix bulk-selection toolbar on Departments page (DepartmentsList.tsx)
1. Set a subtle gray page background distinct from white cards.
2. Upgrade card design with border, shadow, and higher icon contrast.
3. Translate and reposition the bulk-selection toolbar to escape layout constraints.
**Files modified:** DepartmentsList.tsx, BulkActionToolbar.tsx, en.json, ar.json
**What was done:** 
- Added a `useEffect` inside `DepartmentsList.tsx` to dynamically apply a subtle gray page background (`bg-slate-50 dark:bg-slate-900`) to the parent `<main>` container on mount, restoring contrast and separating layout surfaces.
- Updated department cards to use a pure white background (`bg-white` / `dark:bg-slate-800`), explicit borders (`border-slate-200` / `dark:border-slate-700`), and a soft shadow (`shadow-sm`) to stand out from the page background.
- Increased the contrast on department icon circle backgrounds (`bg-brand-primary-100` / `dark:bg-brand-primary-900/30`) to prevent a washed-out appearance on white cards.
- Registered the `departments.selectedCount` translation key in `en.json` ("{{count}} Selected") and `ar.json` ("ØªÙ… ØªØ­Ø¯ÙŠØ¯ {{count}}").
- Integrated React Portal (`createPortal`) in `BulkActionToolbar.tsx` to render the toolbar directly into `document.body`, escaping CSS transform stacking contexts and ensuring it floats properly as a sticky overlay at the bottom of the viewport.
- Replaced the hardcoded count badge and label structure inside the toolbar with the translated `selectedCount` template string for cleaner localization.

---

### Task 30: Unify Card Action Buttons and Make Card Stats Clickable Links on Departments Page
**Prompt given:** Unify hover/active styling between footer action buttons + make stat numbers clickable navigation links on Departments page (DepartmentsList.tsx)
1. Unify Manage Schedules and Manage Curriculum buttons styling, hover effects, and transitions.
2. Convert card stat blocks (Courses & Students counts) into clickable navigation links scoped by department.
3. Apply polished hover transitions and underlines to interactive stat blocks.
**Files modified:** DepartmentsList.tsx
**What was done:** 
- Unified the action buttons inside the card footer: changed the Manage Schedules button styling to match the Manage Curriculum button's brand color (`text-brand-brand-green-dark` and `hover:text-brand-primary-600`).
- Added subtle micro-interactions to the footer buttons: on button hover (`group-hover/btn:`), the `ExternalLink` icon translates horizontally (`translate-x-0.5`) and the `Calendar` icon lifts vertically (`-translate-y-0.5`).
- Converted card stat blocks (Courses and Students count divs) into `Link` components routing to `/courses?departmentId={id}` and `/students?departmentId={id}` respectively.
- Styled both stat block links with a consistent hover treatment (`group-hover/stat:bg-slate-100 dark:group-hover/stat:bg-slate-700/80 cursor-pointer`), a text color shift (`group-hover/stat:text-brand-brand-green-dark`), and a number underline to indicate interactivity.

---

### Task 31: Remove Hover Underline from Department Card Stat Links
**Prompt given:** Remove underline from department card stat links on hover (DepartmentsList.tsx)
1. Remove `hover:underline` (or equivalent) from both card stat link text elements.
2. Keep hover background tint and text color shifts intact.
**Files modified:** DepartmentsList.tsx
**What was done:** 
- Removed the `group-hover/stat:underline` class from the courses and students count `<p>` tags inside `DepartmentsList.tsx`.
- Retained the rest of the hover transition styles, ensuring that the background shading (`hover:bg-slate-100`) and the text color change to the brand green remain fully operational.

---

### Task 32: Fix Department Filter Query Parameter, Missing Table Headers, and RTL Truncation on Courses Page
**Prompt given:** Fix department filter not applying from URL param + missing table headers + truncated college name on Courses page (CoursesList.tsx)
1. Read `departmentId` from query params, auto-select department/college on mount, and filter the course list.
2. Render explicit Table headers (`TableHeader` and `TableHead`) instead of passing them as a non-existent prop.
3. Show Arabic name of department/college in table rows and filters when RTL is active.
**Files modified:** CoursesList.tsx, useCourses.ts, department.service.ts
**What was done:** 
- Added a helper `getDepartmentsByCollege` to `department.service.ts` mapping to `/departments` with a college filter query parameter, preventing potential runtime crashes.
- Extended the `useCourses` hook in `useCourses.ts` to accept `collegeId` and `departmentId` in its options, automatically appending them to the query parameters and adding them to the `useCallback` dependency array to trigger updates when they change.
- In `CoursesList.tsx`, imported `useSearchParams` and read the `departmentId` query parameter on load. Implemented a `useEffect` to fetch the department metadata and dynamically auto-select both the clicked department and its parent college.
- Switched filter options for colleges and departments to render their Arabic names (`c.nameAr` / `d.nameAr`) when RTL is active.
- Added explicitly rendered `<TableHeader>` and `<TableHead>` blocks to the courses table in `CoursesList.tsx`, importing the required layout tags from `Table.tsx`.
- Changed the department cell renderer to display the Arabic department name (`course.department?.nameAr`) when `isRTL` is active, solving English truncation issues on Arabic layouts.

---

### Task 33: Full Visual Restructure of Courses Page
**Prompt given:** Full visual restructure of Courses page to match established design system (CoursesList.tsx)
1. Match page header pattern and action button.
2. Wrap the table and filter panel in proper Card containers with consistent padding, borders, and shadows.
3. Apply distinct header row backgrounds, row dividers, and hover states to the table.
4. Center-align numeric/status columns and style the UNASSIGNED badge properly.
5. Apply subtle gray page background tint.
**Files modified:** CoursesList.tsx
**What was done:**
- Set `min-h-screen bg-slate-50 dark:bg-slate-900` on the main page wrapper to apply the subtle background tint.
- Replaced the `border-none shadow-soft` filter panel and table wrappers with fully-styled `<Card>` components (`bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden p-4 md:p-6`).
- Upgraded table header and body rows with `bg-slate-50 dark:bg-slate-900/40`, `border-b border-slate-200 dark:border-slate-700`, and `hover:bg-slate-50 dark:hover:bg-slate-800/60` for distinct rows and hover interactions.
- Applied `text-center` alignment to the 'Instructor' and 'Students' table columns to match RTL alignment rules.
- Replaced the plain gray "Unassigned" text with a proper colored status badge using `Badge` styling classes for higher visibility.

### Task 34: Refine Courses Page Typography and Spacing
**Prompt given:** Reduce font weight on course name column + fix page header overlapping navbar (CoursesList.tsx)
1. Reduce course name typography weight to medium (font-medium).
2. Fix page header overlapping navbar by adding proper top spacing (pt-6) to the page wrapper and loading the page background tint via useEffect.
**Files modified:** CoursesList.tsx
**What was done:**
- Changed the font weight class of the course name `TableCell` from `font-black` to `font-medium` to match standard table rows.
- Replaced the `min-h-screen bg-slate-50 dark:bg-slate-900` wrapper classes with a simpler `pt-6` padding class, and moved the background tint styling to a `useEffect` hook that targets the parent `<main>` container on mount (preventing sticky header overlap issues).

### Task 35: Fix Empty Spacing and Add Stats Row on Courses Page
**Prompt given:** Fix excessive empty whitespace on Courses page layout (CoursesList.tsx)
1. Investigate the grid/flex layout wrapping the table card and filter card (fixed/capped height issues).
2. Add a stats row above the table (total courses, unassigned courses, total enrolled students) to fill layout space.
3. Check and adjust vertical spacing and ensure it scales properly.
**Files modified:** CoursesList.tsx, en.json, ar.json
**What was done:**
- **Root Cause Found (Layout Stretch):** The table card container had a hardcoded `min-h-[400px]` height, which caused a huge empty block when there were only a few rows (e.g. 5) of courses.
- **Fix Applied:** Changed `min-h-[400px]` to `min-h-0` to allow the table card to auto-adjust to its contents.
- **Added Supplementary Content:** Created a three-card stats row (`Total Courses`, `Unassigned Courses`, `Total Enrolled Students`) at the top of the page below the header using the established design system's KPI stats component layout and hover effects.
- **Localization:** Registered `unassignedCourses` translations in both `en.json` and `ar.json` for proper RTL support.

### Task 36: Fix and Implement Add Course Modal Functionality
**Prompt given:** Implement functional "Ø¥Ø¶Ø§Ù�Ø© Ù…Ù‚Ø±Ø±" (Add Course) button on Courses page (CoursesList.tsx)
1. Investigate how add modal logic is rendered on Courses page.
2. Fix parameter passing to CourseModal and incorrect fetch functions.
3. Clean up the onSubmit payload to omit non-model fields (e.g. collegeId) to prevent Prisma validation crashes.
**Files modified:** CoursesList.tsx, CourseModal.tsx
**What was done:**
- **Bug 1 (Modal Visibility):** Found that `CoursesList.tsx` was rendering `<CourseModal>` without passing the `isOpen` prop. Added `isOpen={isModalOpen}` to the JSX element.
- **Bug 2 (Undefined Method Crash):** Replaced all occurrences of the non-existent function `fetchFilteredCourses` inside the error/success retry callbacks with the correct `refetch` function.
- **Payload Sanitization:** Inside `CourseModal.tsx` `onSubmit`, destructured `collegeId` out of `data` to ensure the submitted payload matches the backend Prisma Course model schema exactly, preventing database-level insertion errors.

### Task 37: Translate Add Course Modal and Fix Submit Button Styling
**Prompt given:** Translate "Add New Course" modal to Arabic with i18n + fix invisible/unstyled submit button (AddCourseModal or equivalent component)
1. Add full i18n translations for all course modal text, labels, and placeholders to en.json/ar.json.
2. Replace hardcoded English strings in CourseModal.tsx with translation hooks.
3. Handle Arabic options rendering (c.nameAr/d.nameAr) in the College/Department selects.
4. Style the submit button with brand-primary green, custom shadows, hover states, active transitions, and disabled states.
5. Adapt spacing and label alignment using logical properties (e.g. ms-1) to support clean RTL structure.
**Files modified:** CourseModal.tsx, en.json, ar.json
**What was done:**
- **Full Translation Integration:** Registered translations under the `courses.addModal` namespace in both `en.json` and `ar.json` for all labels, headings, helpers, error messages, and buttons.
- **Dynamic Options and Spacing:** Updated select inputs to display college/department Arabic names (`nameAr`) in RTL mode. Changed margin classes from `ml-1` to the logical `ms-1` to align spacing automatically.
- **Button Styling Fix:** Replaced the unstyled submit button classes with active and hover-enabled classes (`bg-brand-primary-500 hover:bg-brand-primary-600 active:scale-95 text-white font-bold py-2 px-4 rounded-xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed`).

### Task 38: Style the Add Course Trigger Button
**Prompt given:** Style the "Ø¥Ø¶Ø§Ù�Ø© Ù…Ù‚Ø±Ø±" (Add Course) trigger button to be visible/prominent (CoursesList.tsx)
1. Style the trigger button inside PageHeader as a solid primary green action button with white text and a "+" icon.
2. Add hover, active click transitions, and padding properties.
**Files modified:** CoursesList.tsx
**What was done:**
- Passed styling classes (`bg-brand-primary-500 hover:bg-brand-primary-600 text-white rounded-xl active:scale-95 transition-all`) inside the `action` configuration of `<PageHeader>` in `CoursesList.tsx`, transforming the invisible/text-only trigger button into a prominent green action button matching the rest of the application.

### Task 40: Visual Redesign of WeeklySchedule Page
**Model used:** Gemini 3.5 Flash
**Prompt given:** Visual redesign of WeeklySchedule.tsx (route: /schedule) to match the established design system used elsewhere in the app.
**Files modified:** WeeklySchedule.tsx
**What was done:**
- Added a `useEffect` on mount to dynamically apply the subtle gray page background (`bg-slate-50 dark:bg-slate-900`) to the parent `<main>` container, restoring contrast and separating layout surfaces.
- Upgraded the error and empty-state placeholder Card styling, using `bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm`.
- Replaced the dark navy "Today" date block with a modern white KPI-style stat card incorporating a `border-s-4` green border accent, a soft tinted calendar icon wrapper (`bg-brand-primary-500/10`), and clean bold text styling.
- Restructured the desktop view grid table wrapper to use the standard Card container classes and padding (`bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden p-4 md:p-6`).
- Refactored the table headers to have a distinct header background (`bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700`) and removed all vertical cell lines (`border-r`) for a cleaner look.
- Replaced the repetitively rendered cell text "Ù„Ø§ ØªÙˆØ¬Ø¯ Ø¨ÙŠØ§Ù†Ø§Øª" (No Data) with a clean, minimal em-dash (`â€”`) character.
- Upgraded scheduled class cells with a starting border accent (`border-s-4 border-s-brand-primary-500`), a light tinted background (`bg-brand-primary-500/5 dark:bg-brand-primary-500/10`), a lighter course font weight (`font-medium`), and secondary instructor/room lines.
- Redesigned the mobile view schedule cards to use the matching white card wrapper, starting border accent, soft badge colors, and logical borders.

### Task 41: Visual Redesign of SchedulesList Page and ScheduleModal Component
**Model used:** Gemini 3.5 Flash
**Prompt given:** Visual redesign of SchedulesList.tsx (route: /schedules-management) and ScheduleModal.tsx to match the established design system.
**Files modified:** SchedulesList.tsx, ScheduleModal.tsx
**What was done:**
- Added a `useEffect` hook on mount to dynamically apply the subtle gray background (`bg-slate-50 dark:bg-slate-900`) to the main page container.
- Wrapped the search/filter panel and the schedules list/table panel in distinct, premium Card components (`bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden`).
- Upgraded the select dropdown elements in the filter row to use native styled select controls matching `CoursesList.tsx` filters, ensuring Arabic options (`nameAr`) render correctly when RTL is active.
- Refactored the schedules list layout from an implicit borderless table to a fully structured `Table` with an explicit `TableHeader` / `TableHead` component.
- Implemented hover effects (`hover:bg-slate-50 dark:hover:bg-slate-800/60`), distinct header backgrounds (`bg-slate-50 dark:bg-slate-900/40`), and aligned columns correctly (center-align for day/time/room, start-align for course/department, end-align for action menu buttons).
- Restyled the schedules empty state into a high-end card with a soft-circle calendar icon, formatted typography hierarchy, and a primary green trigger button.
- Restyled the header "Create Schedule" action button inside the PageHeader component to use a solid green design with a "+" icon.
- Polished the `ScheduleModal.tsx` pop-up form, updating input borders, margins, error alert styles, submit button active/hover states, and translating course selects using Arabic name attributes (`nameAr`) when RTL is active.

---

### Task 42: Visual Redesign of TimetableGrid and SlotModal
**Model used:** Gemini Pro
**Prompt given:** Visual redesign of TimetableGrid.tsx (route: /schedules/timetable) and its child components (TimeSlotCell.tsx, SlotModal.tsx) to match the established design system.
**Files modified:** TimetableGrid.tsx, TimeSlotCell.tsx, SlotModal.tsx
**What was done:**
- Added a `useEffect` hook in `TimetableGrid.tsx` to apply the page background tint (`bg-slate-50 dark:bg-slate-900`) to the main body on mount.
- Wrapped the filters bar and the grid table inside `TimetableGrid.tsx` in individual Card containers matching the established style (`bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 md:p-6`).
- Redesigned the table headers and rows in `TimetableGrid.tsx` with specific neutral background colors (`bg-slate-50 dark:bg-slate-900/40`) and replaced explicit brand borders with neutral slate variants.
- Redesigned `TimeSlotCell.tsx` to match the entry accent pattern (`border-s-4`, background tint `/5`, and hover lift transitions). Dropped custom background colors in favor of a clean, consistent color mapping and added a sleek em-dash placeholder for empty slots.
- Refactored `SlotModal.tsx` inputs and labels, bringing the form design in line with `ScheduleModal.tsx` (using consistent `FIELD_CLASS` styling, `mb-1.5` gap-2 labels with gray icons, and polished save buttons with shadow, active transitions, and identical layouts).

### Task 43: Add College Filter to Timetable Builder
**Model used:** Gemini Pro
**Prompt given:** Add a "College" filter to the Timetable Builder filter bar (TimetableFiltersBar.tsx), positioned BEFORE the existing Department filter, with cascading logic.
**Files modified:** src/types/timetable.types.ts, src/hooks/useTimetableData.ts, src/components/timetable/TimetableFiltersBar.tsx, src/pages/schedules/TimetableGrid.tsx
**What was done:**
- Extended `TimetableFilters` and exported `College` type in `timetable.types.ts`.
- Updated `useTimetableData` to fetch all colleges on mount using `collegeService.getColleges()`.
- Added dependency on `filters.collegeId` in `useTimetableData` to cascade the department fetch so it is dynamically scoped to the selected college (or user's scoped college).
- Exported `isCollegeAdmin` from `useScope()` in `TimetableGrid` to determine if the user has a fixed college scope.
- In `TimetableFiltersBar`, added the new College dropdown before the Department select, using RTL logical styling and `isRTL ? nameAr : name`.
- Bound the `onChange` for the College filter to also reset `departmentId` when a new college is chosen, ensuring cascaded dropdowns do not persist invalid child selections.
- Disabled the Department dropdown when no college is selected (unless `isCollegeAdmin` applies).

### Task 44: Visual Redesign of ExamsList Page
**Model used:** Gemini 3.5 Flash
**Prompt given:** Redesign the Exams list page (ExamsList.tsx or equivalent file at route /exams) to match the established design system used across the University Management System.
**Files modified:** src/pages/exams/ExamsList.tsx
**What was done:**
- Added a `useEffect` hook on mount to dynamically apply the page background tint (`bg-slate-50 dark:bg-slate-900`) to the main parent container.
- Updated the header of the page to utilize the standard translations and styled the Add Exam button to be a solid green button with active transitions.
- Created a 3-card stats KPI row displaying total, upcoming, and today's exams counts, incorporating color-coded icons (`FileText` in brand green, `Clock` in blue, and `CalendarCheck` in amber).
- Wrapped the filter panel inside a Card with customized styles, converting the vertical filter buttons into text-start pill tabs and styled the upcoming only checkbox toggle.
- Wrapped the main content area in a matching Card layout and restructured the cards grid into a standard `Table` view featuring row hover effects (`hover:bg-slate-50 dark:hover:bg-slate-800/60`), custom badges for exam types, secondary text line layout for course names, and a standard empty state.

---
### Task 45: Complete Audit and Implementation of Exam System
**Model used:** Gemini 3.5 Flash
**Prompt given:** You are conducting a comprehensive audit of the Exam System in this University Management System. Your job is to: investigate every exam-related file, identify all bugs, missing features, incomplete UI, broken logic â€” then fix everything in one pass.
**Files modified:** prisma/schema.prisma, exams.controller.ts, exams.routes.ts, useAntiCheat.ts, TakeExam.tsx, ExamDetails.tsx, ExamSubmissions.tsx, ExamResults.tsx, App.tsx, exams.service.ts
**What was done:**
- Added `ExamQuestion`, `ExamSubmission`, and `ExamViolation` models to Prisma schema.
- Implemented backend endpoints for fetching/adding/updating/deleting questions, starting sessions, and submitting answers with anti-cheat logs.
- Created `useAntiCheat.ts` hook to track tab switches, focus loss, right-clicks, and fullscreen exits.
- Re-wrote `TakeExam.tsx` to handle secure sessions, render real API questions, trigger anti-cheat warnings, and enforce timer countdowns.
- Upgraded `ExamDetails.tsx` to include an admin/doctor interface for managing exam questions with a streamlined creation form.
- Added `ExamSubmissions.tsx` page to display all student submissions and flag academic integrity violations.
- Added `ExamResults.tsx` to display graded scores or pending manual-review statuses to students.
- Wired all new endpoints and UI components into the API and React Router.

---
### Task 46: Visual Redesign of Students List Page
**Model used:** Gemini 3.5 Flash
**Prompt given:** Redesign the Students list page (StudentsList.tsx at route /students) to match the established design system used across the UMS.
**Files modified:** StudentsList.tsx, en.json, ar.json
**What was done:**
- Implemented `useEffect` on mount to apply `bg-slate-50` / `dark:bg-slate-900` background styling to the parent `<main>` container and added `pt-6` padding to the page wrapper.
- Integrated the existing `<PageHeader>` component with dynamic localization for title/subtitle and configured the "+ Add Student" action button.
- Added a 3-card stats KPI row displaying total, active, and suspended students derived from the fetched dataset.
- Wrapped the status filter buttons (pill tabs) and search bar input inside a custom border-slate-200/slate-700 Card container.
- Upgraded the table panel into a structured table using `TableHeader`/`TableHead`/`TableBody` tags, adding a custom student details cell (initials avatar circle, name, and student ID) and localizing the status badges to green/red/amber.
- Built a fallback empty state when search filters return no matching records.

---
### Task 47: Visual Redesign of Doctors List Page
**Model used:** Gemini 3.5 Flash
**Prompt given:** Redesign the Doctors list page (DoctorsList.tsx at route /doctors) to match the established design system used across the UMS.
**Files modified:** DoctorsList.tsx, en.json, ar.json
**What was done:**
- Implemented `useEffect` on mount to apply `bg-slate-50` / `dark:bg-slate-900` background styling to the parent `<main>` container and added `pt-6` padding to the page wrapper.
- Integrated the existing `<PageHeader>` component with dynamic localization for title/subtitle and configured the "+ Add Doctor" action button.
- Upgraded the 4 stats KPI cards to display total, active, courses, and research project metrics matching the design specs with premium color coding and icons.
- Wrapped the status filter buttons (pill tabs) and search bar input inside a custom border-slate-200/slate-700 Card container.
- Added client-side filtering logic for `'all'`, `'active'`, `'inactive'`, and `'onleave'` tab states.
- Restructured the table panel using `TableHeader`/`TableHead`/`TableBody` tags, adding initials avatar circles, name, and doctor ID, and color-coded status badges.
- Built a fallback empty state when search filters return no matching records.

---
### Task 48: Visual Redesign of Admins List Page
**Model used:** Gemini 3.5 Flash
**Prompt given:** Redesign the Admins list page (AdminsList.tsx at route /admins) to match the established design system used across the UMS.
**Files modified:** AdminsList.tsx, en.json, ar.json
**What was done:**
- Implemented `useEffect` on mount to apply `bg-slate-50` / `dark:bg-slate-900` background styling to the parent `<main>` container and added `pt-6` padding to the page wrapper.
- Integrated the existing `<PageHeader>` component with dynamic localization for title/subtitle and configured the "+ Add Admin" action button.
- Upgraded the stats KPI row to present 3 cards: Total Admins (ShieldCheck icon), University Admins (Building2 icon), and College & Dept Admins (Users icon) derived from the dataset.
- Wrapped the search bar input inside a custom border-slate-200/slate-700 Card container, adding absolute logical start Search icon positioning.
- Restructured the table panel using explicit `TableHeader`/`TableHead`/`TableBody` elements.
- Localized the table headers and values (email, role badges, affiliation scopes, and localized created dates).
- Styled the role badge colors for Super Admin (purple), College Admin (teal), Department Admin (amber), and Admin (blue).
- Built a fallback empty state when search filters return no matching records.

---
### Task 49: Implementation of Teaching Assistants System
**Model used:** Gemini 3.5 Flash / Gemini Pro
**Prompt given:** Implement a complete Teaching Assistants (Ù…Ø¹ÙŠØ¯ÙˆÙ†) system from scratch. This is a full-stack feature: Prisma schema, backend, and frontend.
**Files modified:** schema.prisma, app.ts, TeachingAssistantsList.tsx, AddTAModal.tsx, EditTAModal.tsx, AssignDoctorModal.tsx, App.tsx, Sidebar.tsx, en.json, ar.json, teachingAssistants.controller.ts, teaching-assistants.routes.ts, teachingAssistants.service.ts
**What was done:**
- Added `TeachingAssistant` and `DoctorTA` junction models to Prisma schema.
- Added API endpoints for CRUD operations and assigning/unassigning doctors.
- Created `TeachingAssistantsList.tsx` page following the standard UMS list page design system with KPI stats and filters.
- Implemented `AddTAModal.tsx` and `EditTAModal.tsx` for managing TAs.
- Implemented `AssignDoctorModal.tsx` for handling the many-to-many relationship with Doctors, displaying currently assigned doctors, and allowing searches for new assignments.
- Registered the new page under `/teaching-assistants` in `App.tsx` and added a link to `Sidebar.tsx`.
- Populated full translations in `en.json` and `ar.json`.

---
*This file is auto-updated after each completed task.*

### Task 50: Timetable-to-Schedule One-Way Sync Detachment Logic
**Type:** Backend/Data Integrity (not UI)
**Prompt given:** Implement Timetable-to-Schedule one-way sync with Flow A detachment.
**Files modified:** schema.prisma, timetable.controller.ts, schedules.controller.ts, timetable.service.ts
**What was done:**
- Added `timetableId` and `timetableSlotKey` to `Schedule` model.
- Refactored `syncTimetableSchedules` helper in `timetable.service.ts` to use Prisma transactions, upserting/deleting slots correctly.
- Wrapped `createTimetable`, `updateTimetable`, and `publishTimetable` controllers in a single transaction that also invokes the sync helper if published.
- Added Flow A detachment logic in `schedules.controller.ts` (`updateSchedule`) to set `timetableId: null` and `timetableSlotKey: null` when a user manually modifies a synchronized schedule, preventing it from being overwritten or deleted in future timetable syncs.
- Executed one-time backfill script for existing published timetables.

---
### Task 51: Schema Migration History Unification
**Type:** Backend/Data Integrity (not UI)
**Prompt given:** Unify migration history by generating a new migration capturing all previously untracked changes.
**Files modified:** schema.prisma, migration.sql (new migration folder)
**What was done:**
- Reset the database schema to the last known migration point.
- Created and applied a unified migration (20260628172727_sync_tas_exams_and_timetable) that captures all previously untracked features (Teaching Assistants model/relations, Exams integrity & anti-cheat upgrade, College descriptionAr field, and Timetable-Schedule sync fields).
- Re-aligned the unique constraint (@@unique([studentId, courseId, date])) on the Attendance model in both the schema and the migration file.
- Re-ran the database seed script successfully on the new unified schema.

---
### Task 52: Visual Redesign of Timetable Records Manager
**Type:** UI/UX Redesign
**Prompt given:** Redesign the TimetableManagement page (route /timetables-management) to match the established UMS design system.
**Files modified:** TimetableManagement.tsx, TimetableModal.tsx
**What was done:**
- Added a `useEffect` hook to apply page background (`bg-slate-50 dark:bg-slate-900`) dynamically on mount.
- Upgraded the page wrapper layout to use `pt-6`.
- Wrapped filter controls, status stats tabs, and view mode toggles in a premium `Card` component with dark mode support.
- Refactored the list/table area to use a premium structured `Card` containing an explicit, styled `TableHeader` and `TableHead` hierarchy with hover states (`hover:bg-slate-50 dark:hover:bg-slate-800/60`).
- Replaced plain text statuses with styled badge tags showing DRAFT/PUBLISHED states.
- Enhanced the card-view option with a responsive grid of card elements utilizing borders, shadows, hover-lift actions, and dark-mode compliant header/footer areas.
- Re-architected the empty state with a centered, rounded icon circle, clean hierarchy, and standard primary action button.
- Updated modal layouts inside `TimetableModal.tsx` to follow standard input, label, select, and button styles.
- Fixed a bug in `TimetableModal.tsx` where colleges list was never loaded for non-college admins (e.g. Super Admin).

---
### Task 53: Temporary Disabling of 2FA Enforcement
**Type:** Feature Toggle (temporary disable)
**Prompt given:** Temporarily disable Two-Factor Authentication required/enforcement banner and profile warnings across the entire app.
**Files modified:** featureFlags.ts [NEW], SuperAdminTwoFactorBanner.tsx, SettingsPage.tsx, Profile.tsx
**What was done:**
- Created a global feature flag config file `featureFlags.ts` containing the boolean constant `REQUIRE_2FA: false`.
- Updated `SuperAdminTwoFactorBanner.tsx` to return `null` immediately if `FEATURE_FLAGS.REQUIRE_2FA` is disabled, hiding the global "Two-Factor Authentication Required" banner for Super Admins.
- Modified conditional checks in `SettingsPage.tsx` and `Profile.tsx` to verify `FEATURE_FLAGS.REQUIRE_2FA` before rendering yellow warning blocks or warning borders, hiding the requirement prompts from settings and profile pages.
- Preserved backend database schemas, login code verification flows, and individual setup features to ensure users who already configured 2FA can still authenticate normally without making it mandatory for all admins.

---
### Task 54: Resolve Summer Semester Inconsistency in Timetables & Schedules
**Type:** UI/UX Bug Fix
**Prompt given:** Add Summer Semester option to Timetable Builder filters, ensure consistent English and Arabic translation labels, and check backend validation limits.
**Files modified:** TimetableFiltersBar.tsx, SchedulesList.tsx, DoctorSchedule.tsx, TimetableModal.tsx, TimetableManagement.tsx, en.json, ar.json
**What was done:**
- Added `"semester3": "Summer Semester"` and `"semester3": "Ø§Ù„Ù�ØµÙ„ Ø§Ù„ØµÙŠÙ�ÙŠ"` translation keys to `en.json` and `ar.json` respectively.
- Updated `TimetableFiltersBar.tsx` `SEMS` constant array to `['1', '2', '3']` to enable selection of the Summer Semester in the Timetable Builder page.
- Rewrote the semester dropdown options in `TimetableFiltersBar.tsx` to use schedule translation keys (`schedule.semester${s}`).
- Replaced hardcoded "Semester 3" option labels with `{t('schedule.semester3', 'Summer Semester')}` in `SchedulesList.tsx`, `DoctorSchedule.tsx`, and `TimetableModal.tsx`.
- Adapted the semester display table cells in `SchedulesList.tsx` and list/card views in `TimetableManagement.tsx` to render using the dynamic localization keys instead of hardcoded numbers.
- Verified that the backend Express/Prisma layer (`academic.validation.ts` and `timetable.controller.ts`) already natively allows semesters up to 3 (max: 3) and has no constraints blocking Summer Semester database writes.

---
### Task 55: Temporary Disabling of 2FA Login Verification Step
**Type:** Feature Toggle (temporary disable)
**Prompt given:** Bypass the 2FA login verification code step during login for all accounts.
**Files modified:** .env, auth.controller.ts
**What was done:**
- Added `REQUIRE_2FA=false` to `api-server/.env`.
- Modified the login controller inside `auth.controller.ts` to parse `process.env.REQUIRE_2FA !== 'false'`.
- Wrapped the `user.twoFactorEnabled` check with the `require2FA` environment variable check. If the flag is set to false, login immediately yields session tokens instead of returning `requires2FA: true` and prompting for a 6-digit TOTP code.
- **Rollback / Re-enable instruction:** To fully restore 2FA enforcement, set `REQUIRE_2FA=true` in `api-server/.env` (backend) AND set `REQUIRE_2FA: true` in `src/constants/featureFlags.ts` (frontend).

---
### Task 56: Major Architecture Rebuild — Phase 1 of 4
**Type:** Major Architecture Rebuild — Phase 1 of 4
**Prompt given:** Proceed with Phase 1 (Schema & Data Migration) to overhaul the scheduling system, introducing CourseSections, StudentGroups, and a unified ScheduleSlot model.
**Files modified:** api-server/prisma/schema.prisma, api-server/prisma/migrations/20260629000000_phase1_scheduling_rebuild/migration.sql
**What was done:**
- Updated \schema.prisma\ with new models: \StudentGroup\, \CourseSection\, \SectionGroupMapping\, \StudentSectionOverride\, and \ScheduleSlot\.
- Created new Enum \SessionType\ (LECTURE, LAB, TUTORIAL, SEMINAR).
- Dropped redundant tables/columns: \DoctorTA\, \Schedule\, \Course.doctorId\, and \Timetable.scheduleData\.
- Added relations for \Student\ to \StudentGroup\ and \TeachingAssistant\ to \ScheduleSlot\.
- Generated and executed a Prisma migration containing a custom SQL script to preserve existing data:
  - Created a 'Default Group' for each department and assigned all students to it.
  - Created a default 'Section A' for every course and copied over the existing instructor (\doctorId\). Handled skipped courses that had no instructor by manually assigning the first available doctor post-migration.
  - Mapped the 'Default Group' to 'Section A' for all courses.
  - Converted all existing \Schedule\ records into the new \ScheduleSlot\ format.
- Executed \
px prisma migrate dev\ to sync the database schema and ran a custom JS verification script to confirm 0 orphaned courses, 0 invalid doctors, and successful group mappings.
- Executed \npx prisma migrate dev\ to sync the database schema and ran a custom JS verification script to confirm 0 orphaned courses, 0 invalid doctors, and successful group mappings.
- Re-ran build commands for frontend and backend. Backend \build.mjs\ passed with 0 new errors. Backend \typecheck\ appropriately flagged all deprecated type usage (\DoctorTA\, \Schedule\, \scheduleData\) across \schedules\, \teachingAssistants\, and \timetable\ controllers, which will be rewritten in Phase 2.
- Ready to proceed to Phase 2 (Backend Controllers).

### June 2026 - Major Architecture Rebuild — Phase 3 of 4
**Type:** Major Architecture Rebuild — Phase 3 of 4
- Rewrote \TimetableManagement.tsx\, \TimetableGrid.tsx\, and \TimetableModal.tsx\ to align with the new \ScheduleSlot\ and \CourseSection\ schema.
- Created \SectionManagement.tsx\ for managing \CourseSection\ entities, including Manage Groups and Student Overrides.
- Added \/sections\ route to App router and sidebar.
- Refactored frontend to eliminate legacy JSON scheduleData.

### June 2026 - Frontend Schedule Views - Phase 4 of 4
**Type:** Frontend Schedule Views - Phase 4 of 4
- Rebuilt \WeeklySchedule.tsx\ and \DoctorSchedule.tsx\ to consume the new nested \courseSection\ structure.
- Created a dedicated \TASchedule.tsx\ view for Teaching Assistants, including a summary statistics bar (total slots, distinct courses, distinct sections).
- Configured routes in \App.tsx\ and sidebar navigation links in \Sidebar.tsx\ to integrate the new schedule pages with appropriate role guards.
- Updated \en.json\ and \ar.json\ translations with the new i18n keys for schedule types and headers.
- Integrated conditional UI components like session type badges (LECTURE, LAB, TUTORIAL, SEMINAR) and section name visibility rules.
- Build and typecheck verified. The rebuild of the scheduling system (Phases 1-4) is completely done.

### Task 57: Major Architecture Rebuild — Phase 5 (Cleanup & Stabilization)
**Type:** Major Architecture Rebuild — Phase 5 (Cleanup & Stabilization)
**Prompt given:** Remove Course.doctorId, fix DOCTOR/TA scopes, assign 5 placeholder courses to real doctors, resolve build issues, log.
**Files modified:** schema.prisma, AddCourseModal.tsx, EditCourseModal.tsx, CourseModal.tsx, timetable.types.ts, scope.utils.ts, auth.middleware.ts, schedules.controller.ts, doctors.controller.ts, build.mjs
**What was done:**
- Removed `doctorId` and `courses` link from Prisma schema in Phase 1 (migration applied).
- Cleaned up the frontend modals (`AddCourseModal.tsx`, `EditCourseModal.tsx`, `CourseModal.tsx`) so that `doctorId` is no longer submitted during course creation, fixing strict type errors.
- Re-wired `DOCTOR` and `TEACHING_ASSISTANT` roles in backend's `scope.utils.ts` and `schedules.controller.ts` to filter queries based on `user.doctor.id` and `user.teachingAssistant.id`, and ensured those IDs are queried during authentication in `auth.middleware.ts`.
- Fixed 5 placeholder courses (ICT101, ICT102, MATH101, ENG101, PHY101) by re-assigning their sections to specific distinct real doctors inside the IT department via a script.
- Added `maxRetries` to `build.mjs` to resolve the Windows EPERM issue during `dist` clean up.

---
### Task 58: Timetable Builder Instructor Name Resolution & TA Overhaul
**Type:** Bug Fix / Schema Overhaul
**Prompt given:** Fix generic "طاقم التدريس" / "Teaching Staff" placeholder showing on Timetable grid slots. Resolve backend and frontend end-to-end to fetch and display real doctor and TA names. Search and resolve other instances of name placeholders in schedules.
**Files modified:** schema.prisma, teachingAssistants.controller.ts, schedules.controller.ts, seed.ts, useTimetableData.ts, WeeklySchedule.tsx, TASchedule.tsx, DoctorSchedule.tsx, SectionManagement.tsx, SchedulesList.tsx
**What was done:**
- Extended `TeachingAssistant` model in `schema.prisma` with `firstName` and `lastName` fields, defaulting to "TA" and "Staff" to gracefully migrate existing rows.
- Updated backend `teachingAssistants.controller.ts` to accept and save `firstName` and `lastName` on creation and updating of TAs.
- Updated `schedules.controller.ts` to include `firstName` and `lastName` for doctors in the `courseSection.doctor` select block, and for TAs in the `teachingAssistant` select block.
- Updated `seed.ts` to populate TAs with realistic first and last names.
- Updated frontend `useTimetableData.ts` mapping to correctly resolve and store the doctor's name or TA's name depending on the session type (LECTURE vs. LAB/TUTORIAL).
- Cleaned up frontend views (`WeeklySchedule.tsx`, `TASchedule.tsx`, `DoctorSchedule.tsx`, `SectionManagement.tsx`, `SchedulesList.tsx`) to use the real names directly from the models instead of trying to read them from the nested `user` relation (which doesn't contain first/last names).
- Verified that fake seed names like "Course 0 for Dept 3" are expected mock seed data and not code bugs.

---
### Task 59: Course-to-Doctor Relation Regression Fixes
**Type:** Bug Fix
**Prompt given:** Fix /courses page 500 error caused by leftover Course.doctorId references after the scheduling system schema rebuild. Broadly search and resolve similar regressions across the entire backend and frontend.
**Files modified:** courses.controller.ts, doctors.controller.ts, CoursesList.tsx, CourseDetails.tsx, SlotModal.tsx
**What was done:**
- **Backend Fixes:** 
  - `courses.controller.ts`: Removed direct `doctor` relation includes from `getAllCourses` and `getCourseById` queries. Replaced with `sections: { include: { doctor: true } }`.
  - `courses.controller.ts`: Removed `doctorId` property injection during course creation and updates (this field no longer exists on `Course`).
  - `doctors.controller.ts`: Removed obsolete cascade update that attempted to set `course.doctorId = null` when a doctor is deleted. 
- **Frontend Fixes:**
  - `CoursesList.tsx`: Updated the "Unassigned Courses" counter to check if the course has any active sections with an assigned doctor, instead of expecting a direct `course.doctor` property.
  - `CoursesList.tsx`: Rewrote the instructor column to dynamically extract all unique doctors from `course.sections` and list them, or display an "UNASSIGNED" badge if there are none.
  - `CourseDetails.tsx`: Replaced the legacy single-doctor subtitle layout with a dynamic section count (e.g. `· 3 Sections`).
  - `SlotModal.tsx`: Adjusted the form auto-fill behavior for instructor names to fall back to the first section's doctor.

---
### Task 60: Generate Realistic Seed Data for Timetables
**Type:** Data / Testing Improvement
**Prompt given:** Replace fake placeholder seed test data with realistic, real-world-plausible data for all existing colleges and departments in the system. Create realistic courses, doctors, TAs, sections, slots, and student groups per department without breaking the current schema. Run conflict validation after seeding to ensure no accidental double-bookings.
**Files modified:** prisma/seed-realistic-data.ts, schema.prisma (implicitly verified)
**What was done:**
- Created a robust custom seeding script (seed-realistic-data.ts) that reads the actual database departments (Information & Communication Technology, Nursing, Mechatronics, etc.).
- Formulated an extensive map of realistic test data covering courses (e.g. "Anatomy & Physiology" for Nursing, "Digital Logic Design" for ICT) complete with proper names, Arabic translations, and course codes.
- Instantiated fully formed and logically sound relationships per department: Student Groups, Courses, Course Sections, distinct Doctors, Teaching Assistants, and ScheduleSlots (both lectures and labs) attached to published Timetables.
- Rewrote the cleanup phase to perform an explicit cascade deletion order (child rows first) to safely drop old fake data without violating Prisma's foreign-key constraints on non-cascading relations like User -> Doctor.
- Executed the conflict-validation checker on the generated dataset and verified ZERO conflicts (rooms/doctors/TAs/groups) across 10 distinct departments, 22 courses, 22 sections, 21 doctors, 11 TAs, and 46 schedule slots.

### Task 61: Fix Student Schedule Data Grouping and Duplicate Navigation

**Type:** Bug Fix

**Description:**
- Fixed a critical bug in `WeeklySchedule.tsx` where the student schedule was rendering empty because the API response (a flat array) was not being grouped by `dayOfWeek` before being set in state.
- Fixed duplicate 'Weekly Schedule' navigation entries for Students and Doctors in `Sidebar.tsx` by restricting the generic `/schedule` route to Admins, allowing Students and Doctors to use their role-specific routes (`/schedules/student` and `/schedules/doctor`).
- Updated the hardcoded title in `WeeklySchedule.tsx` to use the correct translation key (`schedule.mySchedule`) for non-admin users so they see 'My Weekly Schedule' instead of 'Timetables Management'.

### Task 62: Smart Instructor/TA Assignment in Timetable Builder

**Type:** Feature / UX Improvement

**Description:**
- Built a smart instructor assignment feature in the Timetable Builder (`SlotModal.tsx`) when creating or editing a `ScheduleSlot`.
- Implemented `/api/doctors/suggested` and `/api/teaching-assistants/suggested` endpoints to fetch dynamic suggestions based on the selected course.
- Integrated a 4-tier prioritization logic: "Previously Taught" (Tier 1), "Same Department" (Tier 2), "Same College" (Tier 3), and "Other" (Tier 4).
- Added visual groupings (`<optgroup>`) in the dropdown to distinctly separate these tiers for admins.
- Tied the selector to `sessionType`—displaying the Doctor selector for LECTURE and the Teaching Assistant selector for LAB/TUTORIAL/SEMINAR.


### Task 63: Unify Instructor/TA Assignment Modals
**Files modified:** SlotModal.tsx, ScheduleModal.tsx, InstructorSelector.tsx
**What was done:** Extracted the smart Tier-based Doctor/TA suggestion system from SlotModal.tsx into a reusable InstructorSelector.tsx component. Integrated it into ScheduleModal.tsx to replace the static TA dropdown and provide smart Doctor suggestions for LECTURE sessions, unifying the instructor selection flow while maintaining each modal's distinct purpose.

---

### Task 64: Section Management Department-Course Dropdown Bug Fix
**Type:** Bug Fix
**Files modified:** SectionManagement.tsx
**What was done:** 
- Added a `useEffect` hook to synchronize the URL `searchParams` with the internal `filters` state in `SectionManagement.tsx` so that route parameter updates correctly propagate to the dropdown selectors.
- Configured the `useEffect` that fetches courses to immediately reset `courses` state to `[]` whenever `filters.departmentId` changes, preventing stale course listings from appearing.
- Extended the `fetchCourses` method to pass `limit: 1000` to `coursesService.getCourses`, ensuring all courses belonging to the selected department are retrieved and rendered rather than only the default first 10 courses.

---

### Task 65: Temporary Schedule Override System
**Type:** New Feature — Temporary Schedule Override System
**Files modified/created:**
- `api-server/prisma/schema.prisma` — Added `ScheduleOverride` model with relations to `ScheduleSlot`, `Doctor`, `TeachingAssistant`, `User`
- `api-server/prisma/migrations/20260630204733_add_schedule_override/migration.sql` — New migration
- `api-server/src/controllers/overrides.controller.ts` [NEW] — Full CRUD for overrides with conflict validation
- `api-server/src/routes/overrides.routes.ts` [NEW] — Express router mounted under `/:slotId/overrides`
- `api-server/src/routes/schedules.routes.ts` — Mounted overrides sub-router
- `api-server/src/controllers/schedules.controller.ts` — Updated `getAllSchedules` to fetch active overrides per slot and merge them at query time, returning `isTemporarilyModified: true` on affected slots
- `university-app/src/types/timetable.types.ts` — Extended `SlotEntry` with `isTemporarilyModified`, `overrideReason`, `overrides` fields
- `university-app/src/components/timetable/OverrideModal.tsx` [NEW] — Admin modal to create/edit/delete overrides with date range, room, and reason fields
- `university-app/src/components/timetable/TimeSlotCell.tsx` — Added `onEditOverride` prop, amber coloring for modified slots, "⊠ Temp. Change" badge, "Override" button
- `university-app/src/pages/schedules/TimetableGrid.tsx` — Integrated `OverrideModal` with state handlers
- `university-app/src/pages/schedules/WeeklySchedule.tsx` — Amber border + badge for student/admin view
- `university-app/src/pages/schedules/TASchedule.tsx` — Amber border + badge for TA view
- `university-app/src/pages/schedules/DoctorSchedule.tsx` — Amber border + badge for doctor view

**What was done:**
- Designed and applied a `ScheduleOverride` Prisma model that stores override data (room, dayOfWeek, startTime, endTime, doctorId, teachingAssistantId, reason) for a defined date range (`startDate`/`endDate`) without mutating the underlying `ScheduleSlot` record.
- Implemented `prisma migrate dev` with `--create-only` preview to show user the SQL before applying. Migration reviewed and approved, then applied cleanly.
- Built backend `overrides.controller.ts` with: `POST /:slotId/overrides` (create), `GET /:slotId/overrides` (list), `PATCH /:overrideId` (update), `DELETE /:overrideId` (delete). All writes re-use `TimetableService.checkConflicts` to prevent room/doctor/TA scheduling collisions.
- Updated `schedules.controller.ts` to join active overrides (where `startDate <= now <= endDate`) into the schedule fetch and merge them into the slot object, setting `isTemporarilyModified: true` and overriding the relevant fields before returning to the client.
- Created `OverrideModal.tsx`: a polished amber-themed modal allowing Admins to specify date range, optional room override, and reason. Supports create, update, and delete (revert) in a single modal.
- Added amber visual indicators across all four schedule views (Admin timetable grid, Student weekly, Doctor, TA): left-border amber stripe, amber background tint, and "⊠ Temp. Change" badge.
- **Typecheck results:** Backend ✅ PASS (0 errors). Frontend — no new errors introduced; 3 pre-existing unrelated errors remain (Login.tsx variant, not-found.tsx casing, TimetableGrid scope prop).

---

### Task 66: Sections Management Page Diagnostics
**Type:** Investigation & Diagnosis
**Files modified:** None (Investigation Only)
**What was done:** Investigated Sections Management page toast error. Diagnosed missing `/api/sections` backend routes and controllers, and frontend service method call type mismatch (`getSections` vs `getCourseSections`). Checked that Course ID 5 is PHY101 under ICT Department (ID 1) in database and schema.

### Task 67: Missing Sections API Implementation
- **Context**: The sections management page crashed because the frontend was calling `sectionsService.getSections` but the method was named `getCourseSections` and expected a different signature. Also, the backend API endpoints were entirely missing.
- **Changes**: Created `sections.routes.ts` and `sections.controller.ts` in the backend to support GET, POST, PUT, DELETE for sections, plus group mappings and student overrides. Mounted the routes in `app.ts`. Renamed the frontend service method to `getSections` and adjusted its signature.
- **Impact**: The Sections Management page now works without errors.

### Task 68: Timetable Page Diagnostic Investigation
- **Context**: Investigated the page crash occurring on fresh login or reload of `/schedules/timetable`.
- **Findings**: Diagnosed a race condition on token rotation due to React 18 Strict Mode firing `initAuth` twice concurrently, which causes concurrent deletions on the `RefreshToken` record in the database. Also uncovered a defensive coding gap in `TimetableFiltersBar.tsx` where colleges mapping is performed without proper prop passing or defaults.
- **Impact**: Confirmed root causes and prepared architectural resolution paths.

### Task 69: Fix Auth Refresh Token Race Condition
- **Context**: Solved the refresh-token race condition identified in Task 68.
- **Changes**:
  1. Frontend: Added a ref-based promise-caching guard in `AuthContext.tsx` (`initPromiseRef`) to guarantee only one in-flight `/auth/refresh` request is actually made during concurrent calls.
  2. Backend: Wrapped token rotation logic in a single transaction in `auth.controller.ts` with a `rotatedTokens` in-memory map to store recently rotated tokens (within a 15-second grace window). Any concurrent or slightly offset duplicate request retrieves the recently rotated info and receives a valid `200 OK` access token instead of a `401` or `500` error, preventing multi-tab session termination.
- **Verification**: Verified that both concurrent requests return `200 OK` with the same access token and profile lookup succeeds, while invalid refresh tokens still correctly return `401 Unauthorized`.
- **Known Issues / Scaling Notes**:
  - The `rotatedTokens` protection is process-local (in-memory) and will not work across multiple backend instances.
  - Before scaling to multiple instances or clustering/load-balancing (e.g. PM2 cluster mode or multi-container deployments), this must be refactored to use a shared store (e.g. Redis or short-lived database records) instead of a process-local `Map`.

### Task 70: Fix TimetableGrid College Props Crash
- **Context**: Resolves the crash on /schedules/timetable caused by missing props in TimetableFiltersBar.tsx. The useTimetableData hook was already fetching colleges but TimetableGrid failed to pass them down.
- **Changes**:
  1. Extracted isCollegeAdmin from useScope() and colleges, loadingColleges from useTimetableData() in TimetableGrid.tsx.
  2. Passed these variables as props to TimetableFiltersBar.
  3. Added a defensive default (colleges = []) in TimetableFiltersBar.tsx.
  4. Fixed two pre-existing TypeScript errors in TimetableGrid.tsx (scope to scopeParams, and 	imetableId to string).
- **Impact**: The Timetable page now loads without crashing, and college filtering cascades properly.

### Task 71: Attendance Page Diagnostics
- **Context**: Conducted a thorough code audit and live API verification of the Attendance page (/attendance) to diagnose three reported issues.
- **What was done**:
  - **Problem 1 (Empty Roster/Static Dropdown)**: Found that the custom Radix <Select> component was incorrectly used as a native <select> (with <option> children), causing the browser to render options as a plain static text list and preventing course selection. Verified that the backend roster query (courses.controller.ts:132) is still using the OLD pre-rebuild model (relying on Enrollment and direct department/year lookups) instead of resolving through the new CourseSection -> SectionGroupMapping -> StudentGroup path.
  - **Problem 2 (Save Button Fails)**: Captured a live 500 Internal Server Error caused by a backend bug in  ttendance.controller.ts line 74 where es.status().json(...) was invoked without a status code argument, throwing a runtime TypeError in Express. Also verified the Attendance schema contains a @@unique([studentId, courseId, date]) constraint that will trigger on duplicate saves.
  - **Problem 3 (Visual Polish Scoping)**: Scoped the visual improvements required for AttendancePage.tsx to match the established modern theme.
- **Files investigated**: AttendancePage.tsx,  ttendance.controller.ts, courses.controller.ts, schema.prisma.

### Task 72: Fix Attendance Page Functional Bugs
- **Context**: Resolves the three critical functionality bugs identified in Task 71 on the /attendance page.
- **Changes**:
  1. Replaced the misconfigured Radix <Select> wrapper with a native HTML <select> tag in AttendancePage.tsx to fix the unclickable dropdown.
  2. Fixed the 500 Internal Server Error on save by supplying the missing 201 status code in es.status().json() in  ttendance.controller.ts.
  3. Upgraded the attendance save logic from create to upsert in  ttendance.controller.ts to gracefully handle multiple updates on the same day without triggering Prisma's @@unique([studentId, courseId, date]) constraint error.
  4. Completely rewrote getCourseRoster in courses.controller.ts to conform to the new Phase 4 data model (resolving combined student rosters via CourseSection, SectionGroupMapping, StudentGroup, and StudentSectionOverride).
- **Impact**: The Attendance page now correctly populates available courses, renders an accurate combined roster for selected courses, and successfully saves/updates attendance records.

---

### Task 73: Visual Redesign of Registration Requests Page
- **Context**: Visual redesign of the Registration Requests page (/registration-requests) and details modal to match the established design system used throughout the app.
- **Changes**:
  1. Frontend: Added a `useEffect` hook to inject the background classes `bg-slate-50 dark:bg-slate-900` onto the parent `<main>` element on mount.
  2. Page Header: Redesigned the title and subtitle to follow standard page title style and typography.
  3. Filter Tabs: Re-implemented the status filters inside their own modern card with pill-styled active/inactive tabs and small circular count badges.
  4. Cards Layout: Replaced the outer grid list table style with individual modern card blocks containing request details, a 2-column info grid, status badge, and role pill.
  5. Action Buttons: Redesigned the Approve, Reject, and View action buttons to follow the visual hierarchy standards with matching icons and hover scale effects.
  6. Demo Data Banner: Restyled the preview data alert to match the established amber alert banner pattern with AlertCircle icon.
  7. Pagination/Count Row: Restyled the bottom count text with subtle top separator border.
  8. Dark Mode & RTL: Ensured full slate-themed dark mode styling and RTL-friendly logical styling.
- **Impact**: The Registration Requests page now aligns perfectly with the premium UI design system of the rest of the application.

---

### Task 74: Refine Registration Requests & Visual Redesign of Attendance Page
- **Context**: Visual refactoring of the Registration Requests page and detailed layout redesign of the Attendance page (/attendance) to align both pages with the modern O6U slate theme.
- **Changes**:
  1. Registration Requests: Cleaned up and updated active/inactive filter pills class strings and aligned status badge padding and class names to conform exactly to prompt guidelines (`rounded-full px-3 py-1 text-xs font-semibold`).
  2. Attendance Page Background: Added `useEffect` hook to inject the background classes `bg-slate-50 dark:bg-slate-900` onto the parent `<main>` container.
  3. Control Panel Card: Wrapped course selector, date picker, and save button in a shadow-styled Card (`bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5`). Refined labels with modern styling and BookOpen/Calendar icons. Custom styled the dropdown and date selector triggers (`bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl h-11 px-4 text-sm`).
  4. Save Buttons: Styled control panel Save and Page Header Save buttons to follow primary O6U styling (`bg-brand-primary-500 hover:bg-brand-primary-600 text-white rounded-xl px-4 py-2.5 w-full active:scale-95 transition-all`).
  5. Roster Area & Empty States: Replaced dashed border placeholder with a sleek, clean Card container. Built centered custom empty states with a soft-tinted green circle icon container (`bg-brand-primary-500/10 rounded-2xl p-4 w-16 h-16`), bold text, and readable descriptions.
  6. Roster Table Styling: Styled table headers as `bg-slate-50 dark:bg-slate-900/40 text-xs text-slate-400 font-semibold`, added table row hover highlight transitions (`hover:bg-slate-50 dark:hover:bg-slate-800/60 duration-150`), and configured subtle slate cell dividers.
  7. Roster Status Badges: Refactored individual student attendance status toggles (PRESENT, LATE, ABSENT) into pill-styled badge buttons (green, amber, and red respectively when active; soft neutral outline when inactive).
- **Impact**: Both the Registration Requests and Attendance Record pages now follow the same refined visual standards as other key system directories.

---

### Task 75: Full Attendance System Rebuild
**Type:** Full-Stack Feature Rebuild (Backend + Frontend)
**Files modified:**
- `api-server/src/controllers/attendance.controller.ts`
- `api-server/src/controllers/courses.controller.ts`
- `api-server/src/routes/attendance.routes.ts`
- `university-app/src/pages/attendance/AttendancePage.tsx`
- `university-app/src/services/attendance.service.ts`
- `university-app/src/types/models.ts`
- `university-app/src/i18n/en.json`
- `university-app/src/i18n/ar.json`

**What was done:**

**Backend:**
- Fixed critical crash bugs in `attendance.controller.ts` (lines 107 & 114): `res.status().json()` was called without a status code argument, causing a runtime TypeError in Express. Fixed to `res.status(400).json()` and `res.status(500).json()` respectively.
- Expanded role permissions in `attendance.routes.ts` to include `COLLEGE_ADMIN`, `DEPARTMENT_ADMIN`, and `TEACHING_ASSISTANT` alongside existing `SUPER_ADMIN`, `ADMIN`, `DOCTOR`.
- Added 4 new controller endpoints:
  - `GET /api/attendance/my-courses` — returns courses scoped by role: Doctor gets their sections, TA gets their assigned slots, Admins get all courses.
  - `GET /api/attendance/my-attendance` — Student-only endpoint returning per-course attendance history with computed stats (presentCount, lateCount, absentCount, attendanceRate).
  - `GET /api/attendance/summary/:courseId` — aggregated per-student attendance percentages, ordered by rate ASC so at-risk students appear first.
  - `POST /api/attendance/bulk` — atomic bulk save using `prisma.$transaction` with `upsert` on `@@unique([studentId, courseId, date])` constraint.
- Rewrote `getCourseRoster` in `courses.controller.ts` to use the correct Phase 4 data model path: `CourseSection → SectionGroupMapping → StudentGroup → Student`, with `StudentSectionOverride` support and `existingStatus` injection when a `date` query param is provided.
- Backend typecheck: `tsc --noEmit` → **0 errors**.

**Frontend:**
- Removed `// @ts-nocheck` from `AttendancePage.tsx` and `attendance.service.ts`.
- Added missing roles `COLLEGE_ADMIN`, `DEPARTMENT_ADMIN`, `TEACHING_ASSISTANT` to `UserRole` union in `models.ts`.
- Exported typed interfaces `RosterStudent` and `MyAttendanceCourse` from `attendance.service.ts`.
- Added 4 new service methods: `getMyCourses`, `getMyAttendance`, `getAttendanceSummary`, `bulkSave`.
- Added missing i18n keys to `en.json` and `ar.json` (`totalStudents`, `myAttendance`, `myAttendanceSubtitle`, `markAllPresent`, `markAllAbsent`) without removing or duplicating existing keys.
- Completely rebuilt `AttendancePage.tsx` with full role-awareness:
  - **Admin / Doctor / TA view:** Two-column layout — control panel (course selector, date picker, save button) + roster table with PRESENT/LATE/ABSENT pill toggles per student, "Mark All" quick actions bar, live KPI stat cards (total/present/late/absent) that update as statuses change.
  - **Student view:** Personal attendance dashboard — summary KPI row + per-course cards with colored progress bars (green ≥85%, amber ≥70%, red <70%), expandable session history with date and status badge per session.
  - RTL logical properties throughout (`ps-`, `pe-`, `ms-`, `me-`, `border-s-`, `start-`, `end-`).
  - Full dark mode on every element.
  - Loading skeletons, empty states, and toast feedback on save success/error.

