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
    primary: '#f55809',
    secondary: '#9a57ff',
    accent: '#f55809',
    background: '#f5f0e6',
    surface: '#fbf8f2',
    error: '#d92d20',
    text: '#140827',
    onSurface: '#140827',
    disabled: '#9e9e9e',
    placeholder: '#9e9e9e',
    backdrop: 'rgba(0, 0, 0, 0.5)',
    notification: '#ff4081',
  },
  fonts: configureFonts({ config: fontConfig }),
};

export const darkTheme = {
  ...MD3DarkTheme,
  ...DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    ...DarkTheme.colors,
    primary: '#f55809',
    secondary: '#b78aff',
    accent: '#f55809',
    background: '#140827',
    surface: '#1d1033',
    error: '#f44336',
    text: '#ffffff',
    onSurface: '#ffffff',
    disabled: '#757575',
    placeholder: '#757575',
    backdrop: 'rgba(0, 0, 0, 0.7)',
    notification: '#ff4081',
  },
  fonts: configureFonts({ config: fontConfig }),
};

export const theme = lightTheme;