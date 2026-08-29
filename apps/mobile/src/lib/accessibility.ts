/**
 * Accessibility helper functions for DroidVibe.
 * Provides consistent A11y label generation, contrast checks,
 * and screen-reader announcement utilities.
 */
import { Platform } from 'react-native';

/**
 * Generate a TalkBack/VoiceOver-friendly label for a USB device card.
 */
export function deviceLabel(opts: {
  name?: string | null;
  manufacturer?: string | null;
  vendorId: string;
  productId: string;
  state?: string;
}): string {
  const parts: string[] = [];
  parts.push(opts.name ?? 'Unknown device');
  if (opts.manufacturer) parts.push(`by ${opts.manufacturer}`);
  if (opts.state) parts.push(`, ${opts.state}`);
  return parts.join(' ');
}

/**
 * Generate a hint for the compile button.
 */
export function compileHint(boardName: string): string {
  return `Compiles the current sketch for ${boardName}`;
}

/**
 * Generate a hint for the upload button.
 */
export function uploadHint(boardName: string): string {
  return `Uploads firmware to ${boardName} via USB`;
}

/**
 * Generate a serial monitor label with connection state.
 */
export function serialMonitorLabel(connected: boolean, deviceName?: string): string {
  if (connected && deviceName) {
    return `Serial monitor, connected to ${deviceName}`;
  }
  return 'Serial monitor, not connected';
}

/**
 * Generate a progress announcement for uploads.
 */
export function progressAnnouncement(stage: string, percent: number): string {
  return `${stage}: ${Math.round(percent)} percent`;
}

/**
 * Minimum contrast ratio for WCAG AA compliance (4.5:1 for normal text).
 */
export const MIN_CONTRAST_AA = 4.5;
export const MIN_CONTRAST_AAA = 7.0;

/**
 * Calculate relative luminance of a hex color.
 */
function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const linearize = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/**
 * Calculate contrast ratio between two hex colors.
 */
export function contrastRatio(fg: string, bg: string): number {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if a color pair meets WCAG AA contrast.
 */
export function meetsContrastAA(fg: string, bg: string): boolean {
  return contrastRatio(fg, bg) >= MIN_CONTRAST_AA;
}

/**
 * Check if a color pair meets WCAG AAA contrast.
 */
export function meetsContrastAAA(fg: string, bg: string): boolean {
  return contrastRatio(fg, bg) >= MIN_CONTRAST_AAA;
}

/**
 * Returns true if the platform supports haptic feedback.
 */
export function supportsHaptics(): boolean {
  return Platform.OS === 'android' || Platform.OS === 'ios';
}
