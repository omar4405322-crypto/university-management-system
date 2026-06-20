# Theme Audit: 6th of October Technological University

## 1. Stack and Framework
- **Framework:** React 19 / Vite
- **Language:** TypeScript (`.tsx`)
- **Styling Solution:** Tailwind CSS v4 (`@tailwindcss/postcss`) with custom configurations in `tailwind.config.js`.

## 2. Colors and Palette (Navy + Accent)
The project relies heavily on the `brand` namespace within Tailwind config:
- **Brand Primary (Lime Green):** 
  - Base: `#8BB83C` (brand-primary-500)
  - Used for accents, buttons, and highlights.
- **Brand Navy:** 
  - Base: `#132231` (brand-navy-500)
  - Used for primary text, backgrounds, and headers.
- **Accents:** 
  - Yellow: `#D6BA34`
  - Rose: `#EF4444`
  - Blue: `#3B82F6`
  - Emerald: `#10B981`
  - Amber: `#F59E0B`
- **Surfaces:**
  - Light: `#F8FAFC`
  - Card: `#FFFFFF`
  - Dark: `#0D1A24`
- **Text:** Primary (`#132231`), Secondary (`#64748b`), Muted (`#94a3b8`).

## 3. Typography and Fonts
- **Primary Font (Arabic):** 'Cairo', 'sans-serif'
- **Fallback / General Font:** 'Inter', 'Poppins', 'system-ui'
- The website is completely RTL.

## 4. Spacing and Design Tokens
- Border Radius: `xl` (0.75rem), `2xl` (1rem), `3xl` (1.5rem)
- Shadows: `soft`, `card`, `elevated`, `inner-soft`

## 5. Current Icon System
- The project currently uses a mix of:
  - **Flat Emojis:** Used in the `colleges` array (e.g., 🖥️, ⚙️, 💊, 📊, 🎨, ⚡).
  - **Lucide React (Outline):** Used in the rest of the application (e.g., `GraduationCap`, `Building2`, `Users`, `Globe`, `Trophy`).
- **Goal for Revamp:** Replace all emojis with `lucide-react` icons, standardizing on a 2px stroke width, consistent sizing (24px for cards), and theme colors.
