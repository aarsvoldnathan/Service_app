import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

export type AccentKey = 'amber' | 'blue' | 'green' | 'red';
export type ThemeMode = 'system' | 'dark' | 'light';

export type Palette = {
  bg: string;
  card: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  /** Text color to use on top of the accent color. */
  onAccent: string;
  ok: string;
  warn: string;
  orange: string;
  danger: string;
};

export const ACCENTS: Record<AccentKey, { label: string; color: string; on: string }> = {
  amber: { label: 'Amber', color: '#FFB020', on: '#1A1200' },
  blue: { label: 'Blue', color: '#3B82F6', on: '#FFFFFF' },
  green: { label: 'Green', color: '#22C55E', on: '#06200F' },
  red: { label: 'Red', color: '#EF4444', on: '#FFFFFF' },
};

const DARK = {
  bg: '#0E1013',
  card: '#181B20',
  border: '#2A2F38',
  text: '#F2F4F7',
  muted: '#8B93A1',
  ok: '#3DD68C',
  warn: '#FACC15',
  orange: '#FB923C',
  danger: '#FF5A4F',
};

const LIGHT = {
  bg: '#F3F4F6',
  card: '#FFFFFF',
  border: '#D6DAE1',
  text: '#111418',
  muted: '#5B6472',
  ok: '#15803D',
  warn: '#A16207',
  orange: '#C2410C',
  danger: '#C62828',
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24 };
export const radius = 12;
/** Minimum touch target size (points) so the app is usable with gloves / in a shop. */
export const touch = 52;

type ThemeValue = { c: Palette; isDark: boolean };

const ThemeContext = createContext<ThemeValue>({
  c: { ...DARK, accent: ACCENTS.amber.color, onAccent: ACCENTS.amber.on },
  isDark: true,
});

export function ThemeProvider({
  mode,
  accent,
  children,
}: {
  mode: ThemeMode;
  accent: AccentKey;
  children: React.ReactNode;
}) {
  const system = useColorScheme();
  const isDark = mode === 'system' ? system !== 'light' : mode === 'dark';
  const value = useMemo<ThemeValue>(() => {
    const a = ACCENTS[accent] ?? ACCENTS.amber;
    return { c: { ...(isDark ? DARK : LIGHT), accent: a.color, onAccent: a.on }, isDark };
  }, [isDark, accent]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}

/** Build a StyleSheet from the current palette, rebuilt only when the theme changes. */
export function useStyles<T>(factory: (c: Palette) => T): T {
  const { c } = useTheme();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => factory(c), [c]);
}
