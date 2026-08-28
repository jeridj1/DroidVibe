import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { light, dark, type Palette } from './colors';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeCtx {
  mode: ThemeMode;
  resolved: 'light' | 'dark';
  palette: Palette;
  textScale: number;
  twoPane: boolean;
  setMode: (m: ThemeMode) => void;
  setTextScale: (n: number) => void;
  setTwoPane: (b: boolean) => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

const STORAGE_KEY = 'droidvibe.theme';
const TEXT_SCALE_KEY = 'droidvibe.textScale';
const TWO_PANE_KEY = 'droidvibe.twoPane';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>('system');
  const [textScale, setTextScale] = useState(1);
  const [twoPane, setTwoPane] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Restore persisted preferences on mount
  useEffect(() => {
    (async () => {
      try {
        const [savedMode, savedScale, savedTwoPane] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(TEXT_SCALE_KEY),
          AsyncStorage.getItem(TWO_PANE_KEY),
        ]);
        if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system') {
          setMode(savedMode);
        }
        if (savedScale) {
          const n = parseFloat(savedScale);
          if (!isNaN(n) && n >= 0.75 && n <= 1.5) setTextScale(n);
        }
        if (savedTwoPane === 'true') setTwoPane(true);
      } catch {
        // AsyncStorage not available (Expo Go without the module) — fall back to defaults
      }
      setLoaded(true);
    })();
  }, []);

  // Persist mode when it changes
  useEffect(() => {
    if (loaded) AsyncStorage.setItem(STORAGE_KEY, mode).catch(() => {});
  }, [mode, loaded]);

  // Persist textScale
  useEffect(() => {
    if (loaded) AsyncStorage.setItem(TEXT_SCALE_KEY, String(textScale)).catch(() => {});
  }, [textScale, loaded]);

  // Persist twoPane
  useEffect(() => {
    if (loaded) AsyncStorage.setItem(TWO_PANE_KEY, String(twoPane)).catch(() => {});
  }, [twoPane, loaded]);

  const resolved: 'light' | 'dark' = mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;
  const palette = useMemo(() => (resolved === 'dark' ? dark : light), [resolved]);

  const value: ThemeCtx = { mode, resolved, palette, textScale, twoPane, setMode, setTextScale, setTwoPane };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
