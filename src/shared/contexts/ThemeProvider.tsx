import { createContext, useContext, useEffect } from 'react';
import { useLocalStorage } from '@/shared/hooks/useStorage';
import { THEME_CONFIG } from '@/shared/utils/constants';

type Theme = 'dark' | 'light' | 'system';

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
  forcedTheme?: Theme;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = THEME_CONFIG.STORAGE_KEY,
  forcedTheme,
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useLocalStorage<Theme>(storageKey, defaultTheme);
  const resolvedTheme = forcedTheme ?? theme;

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove('light', 'dark');

    if (forcedTheme) {
      root.classList.add(forcedTheme);
      return;
    }

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
        .matches
        ? 'dark'
        : 'light';

      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [forcedTheme, theme]);

  const value = {
    theme: resolvedTheme,
    setTheme: forcedTheme ? () => null : setTheme
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider');

  return context;
};
