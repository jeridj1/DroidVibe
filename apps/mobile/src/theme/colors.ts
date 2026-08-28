/**
 * DroidVibe color system — Arduino-authentic petrol/teal on white, with teal
 * retained as the accent in dark mode.
 */
export interface Palette {
  bg: string;
  bgElevated: string;
  bgInset: string;
  surface: string;
  surfaceBorder: string;
  text: string;
  textMuted: string;
  textOnAccent: string;
  accent: string;      // teal
  accentDim: string;
  petrol: string;      // deep petrol for headers/structural
  success: string;
  warning: string;
  danger: string;
  monoBg: string;      // editor / console background
  monoText: string;
  gutter: string;      // line-number / error gutter
  highlight: string;   // syntax keyword
  typeColor: string;   // syntax type
  stringColor: string; // syntax string
  commentColor: string; // syntax comment
  numberColor: string;  // syntax number
}

export const light: Palette = {
  bg: '#FFFFFF',
  bgElevated: '#F5F7F8',
  bgInset: '#EEF2F3',
  surface: '#FFFFFF',
  surfaceBorder: '#E2E8EA',
  text: '#11232B',
  textMuted: '#5A6B72',
  textOnAccent: '#FFFFFF',
  accent: '#00979D',
  accentDim: '#7FC8CC',
  petrol: '#0B3D43',
  success: '#1F9D55',
  warning: '#C77F00',
  danger: '#D64545',
  monoBg: '#0B2A2E',
  monoText: '#E6F2F3',
  gutter: '#103238',
  highlight: '#4FC4CC',
  typeColor: '#FFD479',
  stringColor: '#A8E6A1',
  commentColor: '#6E8A90',
  numberColor: '#FFAB7A',
};

export const dark: Palette = {
  bg: '#0A1518',
  bgElevated: '#0F2024',
  bgInset: '#081316',
  surface: '#10242A',
  surfaceBorder: '#1C3A41',
  text: '#E6F2F3',
  textMuted: '#8FA5AB',
  textOnAccent: '#06141A',
  accent: '#2BB7BE',
  accentDim: '#1E6669',
  petrol: '#0A2E33',
  success: '#3DD68C',
  warning: '#E0A33A',
  danger: '#FF6B6B',
  monoBg: '#06141A',
  monoText: '#E6F2F3',
  gutter: '#0A2026',
  highlight: '#4FC4CC',
  typeColor: '#FFD479',
  stringColor: '#A8E6A1',
  commentColor: '#5E7B82',
  numberColor: '#FFAB7A',
};
