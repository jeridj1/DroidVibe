/**
 * Global error boundary — catches render crashes anywhere in the app,
 * shows a recoverable error screen, and logs the error for debugging.
 * Never silently swallows errors; always surfaces them to the user.
 */
import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';

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
    // Log to console — in production this could send to a crash reporting service
    console.error('[DroidVibe] Uncaught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { error, errorInfo } = this.state;

    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.icon}>⚠️</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            DroidVibe encountered an unexpected error. Your sketches and settings
            are safe. Try resetting the app — if the error persists, restart.
          </Text>
          <Text style={styles.errorName}>{error?.name ?? 'Error'}</Text>
          <Text style={styles.errorText}>{error?.message ?? 'Unknown error'}</Text>
          {errorInfo?.componentStack ? (
            <Text style={styles.stack}>{errorInfo.componentStack.slice(0, 500)}</Text>
          ) : null}
          <Pressable style={styles.button} onPress={this.handleReset}>
            <Text style={styles.buttonText}>Try Again</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A1518',
  },
  content: {
    padding: 24,
    paddingTop: 60,
    alignItems: 'center',
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#E6F2F3',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#8FA5AB',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  errorName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF6B6B',
    marginBottom: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#8FA5AB',
    marginBottom: 8,
    textAlign: 'center',
  },
  stack: {
    fontSize: 10,
    color: '#5E7B82',
    fontFamily: 'monospace',
    marginBottom: 24,
    lineHeight: 14,
  },
  button: {
    backgroundColor: '#00979D',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
});
