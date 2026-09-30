import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

const ThemeToggle = ({ className = '' }) => {
  const { isDark, toggleTheme } = useTheme();
  const { isRTL } = useLanguage();

  const label = isDark
    ? isRTL ? 'التبديل إلى الوضع الفاتح' : 'Switch to light mode'
    : isRTL ? 'التبديل إلى الوضع الداكن' : 'Switch to dark mode';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`rounded-xl p-2 transition-colors duration-200 hover:bg-surface-subtle text-brand-text-secondary dark:text-gray-300 cursor-pointer ${className}`}
      aria-label={label}
      aria-pressed={isDark}
    >
      {isDark ? (
        <Sun className="h-5 w-5 text-amber-400" aria-hidden="true" />
      ) : (
        <Moon className="h-5 w-5 text-brand-text-secondary" aria-hidden="true" />
      )}
    </button>
  );
};

export default ThemeToggle;
