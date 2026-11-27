import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme, Theme } from '@mui/material/styles';
import { lightTheme, darkTheme, getCSSCustomProperties } from '../design-system/theme/themeConfig';
import { tokens } from '../design-system/tokens';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  mode: ThemeMode;
  actualMode: 'light' | 'dark'; // The actual applied theme (resolves 'system')
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'growlyze-theme-preference';

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Initialize theme from localStorage or default to 'system'
  const [mode, setMode] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return (stored as ThemeMode) || 'light';
  });

  // Detect system preference
  const [systemPreference, setSystemPreference] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  // Calculate actual mode (resolve 'system' to light/dark)
  const actualMode: 'light' | 'dark' = mode === 'system' ? systemPreference : mode;

  // Listen to system preference changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemPreference(e.matches ? 'dark' : 'light');
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } 
    // Legacy browsers
    else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  // Create MUI theme based on actualMode
  const muiTheme = useMemo<Theme>(() => {
    const themeConfig = actualMode === 'dark' ? darkTheme : lightTheme;
    // Premium (Pipory-style) surfaces: hairline borders, soft layered shadows, 16px radius.
    const isDark = actualMode === 'dark';
    const line = themeConfig.colors.border.default;
    const display = '"Bricolage Grotesque", "Geist", system-ui, sans-serif';
    const cardShadow = isDark
      ? 'inset 0 1px rgba(255,255,255,0.05), 0 24px 50px -16px rgba(0,0,0,0.55)'
      : 'inset 0 1px rgba(255,255,255,0.95), 0 0 0 1px rgba(5,13,31,0.02), 0 14px 36px -18px rgba(5,13,31,0.22)';
    const brandShadow = '0 1px 0 rgba(255,255,255,0.25) inset, 0 10px 24px -12px rgba(21,84,224,0.55)';

    return createTheme({
      palette: {
        mode: actualMode,
        primary: {
          light: themeConfig.colors.primary.light,
          main: themeConfig.colors.primary.main,
          dark: themeConfig.colors.primary.dark,
          contrastText: themeConfig.colors.primary.contrast,
        },
        secondary: {
          light: themeConfig.colors.secondary.light,
          main: themeConfig.colors.secondary.main,
          dark: themeConfig.colors.secondary.dark,
          contrastText: themeConfig.colors.secondary.contrast,
        },
        error: {
          light: themeConfig.colors.error.light,
          main: themeConfig.colors.error.main,
          dark: themeConfig.colors.error.dark,
          contrastText: themeConfig.colors.error.contrast,
        },
        warning: {
          light: themeConfig.colors.warning.light,
          main: themeConfig.colors.warning.main,
          dark: themeConfig.colors.warning.dark,
          contrastText: themeConfig.colors.warning.contrast,
        },
        success: {
          light: themeConfig.colors.success.light,
          main: themeConfig.colors.success.main,
          dark: themeConfig.colors.success.dark,
          contrastText: themeConfig.colors.success.contrast,
        },
        text: {
          primary: themeConfig.colors.text.primary,
          secondary: themeConfig.colors.text.secondary,
          disabled: themeConfig.colors.text.disabled,
        },
        background: {
          default: themeConfig.colors.background.default,
          paper: themeConfig.colors.background.paper,
        },
      },
      typography: {
        fontFamily: tokens.typography.fontFamily.sans,
        h1: {
          fontSize: tokens.typography.heading.h1.fontSize,
          fontWeight: tokens.typography.heading.h1.fontWeight,
          lineHeight: tokens.typography.heading.h1.lineHeight,
          letterSpacing: tokens.typography.heading.h1.letterSpacing,
        },
        h2: {
          fontSize: tokens.typography.heading.h2.fontSize,
          fontWeight: tokens.typography.heading.h2.fontWeight,
          lineHeight: tokens.typography.heading.h2.lineHeight,
          letterSpacing: tokens.typography.heading.h2.letterSpacing,
        },
        h3: {
          fontSize: tokens.typography.heading.h3.fontSize,
          fontWeight: tokens.typography.heading.h3.fontWeight,
          lineHeight: tokens.typography.heading.h3.lineHeight,
        },
        h4: {
          fontSize: tokens.typography.heading.h4.fontSize,
          fontWeight: tokens.typography.heading.h4.fontWeight,
          lineHeight: tokens.typography.heading.h4.lineHeight,
        },
        h5: {
          fontSize: tokens.typography.heading.h5.fontSize,
          fontWeight: tokens.typography.heading.h5.fontWeight,
          lineHeight: tokens.typography.heading.h5.lineHeight,
        },
        h6: {
          fontSize: tokens.typography.heading.h6.fontSize,
          fontWeight: tokens.typography.heading.h6.fontWeight,
          lineHeight: tokens.typography.heading.h6.lineHeight,
        },
        body1: {
          fontSize: tokens.typography.body.medium.fontSize,
          fontWeight: tokens.typography.body.medium.fontWeight,
          lineHeight: tokens.typography.body.medium.lineHeight,
        },
        body2: {
          fontSize: tokens.typography.body.small.fontSize,
          fontWeight: tokens.typography.body.small.fontWeight,
          lineHeight: tokens.typography.body.small.lineHeight,
        },
      },
      shape: { borderRadius: 12 },
      components: {
        MuiCssBaseline: {
          styleOverrides: {
            body: {
              transition: 'background-color 0.3s ease, color 0.3s ease',
              fontFeatureSettings: '"ss01", "cv11"',
            },
          },
        },
        MuiTypography: {
          styleOverrides: {
            h1: { fontFamily: display, letterSpacing: '-0.035em' },
            h2: { fontFamily: display, letterSpacing: '-0.03em' },
            h3: { fontFamily: display, letterSpacing: '-0.025em' },
            h4: { fontFamily: display, letterSpacing: '-0.02em' },
            h5: { fontFamily: display, letterSpacing: '-0.015em' },
            h6: { fontFamily: display, letterSpacing: '-0.01em' },
          },
        },
        MuiPaper: {
          defaultProps: { elevation: 0 },
          styleOverrides: {
            root: { backgroundImage: 'none' },
            rounded: { borderRadius: 16 },
            outlined: { border: `1px solid ${line}` },
            elevation0: { border: `1px solid ${line}`, boxShadow: cardShadow },
          },
        },
        MuiCard: {
          defaultProps: { elevation: 0 },
          styleOverrides: {
            root: {
              border: `1px solid ${line}`,
              boxShadow: cardShadow,
              borderRadius: 16,
              transition: 'box-shadow .2s ease, transform .2s ease, border-color .2s ease',
            },
          },
        },
        MuiButton: {
          defaultProps: { disableElevation: true },
          styleOverrides: {
            root: {
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: 10,
              letterSpacing: '-0.005em',
              transition: 'all .15s ease',
            },
            contained: {
              '&.MuiButton-containedPrimary': { boxShadow: brandShadow },
              '&:hover': { transform: 'translateY(-1px)' },
              '&:active': { transform: 'translateY(0)' },
            },
            outlined: {
              borderColor: themeConfig.colors.border.hover,
              color: themeConfig.colors.text.primary,
              backgroundColor: themeConfig.colors.background.paper,
              '&:hover': { borderColor: themeConfig.colors.border.hover, backgroundColor: themeConfig.colors.surface.default },
            },
          },
        },
        MuiAppBar: {
          defaultProps: { elevation: 0 },
          styleOverrides: {
            root: {
              backgroundColor: isDark ? 'rgba(5,13,31,0.8)' : 'rgba(255,255,255,0.8)',
              backdropFilter: 'saturate(180%) blur(12px)',
              color: themeConfig.colors.text.primary,
              borderBottom: `1px solid ${line}`,
            },
          },
        },
        MuiDrawer: {
          styleOverrides: {
            paper: {
              backgroundColor: themeConfig.colors.background.paper,
              borderRight: `1px solid ${line}`,
            },
          },
        },
        MuiListItemButton: {
          styleOverrides: {
            root: {
              borderRadius: 10,
              '&:hover': { backgroundColor: themeConfig.colors.surface.default },
              '&.Mui-selected': {
                backgroundColor: themeConfig.colors.surface.selected,
                color: themeConfig.colors.primary.main,
                fontWeight: 600,
                '& .MuiListItemIcon-root': { color: themeConfig.colors.primary.main },
                '&:hover': { backgroundColor: themeConfig.colors.surface.selected },
              },
            },
          },
        },
        MuiChip: {
          styleOverrides: {
            root: { fontWeight: 600, borderRadius: 999 },
            outlined: { borderColor: line },
          },
        },
        MuiTableHead: {
          styleOverrides: {
            root: {
              '& .MuiTableCell-head': {
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                fontSize: '0.7rem',
                color: themeConfig.colors.text.secondary,
                backgroundColor: themeConfig.colors.surface.default,
                borderBottom: `1px solid ${line}`,
              },
            },
          },
        },
        MuiTableCell: {
          styleOverrides: { root: { borderBottom: `1px solid ${line}` } },
        },
        MuiOutlinedInput: {
          styleOverrides: {
            root: {
              borderRadius: 10,
              backgroundColor: themeConfig.colors.background.paper,
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: themeConfig.colors.border.hover },
            },
            notchedOutline: { borderColor: line },
          },
        },
        MuiAlert: {
          styleOverrides: { root: { borderRadius: 12 } },
        },
        MuiTab: {
          styleOverrides: { root: { textTransform: 'none', fontWeight: 600 } },
        },
        MuiDialog: {
          styleOverrides: {
            paper: {
              borderRadius: 20,
              border: `1px solid ${line}`,
              boxShadow: '0 28px 70px -20px rgba(5,13,31,0.32), 0 2px 8px rgba(5,13,31,0.06)',
            },
          },
        },
        MuiTooltip: {
          styleOverrides: { tooltip: { backgroundColor: '#050d1f', borderRadius: 8, fontWeight: 500 } },
        },
      },
    });
  }, [actualMode]);

  // Apply CSS custom properties to document root
  useEffect(() => {
    const themeConfig = actualMode === 'dark' ? darkTheme : lightTheme;
    const cssProps = getCSSCustomProperties(themeConfig);
    
    Object.entries(cssProps).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });
  }, [actualMode]);

  // Set theme mode and persist to localStorage
  const setThemeMode = (newMode: ThemeMode) => {
    setMode(newMode);
    localStorage.setItem(THEME_STORAGE_KEY, newMode);
  };

  // Toggle between light and dark (doesn't toggle system)
  const toggleTheme = () => {
    if (mode === 'system') {
      // If on system, switch to opposite of current system preference
      setThemeMode(systemPreference === 'dark' ? 'light' : 'dark');
    } else {
      // Toggle between light and dark
      setThemeMode(mode === 'dark' ? 'light' : 'dark');
    }
  };

  const value: ThemeContextType = {
    mode,
    actualMode,
    setThemeMode,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      <MuiThemeProvider theme={muiTheme}>
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

export const useThemeMode = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeMode must be used within a ThemeProvider');
  }
  return context;
};
