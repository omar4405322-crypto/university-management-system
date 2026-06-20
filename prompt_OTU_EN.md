# Cursor Prompt — Fix & Improve October Technological University Website

## General Context

You are working on the homepage of October Technological University (OTU). The site is Arabic RTL, and the brand identity uses **green (#4CAF50 or equivalent) and dark navy (#1a2744 or equivalent)**. Before making any changes, inspect the existing code and extract the actual color values and CSS variables in use.

---

## Tasks — Execute in Order

### 1. Fix the Empty White Space Section (Highest Priority)

**Problem:** There is a section between the Hero and the "Technology Leadership" section that appears completely blank — icons and text are not visible.

**Required:**
- Inspect the DOM and find elements with `height: 0`, `overflow: hidden`, or `opacity: 0`
- Check the browser console for JavaScript errors preventing component rendering
- If icons are loaded from an external library (FontAwesome, Heroicons, etc.), verify the library loads correctly
- If content relies on JavaScript to render, ensure scripts run after DOM is ready (`DOMContentLoaded` or `defer`)
- Confirm all four stat cards (icon + text) are fully visible with their content

---

### 2. Fix the Stats Cards

**Problem:** The four cards at the bottom of the Hero are clipped and their content is not visible.

**Required:**
```
- Each card must contain: icon + numeric heading + description text
- Add appropriate min-height to cards (minimum 140px)
- Ensure no overflow: hidden on the wrapper without a sufficient height defined
- Suggested card style:
  - White background with subtle shadow
  - border-radius: 12px
  - padding: 24px
  - Icon: 32px, green color
  - Number: 28px bold, navy color
  - Text: 14px, gray color
```

---

### 3. Clarify the Video Icon

**Problem:** The green play button icon in the top-right corner is not clear to the user.

**Required:**
- Add a tooltip or small label next to it: `"Virtual Tour"` or `"Watch Video"`
- On hover, show the text with a smooth transition (0.2s)
- Ensure the `<a>` or `<button>` element has `aria-label="Watch Introduction Video"` for accessibility

```css
.video-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
}
.video-btn .label {
  font-size: 13px;
  opacity: 0;
  transition: opacity 0.2s;
  white-space: nowrap;
}
.video-btn:hover .label {
  opacity: 1;
}
```

---

### 4. Fix Color Contrast (Accessibility)

**Problem:** White text over background images may not meet WCAG AA standard (4.5:1 ratio).

**Required:**
- Add a dark overlay on the Hero image:
```css
.hero-section::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(10, 20, 50, 0.55) 0%,
    rgba(10, 20, 50, 0.35) 50%,
    rgba(10, 20, 50, 0.65) 100%
  );
  z-index: 1;
}
.hero-content {
  position: relative;
  z-index: 2;
}
```
- Run Chrome DevTools > Lighthouse > Accessibility and confirm Score ≥ 90

---

### 5. Strengthen Hero Text with Real Stats

**Problem:** Current text is too generic and doesn't differentiate the university.

**Required:**
- Replace or add below the description a stats bar with 3–4 numbers:
```html
<div class="hero-stats">
  <div class="stat">
    <span class="stat-number">5000+</span>
    <span class="stat-label">Enrolled Students</span>
  </div>
  <div class="stat">
    <span class="stat-number">30+</span>
    <span class="stat-label">Academic Specializations</span>
  </div>
  <div class="stat">
    <span class="stat-number">2013</span>
    <span class="stat-label">Founded</span>
  </div>
</div>
```
- **Note:** Replace numbers with real university data from the database or config files
- Suggested style: large white bold numbers, smaller semi-transparent labels

---

### 6. Add Sticky Navbar Scroll Behavior

**Problem:** The navbar may lose readability when scrolling over the hero image.

**Required:**
```javascript
window.addEventListener('scroll', () => {
  const navbar = document.querySelector('.navbar'); // replace with correct selector
  if (window.scrollY > 80) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
});
```
```css
.navbar.scrolled {
  background: rgba(255, 255, 255, 0.97);
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 20px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
}
```

---

### 7. Improve the Login Button in Navbar

**Problem:** The button needs visual improvement to stand out as a clear CTA.

**Required:**
```css
.login-btn {
  background: var(--color-primary, #1a2744);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  padding: 10px 20px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s, transform 0.15s;
}
.login-btn:hover {
  background: var(--color-primary-dark, #0f1a33);
  transform: translateY(-1px);
}
.login-btn:active {
  transform: translateY(0);
}
```

---

### 8. Add Skeleton Loading for Dynamic Content

**Problem:** JavaScript-rendered content either flashes in suddenly or doesn't appear at all.

**Required:**
- Add Skeleton Loading for cards:
```css
.skeleton {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  border-radius: 8px;
}
@keyframes skeleton-loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```
- Show skeleton during fetch, replace with real content once loaded

---

### 9. Responsive Improvements

**Problem:** Potential layout issues on mobile screens.

**Required:**
```css
@media (max-width: 768px) {
  .hero-title {
    font-size: clamp(2rem, 8vw, 4rem);
  }
  .hero-buttons {
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .hero-stats {
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }
  .stats-cards-row {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 480px) {
  .stats-cards-row {
    grid-template-columns: 1fr;
  }
}
```

---

### 10. Verify `lang` and `dir` Attributes

**Problem:** Correct language settings must be confirmed for SEO and accessibility.

**Required:**
- Ensure `<html>` tag includes:
```html
<html lang="ar" dir="rtl">
```
- And that `<head>` contains:
```html
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

---

### 11. Fix All Console Errors

**Required:**
- Open Developer Tools > Console
- Fix **all** errors (red)
- Address warnings (yellow) related to: deprecations, missing alt text, broken images
- Ensure all `<img>` elements have descriptive `alt` attributes in Arabic

---

### 12. Basic SEO Improvements

**Required:**
```html
<!-- Inside <head> -->
<title>October Technological University — Integrated Education in the Heart of Egypt</title>
<meta name="description" content="October Technological University offers distinguished academic education combining theoretical knowledge and practical experience across 30+ specializations.">
<meta property="og:title" content="October Technological University">
<meta property="og:description" content="Integrated academic education in the heart of Egypt's tech hub.">
<meta property="og:image" content="[cover image URL]">
```

---

## Definition of Done

After completing all changes, verify:

- [ ] No empty white space sections on the page
- [ ] All cards display with full content
- [ ] Lighthouse Accessibility Score ≥ 90
- [ ] Lighthouse Performance Score ≥ 80
- [ ] Zero errors in Console
- [ ] Page works correctly on: Chrome, Firefox, Safari
- [ ] Page looks correct on: Mobile (375px), Tablet (768px), Desktop (1440px)
- [ ] RTL direction works correctly across all elements

---

## Important Notes for the AI

- **Do not change** the brand identity (colors and core fonts) unless strictly necessary to fix a contrast issue
- **Preserve** all existing links and functionality
- **Inspect** the current code first before making any changes — do not assume specific structures
- If the site uses a Framework (React, Vue, Next.js, etc.), apply changes in that framework's style
- If you find additional issues not listed here, fix them and add a comment explaining what you did
