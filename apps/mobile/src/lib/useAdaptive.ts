import { useState, useEffect } from 'react';
import { Dimensions, Platform } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';

/**
 * Adaptive layout hook for tablet, DeX, and large-screen support.
 * Returns whether to use a two-pane (master-detail) layout based on
 * screen width and the user's preference from Settings.
 */
export function useAdaptiveLayout() {
  const { twoPane } = useTheme();
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
    });
    return () => sub?.remove();
  }, []);

  // Two-pane is beneficial on screens >= 600dp (Android tablet breakpoint)
  // or Samsung DeX (width typically >= 940dp in DeX mode)
  const isLargeScreen = screenWidth >= 600;
  const shouldUseTwoPane = twoPane && isLargeScreen;
  const isTablet = screenWidth >= 600;
  const isDeX = screenWidth >= 940 && Platform.OS === 'android';

  return {
    screenWidth,
    shouldUseTwoPane,
    isTablet,
    isDeX,
    isLargeScreen,
  };
}

/**
 * Returns a responsive column count for FlatList/Grid rendering.
 * 1 column on phones, 2 on tablets, 3+ on very large screens.
 */
export function useResponsiveColumns(minItemWidth: number = 180) {
  const [columns, setColumns] = useState(1);

  useEffect(() => {
    const calc = () => {
      const width = Dimensions.get('window').width;
      setColumns(Math.max(1, Math.floor(width / minItemWidth)));
    };
    calc();
    const sub = Dimensions.addEventListener('change', calc);
    return () => sub?.remove();
  }, [minItemWidth]);

  return columns;
}

/**
 * S Pen / stylus detection helper.
 * Returns true when the device supports S Pen input.
 * On Android, this can be checked via the AndroidManifest or at runtime.
 */
export function isStylusSupported(): boolean {
  // Expo SDK 52 doesn't expose stylus detection directly.
  // Samsung S Pen devices report pointerType === 'stylus' in touch events.
  // This is a heuristic: most tablets and all Galaxy Note/Tab S devices support S Pen.
  if (Platform.OS !== 'android') return false;
  return Dimensions.get('window').width >= 600;
}
