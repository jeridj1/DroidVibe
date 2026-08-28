import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>('system');
  const [textScale, setTextScale] = useState(1);
  const [twoPane, setTwoPane] = useState(false);

  useEffect(() => {
    // Persist + restore would use AsyncStorage in a full build.
    void STORAGE_KEY;
  }, [mode]);

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
