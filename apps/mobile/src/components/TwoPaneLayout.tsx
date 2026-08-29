import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { useAdaptiveLayout } from '@/src/lib/useAdaptive';
import { useTheme } from '@/src/theme/ThemeProvider';

interface TwoPaneLayoutProps {
  /** Master (list) pane — rendered full-width on phones, left on tablets */
  master: React.ReactNode;
  /** Detail pane — rendered as overlay on phones, right on tablets */
  detail: React.ReactNode;
  /** Currently selected item ID for highlighting in master list */
  selectedId?: string | null;
}

/**
 * Adaptive master-detail layout.
 * - Phone: master fills the screen, detail is shown as a modal overlay
 * - Tablet / DeX (width >= 600dp): side-by-side split view
 * The split ratio adapts: 40/60 on medium tablets, 35/65 on large screens.
 */
export function TwoPaneLayout({ master, detail, selectedId }: TwoPaneLayoutProps) {
  const { shouldUseTwoPane, screenWidth } = useAdaptiveLayout();
  const { palette } = useTheme();

  if (shouldUseTwoPane) {
    // Compute split ratio based on screen width
    const masterRatio = screenWidth >= 1200 ? 0.35 : 0.4;
    const masterWidth = Math.floor(screenWidth * masterRatio);

    return (
      <View style={[styles.container, { backgroundColor: palette.bg }]}>
        <View style={[styles.masterPane, { width: masterWidth, borderRightWidth: 1, borderRightColor: palette.surfaceBorder }]}>
          {master}
        </View>
        <View style={[styles.detailPane, { flex: 1 }]}>
          {detail}
        </View>
      </View>
    );
  }

  // Phone layout: master only, detail shown as overlay
  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <View style={styles.phoneMaster}>
        {master}
      </View>
      {detail && (
        <View style={[styles.phoneDetailOverlay, { backgroundColor: palette.bg }]}>
          {detail}
        </View>
      )}
    </View>
  );
}

/**
 * Hook to manage two-pane selection state.
 * Returns selectedId, select function, and whether a detail is visible.
 */
export function useTwoPaneSelection<T extends { id: string }>() {
  const [selected, setSelected] = useState<T | null>(null);
  const { shouldUseTwoPane } = useAdaptiveLayout();

  const select = useCallback((item: T | null) => {
    setSelected(item);
  }, []);

  return {
    selected,
    select,
    selectedId: selected?.id ?? null,
    hasDetail: shouldUseTwoPane ? true : !!selected,
  };
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row' },
  masterPane: { flex: 0 },
  detailPane: { flex: 1 },
  phoneMaster: { flex: 1 },
  phoneDetailOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 10,
  },
});
