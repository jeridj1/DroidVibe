import React from 'react';
import { Pressable, StyleSheet, Text, View, ActivityIndicator, TextInput, type ViewStyle } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing, radius, elevation } from '@/src/theme/tokens';

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------
export function Card({
  children,
  style,
  accessibilityLabel,
  onPress,
  elevated,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  accessibilityLabel?: string;
  onPress?: () => void;
  elevated?: boolean;
}) {
  const { palette } = useTheme();
  const cardStyle = [
    styles.card,
    { backgroundColor: palette.surface, borderColor: palette.surfaceBorder },
    elevated ? elevation.medium : null,
    style,
  ];
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [cardStyle, { opacity: pressed ? 0.92 : 1 }]}
        accessible={!!accessibilityLabel}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="summary"
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View
      style={cardStyle}
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="summary"
    >
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Row — flexbox row with optional gap, align, justify
// ---------------------------------------------------------------------------
export function Row({
  children,
  style,
  gap,
  align,
  justify,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  gap?: number;
  align?: 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline';
  justify?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly';
}) {
  return (
    <View
      style={[
        styles.row,
        align ? { alignItems: align } : null,
        justify ? { justifyContent: justify } : null,
        gap != null ? ({ gap } as ViewStyle) : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Button — primary / ghost / danger with loading, icon, size, fullWidth
// ---------------------------------------------------------------------------
type ButtonSize = 'sm' | 'md' | 'lg';

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  size = 'md',
  fullWidth,
  accessibilityHint,
  testID,
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  size?: ButtonSize;
  fullWidth?: boolean;
  accessibilityHint?: string;
  testID?: string;
}) {
  const { palette } = useTheme();
  const bg =
    variant === 'primary'
      ? palette.accent
      : variant === 'danger'
        ? palette.danger
        : 'transparent';
  const color = variant === 'ghost' ? palette.accent : palette.textOnAccent;
  const sizeStyles = {
    sm: { paddingVertical: 8, paddingHorizontal: 12, fontSize: 13 },
    md: { paddingVertical: 12, paddingHorizontal: 16, fontSize: 14 },
    lg: { paddingVertical: 16, paddingHorizontal: 24, fontSize: 16 },
  }[size];

  return (
    <Pressable
      onPress={loading || disabled ? undefined : onPress}
      disabled={disabled || loading}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={disabled ? { disabled: true } : loading ? { busy: true } : undefined}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: bg,
          borderColor: variant === 'ghost' ? palette.surfaceBorder : 'transparent',
          opacity: pressed || disabled ? 0.6 : 1,
          paddingVertical: sizeStyles.paddingVertical,
          paddingHorizontal: sizeStyles.paddingHorizontal,
          ...(fullWidth ? { width: '100%' } : {}),
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color} size="small" />
      ) : (
        <Text style={{ color, fontWeight: '700', fontSize: sizeStyles.fontSize }} allowFontScaling>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Badge — pill with tone variants, optional dot variant
// ---------------------------------------------------------------------------
export function Badge({
  label,
  tone = 'neutral',
  dot,
}: {
  label?: string;
  tone?: 'neutral' | 'success' | 'warn' | 'danger' | 'accent';
  dot?: boolean;
}) {
  const { palette } = useTheme();
  const map = {
    neutral: { bg: palette.bgInset, fg: palette.textMuted },
    success: { bg: palette.success + '22', fg: palette.success },
    warn: { bg: palette.warning + '22', fg: palette.warning },
    danger: { bg: palette.danger + '22', fg: palette.danger },
    accent: { bg: palette.accent + '22', fg: palette.accent },
  }[tone];
  if (dot) {
    return (
      <View
        style={[styles.badge, { backgroundColor: map.bg }]}
        accessible
        accessibilityLabel={label ?? (tone + ' indicator')}
        accessibilityRole="text"
      >
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: map.fg, marginRight: label ? 4 : 0 }} />
        {label ? <Text style={{ color: map.fg, fontSize: 11, fontWeight: '700' }} allowFontScaling>{label}</Text> : null}
      </View>
    );
  }
  return (
    <View
      style={[styles.badge, { backgroundColor: map.bg }]}
      accessible
      accessibilityLabel={label ?? ''}
      accessibilityRole="text"
    >
      <Text style={{ color: map.fg, fontSize: 11, fontWeight: '700' }} allowFontScaling>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// SectionTitle — with optional action slot
// ---------------------------------------------------------------------------
export function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  const { palette } = useTheme();
  return (
    <View
      style={[styles.section, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }]}
      accessible
      accessibilityLabel={subtitle ? title + ': ' + subtitle : title}
      accessibilityRole="header"
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: palette.text, fontSize: 17, fontWeight: '800' }} allowFontScaling>{title}</Text>
        {subtitle ? <Text style={{ color: palette.textMuted, fontSize: 12 }} allowFontScaling>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

// ---------------------------------------------------------------------------
// LoadingIndicator
// ---------------------------------------------------------------------------
export function LoadingIndicator({ label, style }: { label?: string; style?: ViewStyle }) {
  const { palette } = useTheme();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: spacing.md }, style]}>
      <ActivityIndicator color={palette.accent} size="small" />
      {label ? <Text style={{ color: palette.textMuted, fontSize: 13, marginLeft: 8 }} allowFontScaling>{label}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------
export function EmptyState({
  icon,
  title,
  subtitle,
  action,
  style,
}: {
  icon?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  style?: ViewStyle;
}) {
  const { palette } = useTheme();
  return (
    <View style={[{ alignItems: 'center', padding: spacing.xl }, style]}>
      {icon ? <Text style={{ fontSize: 48, marginBottom: spacing.md }}>{icon}</Text> : null}
      <Text style={{ color: palette.text, fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 4 }} allowFontScaling>
        {title}
      </Text>
      {subtitle ? (
        <Text style={{ color: palette.textMuted, fontSize: 13, textAlign: 'center', marginBottom: spacing.md }} allowFontScaling>
          {subtitle}
        </Text>
      ) : null}
      {action}
    </View>
  );
}

// ---------------------------------------------------------------------------
// ErrorState
// ---------------------------------------------------------------------------
export function ErrorState({
  message,
  suggestion,
  onRetry,
  retryLabel = 'Retry',
  style,
}: {
  message: string;
  suggestion?: string;
  onRetry?: () => void;
  retryLabel?: string;
  style?: ViewStyle;
}) {
  const { palette } = useTheme();
  return (
    <View style={[{ alignItems: 'center', padding: spacing.xl }, style]}>
      <Text style={{ fontSize: 36, marginBottom: spacing.sm }}>⚠️</Text>
      <Text style={{ color: palette.danger, fontSize: 15, fontWeight: '700', textAlign: 'center', marginBottom: 4 }} allowFontScaling>
        {message}
      </Text>
      {suggestion ? (
        <Text style={{ color: palette.textMuted, fontSize: 13, textAlign: 'center', marginBottom: spacing.md }} allowFontScaling>
          {suggestion}
        </Text>
      ) : null}
      {onRetry ? <Button title={retryLabel} onPress={onRetry} variant="ghost" /> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// SuccessState
// ---------------------------------------------------------------------------
export function SuccessState({
  message,
  detail,
  action,
  style,
}: {
  message: string;
  detail?: string;
  action?: React.ReactNode;
  style?: ViewStyle;
}) {
  const { palette } = useTheme();
  return (
    <View style={[{ alignItems: 'center', padding: spacing.xl }, style]}>
      <Text style={{ fontSize: 36, marginBottom: spacing.sm }}>✓</Text>
      <Text style={{ color: palette.success, fontSize: 15, fontWeight: '700', textAlign: 'center', marginBottom:4 }} allowFontScaling>
        {message}
      </Text>
      {detail ? (
        <Text style={{ color: palette.textMuted, fontSize: 13, textAlign: 'center', marginBottom: spacing.md }} allowFontScaling>
          {detail}
        </Text>
      ) : null}
      {action}
    </View>
   );
}

// ---------------------------------------------------------------------------
// Switch — reusable toggle
// ---------------------------------------------------------------------------
export function Switch({
  value,
  onValueChange,
  accessibilityLabel,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  accessibilityLabel?: string;
}) {
  const { palette } = useTheme();
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value }}
      style={[
        styles.toggle,
        { backgroundColor: value ? palette.accent : palette.bgInset },
      ]}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: value ? palette.textOnAccent : palette.textMuted,
          alignSelf: value ? 'flex-end' : 'flex-start',
        }}
      />
    </Pressable>
  );
}

