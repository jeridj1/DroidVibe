import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { light, dark, type Palette } from './colors';

export type { Palette } from './colors';

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

const STORAGE_KEY = '@droidvibe/theme';

interface StoredPrefs {
  mode: ThemeMode;
  textScale: number;
  twoPane: boolean;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>('system');
  const [textScale, setTextScale] = useState(1);
  const [twoPane, setTwoPane] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load saved preferences on mount
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const prefs = JSON.parse(raw) as StoredPrefs;
          if (prefs.mode === 'light' || prefs.mode === 'dark' || prefs.mode === 'system') setMode(prefs.mode);
          if (typeof prefs.textScale === 'number' && prefs.textScale > 0) setTextScale(prefs.textScale);
          if (typeof prefs.twoPane === 'boolean') setTwoPane(prefs.twoPane);
        }
      } catch {
        // ignore — use defaults
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // Persist preferences when they change (after initial load)
  useEffect(() => {
    if (!loaded) return;
    const prefs: StoredPrefs = { mode, textScale, twoPane };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)).catch(() => {});
  }, [mode, textScale, twoPane, loaded]);

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
