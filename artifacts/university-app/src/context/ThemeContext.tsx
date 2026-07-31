import React, { createContext, useContext, useEffect, useState } from 'react';

interface ThemeContextType {
  theme: string;
  toggleTheme: () => void;
  isDark: boolean;
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  density: string;
  toggleDensity: () => void;
  isCompact: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  toggleTheme: () => {},
  isDark: false,
  isSidebarCollapsed: false,
  toggleSidebar: () => {},
  density: 'comfortable',
  toggleDensity: () => {},
  isCompact: false,
});

export const useTheme = () => useContext(ThemeContext);

const getInitialTheme = (): string => {
  if (typeof window === 'undefined') return 'light';

  const saved = localStorage.getItem('theme');
  if (saved === 'dark' || saved === 'light') {
    return saved;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const applyThemeToDocument = (theme: string) => {
  const root = document.documentElement;
  const isDark = theme === 'dark';

  root.classList.toggle('dark', isDark);
  root.classList.toggle('light', !isDark);
  root.style.colorScheme = isDark ? 'dark' : 'light';
  localStorage.setItem('theme', theme);
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState(getInitialTheme);
  
  const [density, setDensity] = useState(() => {
    if (typeof window === 'undefined') return 'comfortable';
    return localStorage.getItem('density') === 'compact' ? 'compact' : 'comfortable';
  });

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);
  
  useEffect(() => {
    localStorage.setItem('density', density);
    if (density === 'compact') {
      document.documentElement.classList.add('compact-mode');
    } else {
      document.documentElement.classList.remove('compact-mode');
    }
  }, [density]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => !prev);
  };
  
  const toggleDensity = () => {
    setDensity((prev) => (prev === 'comfortable' ? 'compact' : 'comfortable'));
  };

  const isDark = theme === 'dark';
  const isCompact = density === 'compact';

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme,
        isDark,
        isSidebarCollapsed,
        toggleSidebar,
        density,
        toggleDensity,
        isCompact,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