// ----------------------------------------------------------------------------
// IconButton
// ----------------------------------------------------------------------------
export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  disabled,
  variant = 'ghost',
}: {
  icon: string;
  onPress: () => void;
  accessibilityLabel: string;
  disabled?: boolean;
  variant?: 'ghost' | 'primary';
}) {
  const { palette } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={disabled ? { disabled: true } : undefined}
      style={({ pressed }) => [
        styles.iconBtn,
        {
          backgroundColor: variant === 'primary' ? palette.accent : 'transparent',
          opacity: pressed || disabled ? 0.6 : 1,
        },
      ]}
    >
      <Text style={{ color: variant === 'primary' ? palette.textOnAccent : palette.accent, fontSize: 18, fontWeight: '600' }}>
        {icon}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// StyledTextInput — bordered input with label and placeholder
// ---------------------------------------------------------------------------
export function StyledTextInput({
  value,
  onChangeText,
  placeholder,
  label,
  multiline,
  secureTextEntry,
  accessibilityLabel,
  style,
  onSubmitEditing,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  label?: string;
  multiline?: boolean;
  secureTextEntry?: boolean;
  accessibilityLabel?: string;
  style?: ViewStyle;
  onSubmitEditing?: () => void;
}) {
  const { palette } = useTheme();
  return (
    <View style={{ marginBottom: spacing.sm }}>
      {label ? (
        <Text style={{ color: palette.textMuted, fontSize: 12, fontWeight: '600', marginBottom: 4 }} allowFontScaling>
          {label}
        </Text>
      ) : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.textMuted}
        multiline={multiline}
        secureTextEntry={secureTextEntry}
        accessibilityLabel={accessibilityLabel ?? label}
        onSubmitEditing={onSubmitEditing}
        style={[
          styles.textInput,
          { color: palette.text, borderColor: palette.surfaceBorder, backgroundColor: palette.surface },
          style,
        ]}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Divider
// ---------------------------------------------------------------------------
export function Divider({ style }: { style?: ViewStyle }) {
  const { palette } = useTheme();
  return <View style={[{ height: 1, backgroundColor: palette.surfaceBorder, marginVertical: spacing.sm }, style]} />;
}

// ---------------------------------------------------------------------------
// HardwareStatusBadge — visual pill for device lifecycle states
// ---------------------------------------------------------------------------
export function HardwareStatusBadge({ state }: { state: string }) {
  const toneMap: Record<string, 'neutral' | 'success' | 'warn' | 'danger' | 'accent'> = {
    detected: 'neutral',
    'permission-required': 'warn',
    selected: 'accent',
    connected: 'accent',
    busy: 'accent',
    verified: 'success',
    unknown: 'neutral',
    failed: 'danger',
    disconnected: 'danger',
  };
  const tone = toneMap[state] ?? 'neutral';
  const labels: Record<string, string> = {
    detected: 'Detected',
    'permission-required': 'Permission needed',
    selected: 'Selected',
    connected: 'Connected',
    busy: 'Busy',
    verified: 'Verified',
    unknown: 'Unknown',
    failed: 'Failed',
    disconnected: 'Disconnected',
  };
  return <Badge label={labels[state] ?? state} tone={tone} dot />;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center' },
  btn: { borderRadius: radius.md, alignItems: 'center', borderWidth: 1 },
  badge: { borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: 8, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center' },
  section: { marginBottom: spacing.sm },
  toggle: { width: 52, height: 28, borderRadius: 14, padding: 3, flexDirection: 'row' },
  iconBtn: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  textInput: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
});
