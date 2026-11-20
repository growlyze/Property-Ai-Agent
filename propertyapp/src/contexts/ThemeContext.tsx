import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useColorScheme } from 'react-native';

// Default colors for light and dark themes
const lightTheme = {
  background: '#f5f0e6',
  text: '#140827',
  textSecondary: '#5b5066',
  primary: '#f55809',
  secondary: '#9a57ff',
  accent: '#f55809',
  border: '#140827',
  error: '#d92d20',
  success: '#0db664',
  warning: '#ffb900',
  inputBackground: '#fbf8f2',
  cardBackground: '#fbf8f2',
  shadow: 'rgba(0, 0, 0, 0.1)',
};

const darkTheme = {
  background: '#140827',
  text: '#f5f0e6',
  textSecondary: '#c4b9d4',
  primary: '#f55809',
  secondary: '#b78aff',
  accent: '#f55809',
  border: '#3a2a58',
  error: '#FF453A',
  success: '#32D74B',
  warning: '#FFD60A',
  inputBackground: '#2C2C2C',
  cardBackground: '#2C2C2C',
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