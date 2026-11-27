// Property AI Agent Theme Configuration
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

// Premium palette (Pipory-inspired): blue-white page, deep navy ink, electric blue actions
export const growlyzePalette = {
  page: '#f6f8fc',
  surface: '#ffffff',
  surface2: '#eef3fb',
  ink: '#050d1f',
  muted: '#4a5570',
  faint: '#8090ad',
  line: '#dfe6f2',
  lineStrong: '#cad5e6',
  brand: '#1e6bff',
  brandLight: '#4d8bff',
  brandDark: '#1554e0',
  brandSoft: '#e2ecff',
  night: '#050d1f',
  night2: '#0b1730',
  night3: '#12213f',
  nightLine: '#1c2c4d',
  green: '#00bb7f',
  amber: '#f99c00',
  red: '#e5484d',
} as const;

const g = growlyzePalette;

export const lightTheme: ThemeConfig = {
  mode: 'light',
  colors: {
    background: { default: g.page, paper: g.surface, elevated: g.surface },
    surface: { default: g.surface2, hover: '#e8eef9', selected: g.brandSoft, disabled: g.surface2 },
    text: { primary: g.ink, secondary: g.muted, disabled: g.faint },
    primary: { main: g.brand, light: g.brandLight, dark: g.brandDark, contrast: '#ffffff' },
    secondary: { main: '#0a1730', light: '#29406a', dark: g.ink, contrast: '#ffffff' },
    success: { main: g.green, light: '#5ee9b5', dark: '#007956', contrast: '#ffffff' },
    warning: { main: g.amber, light: '#ffd236', dark: '#b75000', contrast: g.ink },
    error: { main: g.red, light: '#ffa3a3', dark: '#b4232a', contrast: '#ffffff' },
    border: { default: g.line, hover: g.lineStrong, focus: g.brand },
  },
};

export const darkTheme: ThemeConfig = {
  mode: 'dark',
  colors: {
    background: { default: g.night, paper: g.night2, elevated: g.night3 },
    surface: { default: g.night3, hover: '#16284a', selected: '#13285a', disabled: g.night3 },
    text: { primary: '#eef3fb', secondary: '#a9b6cf', disabled: '#5f6b85' },
    primary: { main: '#5c95ff', light: '#93b8ff', dark: g.brand, contrast: g.night },
    secondary: { main: '#93b8ff', light: '#c9dcff', dark: '#5c95ff', contrast: g.night },
    success: { main: '#00d294', light: '#5ee9b5', dark: '#009767', contrast: g.night },
    warning: { main: '#fcbb00', light: '#ffd236', dark: '#dd7400', contrast: g.night },
    error: { main: '#ff6568', light: '#ffa3a3', dark: '#e40014', contrast: g.night },
    border: { default: g.nightLine, hover: '#29406a', focus: '#5c95ff' },
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