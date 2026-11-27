import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useColorScheme } from 'react-native';

// Default colors for light and dark themes
const lightTheme = {
  background: '#f6f8fc',
  text: '#050d1f',
  textSecondary: '#4a5570',
  primary: '#1e6bff',
  secondary: '#4d8bff',
  accent: '#1e6bff',
  border: '#dfe6f2',
  error: '#e5484d',
  success: '#00bb7f',
  warning: '#f99c00',
  inputBackground: '#ffffff',
  cardBackground: '#ffffff',
  shadow: 'rgba(5, 13, 31, 0.08)',
};

const darkTheme = {
  background: '#050d1f',
  text: '#f6f8fc',
  textSecondary: '#a9b6cf',
  primary: '#5c95ff',
  secondary: '#93b8ff',
  accent: '#5c95ff',
  border: '#1c2c4d',
  error: '#ff6568',
  success: '#00d294',
  warning: '#fcbb00',
  inputBackground: '#0b1730',
  cardBackground: '#0b1730',
  shadow: 'rgba(0, 0, 0, 0.5)',
};

// Theme context type
interface ThemeContextType {
  isDark: boolean;
  colors: typeof lightTheme;
  toggleTheme: () => void;
}

// Create context with default values
const ThemeContext = createContext<ThemeContextType>({
  isDark: false,
  colors: lightTheme,
  toggleTheme: () => {},
});

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // Get device color scheme
  const colorScheme = useColorScheme();
  const [isDark, setIsDark] = useState(colorScheme === 'dark');
  
  // Get current theme colors based on isDark state
  const colors = isDark ? darkTheme : lightTheme;
  
  // Toggle between light and dark themes
  const toggleTheme = () => {
    setIsDark(!isDark);
  };
  
  // Context value
  const contextValue: ThemeContextType = {
    isDark,
    colors,
    toggleTheme,
  };
  
  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  
  return context;
}; 