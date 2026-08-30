/**
 * DroidVibe design tokens — spacing, typography, radius, elevation.
 * Use these instead of ad-hoc magic numbers throughout the app.
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const typography = {
  caption: { fontSize: 11, lineHeight: 14 },
  body: { fontSize: 14, lineHeight: 20 },
  subtitle: { fontSize: 13, lineHeight: 18 },
  title: { fontSize: 18, lineHeight: 24, fontWeight: '800' as const },
  header: { fontSize: 26, fontWeight: '800' as const, lineHeight: 32 },
  mono: { fontSize: 12, lineHeight: 16, fontFamily: 'monospace' as const },
  monoLg: { fontSize: 14, lineHeight: 20, fontFamily: 'monospace' as const },
} as const;

export const elevation = {
  none: {} as Record<string, unknown>,
  low: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  high: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 5,
  },
} as const;
