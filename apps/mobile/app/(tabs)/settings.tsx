import React from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable, Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, type ThemeMode } from '@/src/theme/ThemeProvider';
import { Card, Badge, Row, SectionTitle, Button } from '@/src/components/ui';

export default function SettingsScreen() {
  const { palette, mode, setMode, textScale, setTextScale, twoPane, setTwoPane } = useTheme();
  const insets = useSafeAreaInsets();

  const themeOptions: ThemeMode[] = ['light', 'dark', 'system'];

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
          <Row>
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
          {[0.9, 1, 1.15, 1.3].map((s) => (
            <Pressable key={s} onPress={() => setTextScale(s)} style={[styles.seg, { backgroundColor: textScale === s ? palette.accent : palette.bgInset }]}>
              <Text style={{ color: textScale === s ? palette.textOnAccent : palette.textMuted, fontSize: 12, fontWeight: '700' }}>{s}×</Text>
            </Pressable>
          ))}
        </Row>

        <Row>
          <Text style={{ color: palette.text, fontWeight: '600' }}>Tablet / DeX two-pane</Text>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => setTwoPane(!twoPane)} style={[styles.toggle, { backgroundColor: twoPane ? palette.accent : palette.bgInset }]}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: twoPane ? palette.textOnAccent : palette.textMuted, alignSelf: twoPane ? 'flex-end' : 'flex-start' }} />
          </Pressable>
        </Row>
      </Card>

      <SectionTitle title="Account" subtitle="Cloud workspace sign-in" />
      <Card style={{ marginBottom: 12 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Text style={{ color: palette.text, fontWeight: '600' }}>Not signed in</Text>
            <Text style={{ color: palette.textMuted, fontSize: 12 }}>Sign in to sync sketches and builds</Text>
          </View>
          <Badge label="local only" tone="neutral" />
        </Row>
      </Card>

      <SectionTitle title="Help" subtitle="Onboarding and support" />
      <Card style={{ marginBottom: 12 }}>
        <Pressable onPress={resetOnboarding}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View>
              <Text style={{ color: palette.text, fontWeight: '600' }}>Reset onboarding</Text>
              <Text style={{ color: palette.textMuted, fontSize: 12 }}>Show the intro tutorial again</Text>
            </View>
            <Badge label="tap" tone="accent" />
          </Row>
        </Pressable>
      </Card>

      <SectionTitle title="About" />
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ color: palette.textMuted }}>Version</Text>
          <Text style={{ color: palette.text }}>DroidVibe 1.0.0</Text>
        </Row>
        <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
          <Text style={{ color: palette.textMuted }}>Stack</Text>
          <Text style={{ color: palette.text }}>Expo · Hono · Turso</Text>
        </Row>
        <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
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
  seg: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, marginLeft: 6 },
  toggle: { width: 52, height: 28, borderRadius: 14, padding: 3, flexDirection: 'row' },
});
