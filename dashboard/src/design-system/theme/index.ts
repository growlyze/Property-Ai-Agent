// Growlyze Property AI Agent Theme System - Main Export
// Central access point for all theme-related functionality

export * from './ThemeContext';
export * from './ThemeProvider';
export * from './themeConfig';
export * from './useTheme';

// Re-export the theme context hook with a simpler name
export { useThemeContext as useGrowlyzeTheme } from './ThemeContext';

// Default export for the main theme provider
export { default as GrowlyzeThemeProvider } from './ThemeProvider';