/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Poppins', 'Cairo', 'system-ui', 'sans-serif'],
        arabic: ['Cairo', 'sans-serif'],
      },
      colors: {
        // Core Design Tokens
        brand: {
          primary: {
            50: '#f4f8ec',
            100: '#e9f1d9',
            200: '#d3e3b3',
            300: '#b4d16e',
            400: '#9fc550',
            500: '#8BB83C', // Base Lime Green
            600: '#6f9330',
            700: '#5e7d25',
            800: '#4c651e',
            900: '#3d5218',
            950: '#222d0d',
          },
          navy: {
            50: '#f1f5f9',
            100: '#e2e8f0',
            200: '#cbd5e1',
            300: '#94a3b8',
            400: '#64748b',
            500: '#132231', // Base Navy
            600: '#0f1d2a',
            700: '#0a1520',
            800: '#060d14',
            900: '#03060a',
          },
          accent: {
            yellow: '#D6BA34',
            rose: '#EF4444',
            blue: '#3B82F6',
            emerald: '#10B981',
            amber: '#F59E0B',
          },
          surface: {
            light: '#F8FAFC',
            card: '#FFFFFF',
            dark: '#0D1A24',
          },
          text: {
            primary: '#132231',
            secondary: '#64748b',
            muted: '#94a3b8',
          }
        },
        // Semantic Aliases
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#3B82F6',
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'elevated': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'inner-soft': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      letterSpacing: {
        'tightest': '-.075em',
        'tighter': '-.05em',
        'tight': '-.025em',
        'wide': '.025em',
        'wider': '.05em',
        'widest': '.1em',
        'extrawide': '.25em',
      }
    },
  },
  plugins: [],
}
