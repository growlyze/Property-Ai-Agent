// Property AI Agent Design Tokens - Colors
// Foundation color system for consistent theming across platforms

export interface PrimitiveColors {
  blue: {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
  };
  green: {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
  };
  amber: {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
  };
  red: {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
  };
  gray: {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
  };
}

export interface SemanticColors {
  primary: {
    light: string;
    main: string;
    dark: string;
    contrast: string;
  };
  secondary: {
    light: string;
    main: string;
    dark: string;
    contrast: string;
  };
  success: {
    light: string;
    main: string;
    dark: string;
    contrast: string;
  };
  warning: {
    light: string;
    main: string;
    dark: string;
    contrast: string;
  };
  error: {
    light: string;
    main: string;
    dark: string;
    contrast: string;
  };
  text: {
    primary: string;
    secondary: string;
    disabled: string;
  };
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
}

export const primitiveColors: PrimitiveColors = {
  blue: {
    50: '#e3f2fd',
    100: '#bbdefb',
    200: '#90caf9',
    300: '#64b5f6',
    400: '#42a5f5',
    500: '#397ae7', // Growlyze blue (accent)
    600: '#1565c0',
    700: '#0d47a1',
    800: '#0a3d91',
    900: '#073282',
  },
  green: {
    50: '#e8f5e8',
    100: '#c8e6c9',
    200: '#a5d6a7',
    300: '#81c784',
    400: '#66bb6a',
    500: '#4caf50',
    600: '#43a047',
    700: '#388e3c',
    800: '#2e7d32',
    900: '#1b5e20',
  },
  amber: {
    50: '#fff8e1',
    100: '#ffecb3',
    200: '#ffe082',
    300: '#ffd54f',
    400: '#ffca28',
    500: '#ffc107',
    600: '#ffb300',
    700: '#ffa000',
    800: '#ff8f00',
    900: '#ff6f00',
  },
  red: {
    50: '#ffebee',
    100: '#ffcdd2',
    200: '#ef9a9a',
    300: '#e57373',
    400: '#ef5350',
    500: '#f44336',
    600: '#e53935',
    700: '#d32f2f',
    800: '#c62828',
    900: '#b71c1c',
  },
  // Growlyze warm neutrals: cream -> ink
  gray: {
    50: '#ffffff',
    100: '#f6f8fc',
    200: '#eef3fb',
    300: '#d8cdb9',
    400: '#a89fae',
    500: '#8090ad',
    600: '#4a5570',
    700: '#463a55',
    800: '#12213f',
    900: '#050d1f',
  },
};

export const semanticColors: SemanticColors = {
  // Growlyze orange is the primary brand colour.
  primary: { light: '#4d8bff', main: '#1e6bff', dark: '#1554e0', contrast: '#ffffff' },
  secondary: { light: '#93b8ff', main: '#4d8bff', dark: '#7a3be0', contrast: '#ffffff' },
  success: { light: '#86dbb2', main: '#0db664', dark: '#07894a', contrast: '#ffffff' },
  warning: { light: '#ffd36b', main: '#ffb900', dark: '#c98f00', contrast: '#050d1f' },
  error: { light: '#f07a70', main: '#d92d20', dark: '#9b1c1c', contrast: '#ffffff' },
  text: { primary: '#050d1f', secondary: '#4a5570', disabled: '#8090ad' },
  background: { default: '#f6f8fc', paper: '#ffffff', elevated: '#ffffff' },
  surface: { default: '#eef3fb', hover: '#e2ecff', selected: '#e2ecff', disabled: '#eef3fb' },
};