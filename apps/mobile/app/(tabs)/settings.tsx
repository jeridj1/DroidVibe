import React from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable, Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, type ThemeMode } from '@/src/theme/ThemeProvider';
import { Card, Badge, Row, SectionTitle, Button, Switch, Divider } from '@/src/components/ui';
import { isNativeUsbAvailable } from '@/src/lib/transport';
import Constants from 'expo-constants';

export default function SettingsScreen() {
  const { palette, mode, setMode, textScale, setTextScale, twoPane, setTwoPane } = useTheme();
  const insets = useSafeAreaInsets();

  const themeOptions: ThemeMode[] = ['light', 'dark', 'system'];
  const version = Constants.expoConfig?.version ?? '1.0.0';

  function resetOnboarding() {
    Alert.alert(
      'Reset onboarding',
      'Show the intro tutorial again on next launch?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          onPress: () => AsyncStorage.removeItem('@droidvibe/onboarding_seen'),
        },
      ]
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: insets.top + 8, paddingBottom: 32 }}
      style={{ backgroundColor: palette.bg }}
    >
      <Text style={[styles.title, { color: palette.text }]}>Settings</Text>

      <SectionTitle title="Appearance" subtitle="Theme, text scale, layout" />
      <Card style={{ marginBottom: 12 }}>
        <Row style={{ marginBottom: 12 }}>
          <Text style={{ color: palette.text, fontWeight: '600' }}>Theme</Text>
          <View style={{ flex: 1 }} />
          <Row gap={6}>
            {themeOptions.map((t) => (
              <Pressable
                key={t}
                onPress={() => setMode(t)}
                style={[styles.seg, { backgroundColor: mode === t ? palette.accent : palette.bgInset }]}
              >
                <Text style={{ color: mode === t ? palette.textOnAccent : palette.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' }}>{t}</Text>
              </Pressable>
            ))}
          </Row>
        </Row>

        <Row style={{ marginBottom: 12 }}>
          <Text style={{ color: palette.text, fontWeight: '600' }}>Text scale</Text>
          <View style={{ flex: 1 }} />
          <Row gap={6}>
            {[0.9, 1, 1.15, 1.3].map((s) => (
              <Pressable key={s} onPress={() => setTextScale(s)} style={[styles.seg, { backgroundColor: textScale === s ? palette.accent : palette.bgInset }]}>
                <Text style={{ color: textScale === s ? palette.textOnAccent : palette.textMuted, fontSize: 12, fontWeight: '700' }}>{s}x</Text>
              </Pressable>
            ))}
          </Row>
        </Row>

        <Row>
          <Text style={{ color: palette.text, fontWeight: '600' }}>Tablet / DeX two-pane</Text>
          <View style={{ flex: 1 }} />
          <Switch value={twoPane} onValueChange={setTwoPane} accessibilityLabel="Toggle two-pane layout" />
        </Row>
      </Card>

      <SectionTitle title="Account" subtitle="Cloud workspace sign-in" />
      <Card style={{ marginBottom: 12 }}>
        <Row justify="space-between">
          <View>
            <Text style={{ color: palette.text, fontWeight: '600' }}>Not signed in</Text>
            <Text style={{ color: palette.textMuted, fontSize: 12 }}>Sign in to sync sketches and builds</Text>
          </View>
          <Badge label="local only" tone="neutral" />
        </Row>
      </Card>

      <SectionTitle title="Diagnostics" subtitle="System health checks" />
      <Card style={{ marginBottom: 12 }}>
        <Row justify="space-between" style={{ marginBottom: 8 }}>
          <Text style={{ color: palette.text, fontWeight: '600' }}>Native USB module</Text>
          <Badge label={isNativeUsbAvailable() ? 'available' : 'unavailable'} tone={isNativeUsbAvailable() ? 'success' : 'warn'
} />
        </Row>
        <Row justify="space-between" style={{ marginBottom: 8 }}>
          <Text style={{ color: palette.text, fontWeight: '600' }}>App version</Text>
          <Text style={{ color: palette.textMuted, fontSize: 13 }}>{version}</Text>
        </Row>
        <Row justify="space-between">
          <Text style={{ color: palette.text, fontWeight: '600' }}>Platform</Text>
          <Text style={{ color: palette.textMuted, fontSize: 13 }}>{Constants.platform?.android ? 'Android' : 'Other'} {Constants.platform?.android?.version ?? ''}</Text>
        </Row>
      </Card>

      <SectionTitle title="Support" subtitle="Help and resources" />
      <Card style={{ marginBottom: 12 }}>
        <Pressable onPress={resetOnboarding}>
          <Row justify="space-between">
            <View>
              <Text style={{ color: palette.text, fontWeight: '600' }}>Reset onboarding</Text>
              <Text style={{ color: palette.textMuted, fontSize: 12 }}>Show the intro tutorial again</Text>
            </View>
            <Badge label="tap" tone="accent" />
          </Row>
        </Pressable>
        <Divider />
        <Pressable onPress={() => Linking.openURL('https://github.com/jeridj1/DroidVibe')}>
          <Row justify="space-between">
            <View>
              <Text style={{ color: palette.text, fontWeight: '600' }}>GitHub repository</Text>
              <Text style={{ color: palette.textMuted, fontSize: 12 }}>Source code, issues, docs</Text>
            </View>
            <Badge label="open" tone="accent" />
          </Row>
        </Pressable>
      </Card>

      <SectionTitle title="About" />
      <Card>
        <Row justify="space-between">
          <Text style={{ color: palette.textMuted }}>Version</Text>
          <Text style={{ color: palette.text }}>DroidVibe {version}</Text>
        </Row>
        <Row justify="space-between" style={{ marginTop: 8 }}>
          <Text style={{ color: palette.textMuted }}>Stack</Text>
          <Text style={{ color: palette.text }}>Expo · Hono · Turso</Text>
        </Row>
        <Row justify="space-between" style={{ marginTop: 8 }}>
          <Text style={{ color: palette.textMuted }}>USB protocols</Text>
          <Text style={{ color: palette.text }}>STK500 · AVR109 · ESP · PICOBOOT</Text>
        </Row>
      </Card>

      <Text style={{ color: palette.textMuted, fontSize: 11, marginTop: 16, textAlign: 'center' }}>
        DroidVibe never reports hardware success unless actually confirmed.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', marginBottom: 12 },
  seg: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10 },
});
