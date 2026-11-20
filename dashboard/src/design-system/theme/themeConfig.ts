// Growlyze Property AI Agent Theme Configuration
// Light and dark theme definitions with CSS custom property mappings

import { tokens } from '../tokens';

export type ThemeMode = 'light' | 'dark';

export interface ThemeConfig {
  mode: ThemeMode;
  colors: {
    background: {
      default: string;
      paper: string;
      elevated: string;
    };
    surface: {
      default: string;
      hover: string;
      selected: string;
      disabled: string;
    };
    text: {
      primary: string;
      secondary: string;
      disabled: string;
    };
    primary: {
      main: string;
      light: string;
      dark: string;
      contrast: string;
    };
    secondary: {
      main: string;
      light: string;
      dark: string;
      contrast: string;
    };
    success: {
      main: string;
      light: string;
      dark: string;
      contrast: string;
    };
    warning: {
      main: string;
      light: string;
      dark: string;
      contrast: string;
    };
    error: {
      main: string;
      light: string;
      dark: string;
      contrast: string;
    };
    border: {
      default: string;
      hover: string;
      focus: string;
    };
  };
}

// Growlyze palette (matches growlyze.com):
//   cream #f5f0e6 · ink #140827 · orange #f55809
//   purple #9a57ff · blue #397ae7 · green #0db664 · yellow #ffb900
export const growlyzePalette = {
  cream: '#f5f0e6',
  creamLight: '#fbf8f2',
  creamDark: '#ece4d4',
  ink: '#140827',
  orange: '#f55809',
  orangeLight: '#ff7a33',
  orangeDark: '#d94e07',
  purple: '#9a57ff',
  purpleLight: '#b78aff',
  blue: '#397ae7',
  blueLight: '#75a8ff',
  green: '#0db664',
  greenLight: '#86dbb2',
  yellow: '#ffb900',
} as const;

const g = growlyzePalette;

// Light theme configuration: cream page, ink text and borders, orange actions
export const lightTheme: ThemeConfig = {
  mode: 'light',
  colors: {
    background: {
      default: g.cream,
      paper: g.creamLight,
      elevated: g.creamLight,
    },
    surface: {
      default: g.creamDark,
      hover: '#e4dac6',
      selected: '#fde2d2',
      disabled: g.creamDark,
    },
    text: {
      primary: g.ink,
      secondary: '#5b5066',
      disabled: '#8e8597',
    },
    primary: {
      main: g.orange,
      light: g.orangeLight,
      dark: g.orangeDark,
      contrast: '#ffffff',
    },
    secondary: {
      main: g.purple,
      light: g.purpleLight,
      dark: '#7a3be0',
      contrast: '#ffffff',
    },
    success: {
      main: g.green,
      light: g.greenLight,
      dark: '#07894a',
      contrast: '#ffffff',
    },
    warning: {
      main: g.yellow,
      light: '#ffd36b',
      dark: '#c98f00',
      contrast: g.ink,
    },
    error: {
      main: '#d92d20',
      light: '#f07a70',
      dark: '#9b1c1c',
      contrast: '#ffffff',
    },
    border: {
      default: g.ink,
      hover: g.ink,
      focus: g.orange,
    },
  },
};

// Dark theme configuration: ink page, cream text and borders, orange actions
export const darkTheme: ThemeConfig = {
  mode: 'dark',
  colors: {
    background: {
      default: g.ink,
      paper: '#1d1033',
      elevated: '#2a1a45',
    },
    surface: {
      default: '#2a1a45',
      hover: '#3a2a58',
      selected: '#3d1d1a',
      disabled: '#2a1a45',
    },
    text: {
      primary: g.cream,
      secondary: '#c4b9d4',
      disabled: '#8a7ea0',
    },
    primary: {
      main: g.orange,
      light: g.orangeLight,
      dark: g.orangeDark,
      contrast: '#ffffff',
    },
    secondary: {
      main: g.purpleLight,
      light: '#d2b6ff',
      dark: g.purple,
      contrast: g.ink,
    },
    success: {
      main: g.green,
      light: g.greenLight,
      dark: '#07894a',
      contrast: g.ink,
    },
    warning: {
      main: g.yellow,
      light: '#ffd36b',
      dark: '#c98f00',
      contrast: g.ink,
    },
    error: {
      main: '#f07a70',
      light: '#f5b5ae',
      dark: '#d92d20',
      contrast: g.ink,
    },
    border: {
      default: g.cream,
      hover: g.cream,
      focus: g.orange,
    },
  },
};

// Theme configurations map
export const themes = {
  light: lightTheme,
  dark: darkTheme,
} as const;

// CSS custom property mapping
export const getCSSCustomProperties = (theme: ThemeConfig): Record<string, string> => {
  return {
    // Background colors
    '--color-background-default': theme.colors.background.default,
    '--color-background-paper': theme.colors.background.paper,
    '--color-background-elevated': theme.colors.background.elevated,
    
    // Surface colors
    '--color-surface-default': theme.colors.surface.default,
    '--color-surface-hover': theme.colors.surface.hover,
    '--color-surface-selected': theme.colors.surface.selected,
    '--color-surface-disabled': theme.colors.surface.disabled,
    
    // Text colors
    '--color-text-primary': theme.colors.text.primary,
    '--color-text-secondary': theme.colors.text.secondary,
    '--color-text-disabled': theme.colors.text.disabled,
    
    // Primary colors
    '--color-primary-main': theme.colors.primary.main,
    '--color-primary-light': theme.colors.primary.light,
    '--color-primary-dark': theme.colors.primary.dark,
    '--color-primary-contrast': theme.colors.primary.contrast,
    
    // Secondary colors
    '--color-secondary-main': theme.colors.secondary.main,
    '--color-secondary-light': theme.colors.secondary.light,
    '--color-secondary-dark': theme.colors.secondary.dark,
    '--color-secondary-contrast': theme.colors.secondary.contrast,
    
    // Success colors
    '--color-success-main': theme.colors.success.main,
    '--color-success-light': theme.colors.success.light,
    '--color-success-dark': theme.colors.success.dark,
    '--color-success-contrast': theme.colors.success.contrast,
    
    // Warning colors
    '--color-warning-main': theme.colors.warning.main,
    '--color-warning-light': theme.colors.warning.light,
    '--color-warning-dark': theme.colors.warning.dark,
    '--color-warning-contrast': theme.colors.warning.contrast,
    
    // Error colors
    '--color-error-main': theme.colors.error.main,
    '--color-error-light': theme.colors.error.light,
    '--color-error-dark': theme.colors.error.dark,
    '--color-error-contrast': theme.colors.error.contrast,
    
    // Border colors
    '--color-border-default': theme.colors.border.default,
    '--color-border-hover': theme.colors.border.hover,
    '--color-border-focus': theme.colors.border.focus,
  };
};