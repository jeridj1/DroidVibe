import { useCallback, useMemo, useRef, useState } from 'react';

/**
 * Performance optimization utilities for DroidVibe mobile app.
 * Focus on reducing unnecessary re-renders and optimizing FlatList usage.
 */

/**
 * Stable callback wrapper that prevents recreation on every render.
 * Use for event handlers passed to memoized child components.
 */
export function useStableCallback<T extends (...args: any[]) => any>(fn: T): T {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback(((...args: any[]) => ref.current(...args)) as T, []);
}

/**
 * Memoized FlatList item separator — prevents re-render on data changes.
 */
export function useStableSeparator(separator: () => React.ReactElement) {
  return useMemo(() => separator(), [separator]);
}

/**
 * Key extractor for sketch lists. Stable reference, won't cause re-renders.
 */
export const sketchKeyExtractor = (item: { id: string }): string => item.id;

/**
 * Key extractor for device lists.
 */
export const deviceKeyExtractor = (item: { id: string }): string => item.id;

/**
 * Debounced state setter for search/filter inputs.
 * Returns [value, debouncedSetter, isPending].
 */
export function useDebouncedValue<T>(initial: T, delay: number = 300): [T, (v: T) => void, boolean] {
  const [value, setValueState] = useState<T>(initial);
  const [pending, setPending] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setValue = useCallback((v: T) => {
    setPending(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setValueState(v);
      setPending(false);
    }, delay);
  }, [delay]);

  return [value, setValue, pending];
}

/**
 * Returns a memoized getItemLayout for fixed-height FlatList items.
 * Enables O(1) scroll-to-index and avoids layout measurement passes.
 */
export function fixedItemLayout(itemHeight: number) {
  return useCallback(
    (_: any, index: number) => ({
      length: itemHeight,
      offset: itemHeight * index,
      index,
    }),
    [itemHeight]
  );
}
