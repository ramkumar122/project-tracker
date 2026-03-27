import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeColors, darkColors, lightColors } from '../constants/theme';

type ColorScheme = 'dark' | 'light';

interface ThemeContextValue {
  colors: ThemeColors;
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: darkColors,
  isDark: true,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [scheme, setScheme] = useState<ColorScheme>('dark');

  useEffect(() => {
    AsyncStorage.getItem('colorScheme').then((val) => {
      if (val === 'light' || val === 'dark') setScheme(val);
    });
  }, []);

  const toggleTheme = () => {
    const next: ColorScheme = scheme === 'dark' ? 'light' : 'dark';
    setScheme(next);
    AsyncStorage.setItem('colorScheme', next);
  };

  const colors = scheme === 'dark' ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ colors, isDark: scheme === 'dark', toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
