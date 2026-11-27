import { MD3LightTheme, MD3DarkTheme, configureFonts } from 'react-native-paper';
import { DefaultTheme, DarkTheme } from '@react-navigation/native';

const fontConfig = {
  fontFamily: 'System',
};

export const lightTheme = {
  ...MD3LightTheme,
  ...DefaultTheme,
  colors: {
    ...MD3LightTheme.colors,
    ...DefaultTheme.colors,
    primary: '#1e6bff',
    secondary: '#4d8bff',
    accent: '#1e6bff',
    background: '#f6f8fc',
    surface: '#ffffff',
    error: '#e5484d',
    text: '#050d1f',
    onSurface: '#050d1f',
    disabled: '#8090ad',
    placeholder: '#8090ad',
    backdrop: 'rgba(0, 0, 0, 0.5)',
    notification: '#1e6bff',
  },
  fonts: configureFonts({ config: fontConfig }),
};

export const darkTheme = {
  ...MD3DarkTheme,
  ...DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    ...DarkTheme.colors,
    primary: '#5c95ff',
    secondary: '#93b8ff',
    accent: '#5c95ff',
    background: '#050d1f',
    surface: '#0b1730',
    error: '#ff6568',
    text: '#eef3fb',
    onSurface: '#eef3fb',
    disabled: '#757575',
    placeholder: '#757575',
    backdrop: 'rgba(0, 0, 0, 0.7)',
    notification: '#1e6bff',
  },
  fonts: configureFonts({ config: fontConfig }),
};

export const theme = lightTheme;