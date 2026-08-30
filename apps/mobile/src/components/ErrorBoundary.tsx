/**
 * Global error boundary — catches render crashes anywhere in the app,
 * shows a recoverable error screen, and logs the error for debugging.
 * Never silently swallows errors; always surfaces them to the user.
 */
import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useTheme, type Palette } from '@/src/theme/ThemeProvider';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('[DroidVibe] Uncaught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { error, errorInfo } = this.state;

    return <ErrorScreen error={error} errorInfo={errorInfo} onReset={this.handleReset} />;
  }
}

function ErrorScreen({ error, errorInfo, onReset }: {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  onReset: () => void;
}) {
  const { palette } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.icon}>{"\u26A0\uFE0F"}</Text>
        <Text style={[styles.title, { color: palette.text }]}>Something went wrong</Text>
        <Text style={[styles.message, { color: palette.textMuted }]}>
          DroidVibe encountered an unexpected error. Your sketches and settings
          are safe. Try resetting the app — if the error persists, restart.
        </Text>
        <Text style={[styles.errorName, { color: palette.danger }]}>{error?.name ?? 'Error'}</Text>
        <Text style={[styles.errorText, { color: palette.textMuted }]}>{error?.message ?? 'Unknown error'}</Text>
        {errorInfo?.componentStack ? (
          <Text style={[styles.stack, { color: palette.textMuted }]}>{errorInfo.componentStack.slice(0, 500)}</Text>
        ) : null}
        <Pressable style={[styles.button, { backgroundColor: palette.accent }]} onPress={onReset}>
          <Text style={[styles.buttonText, { color: palette.textOnAccent }]}>Try Again</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingTop: 60, alignItems: 'center' },
  icon: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  message: { fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  errorName: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  errorText: { fontSize: 12, marginBottom: 8, textAlign: 'center' },
  stack: { fontSize: 10, fontFamily: 'monospace', marginBottom: 24, lineHeight: 14 },
  button: { borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32 },
  buttonText: { fontWeight: '700', fontSize: 16 },
});