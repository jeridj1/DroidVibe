import React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { palette } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.surfaceBorder }, style]}>
      {children}
    </View>
  );
}

export function Row({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
}) {
  const { palette } = useTheme();
  const bg =
    variant === 'primary'
      ? palette.accent
      : variant === 'danger'
        ? palette.danger
        : 'transparent';
  const color = variant === 'ghost' ? palette.accent : palette.textOnAccent;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, borderColor: variant === 'ghost' ? palette.surfaceBorder : 'transparent', opacity: pressed || disabled ? 0.6 : 1 },
      ]}
    >
      <Text style={{ color, fontWeight: '700', fontSize: 14 }}>{title}</Text>
    </Pressable>
  );
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'success' | 'warn' | 'danger' | 'accent' }) {
  const { palette } = useTheme();
  const map = {
    neutral: { bg: palette.bgInset, fg: palette.textMuted },
    success: { bg: palette.success + '22', fg: palette.success },
    warn: { bg: palette.warning + '22', fg: palette.warning },
    danger: { bg: palette.danger + '22', fg: palette.danger },
    accent: { bg: palette.accent + '22', fg: palette.accent },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: map.bg }]}>
      <Text style={{ color: map.fg, fontSize: 11, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  const { palette } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={{ color: palette.text, fontSize: 17, fontWeight: '800' }}>{title}</Text>
      {subtitle ? <Text style={{ color: palette.textMuted, fontSize: 12 }}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 14 },
  row: { flexDirection: 'row', alignItems: 'center' },
  btn: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', borderWidth: 1 },
  badge: { borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8, alignSelf: 'flex-start' },
  section: { marginBottom: 8 },
});
