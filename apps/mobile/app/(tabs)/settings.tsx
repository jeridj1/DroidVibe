import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable, Alert, Linking, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, type ThemeMode } from '@/src/theme/ThemeProvider';
import { Card, Badge, Row, SectionTitle, Button, Switch, Divider } from '@/src/components/ui';
import { isNativeUsbAvailable } from '@/src/lib/transport';
import { invalidateApiBaseCache } from '@/src/lib/api';
import { getApiUrl, setApiUrl, getAiModel, setAiModel, getAiKey, setAiKey, getAiProvider, setAiProvider, DEFAULT_AI_MODEL, DEFAULT_AI_PROVIDER } from '@/src/lib/appConfig';
import Constants from 'expo-constants';

const AI_PROVIDERS = ['mistral', 'openai', 'google'] as const;

const MODELS_BY_PROVIDER: Record<string, string[]> = {
  mistral: [
    'mistral-large-latest',
    'mistral-medium-latest',
    'mistral-small-latest',
    'open-mistral-nemo',
    'open-codestral-mistral',
  ],
  openai: [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-3.5-turbo',
  ],
  google: [
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-2.0-flash-exp',
  ],
};

export default function SettingsScreen() {
  const { palette, mode, setMode, textScale, setTextScale, twoPane, setTwoPane } = useTheme();
  const insets = useSafeAreaInsets();

  const themeOptions: ThemeMode[] = ['light', 'dark', 'system'];
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const [backendUrl, setBackendUrl] = useState('');
  const [aiProvider, setAiProviderState] = useState<string>(DEFAULT_AI_PROVIDER);
  const [aiModel, setAiModelState] = useState(DEFAULT_AI_MODEL);
  const [aiKey, setAiKeyState] = useState('');
  const [showAiKey, setShowAiKey] = useState(false);

  useEffect(() => {
    getApiUrl().then(setBackendUrl);
    getAiProvider().then(setAiProviderState);
    getAiModel().then(setAiModelState);
    getAiKey().then(setAiKeyState);
  }, []);

  async function persistBackendUrl(url: string) {
    setBackendUrl(url);
    await setApiUrl(url);
    invalidateApiBaseCache();
  }

  async function persistAiProvider(provider: string) {
    setAiProviderState(provider);
    await setAiProvider(provider);
    const models = MODELS_BY_PROVIDER[provider] ?? MODELS_BY_PROVIDER.mistral;
    const newModel = models[0];
    setAiModelState(newModel);
    await setAiModel(newModel);
  }

  async function persistAiModel(model: string) {
    setAiModelState(model);
    await setAiModel(model);
  }

  async function persistAiKey(key: string) {
    setAiKeyState(key);
    await setAiKey(key);
  }

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

  const aiModels = MODELS_BY_PROVIDER[aiProvider] ?? MODELS_BY_PROVIDER.mistral;

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
        <Divider />
        <Button title="Sign in" onPress={() => Alert.alert('Sign in', 'Coming soon!')} variant="ghost" size="sm" />
      </Card>

      <SectionTitle title="AI Provider" subtitle="Direct AI — no backend needed with API key" />
      <Card style={{ marginBottom: 12 }}>
        <View style={{ marginBottom: 12 }}>
          <Text style={{ color: palette.text, fontWeight: '600', marginBottom: 4 }}>Provider</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {AI_PROVIDERS.map((p) => (
              <Pressable
                key={p}
                onPress={() => persistAiProvider(p)}
                style={[styles.seg, { backgroundColor: aiProvider === p ? palette.accent : palette.bgInset }]}
              >
                <Text style={{ color: aiProvider === p ? palette.textOnAccent : palette.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' }}>{p}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={{ marginBottom: 12 }}>
          <Text style={{ color: palette.text, fontWeight: '600', marginBottom: 4 }}>Model</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {aiModels.map((m) => (
              <Pressable
                key={m}
                onPress={() => persistAiModel(m)}
                style={[styles.seg, { backgroundColor: aiModel === m ? palette.accent : palette.bgInset }]}
              >
                <Text style={{ color: aiModel === m ? palette.textOnAccent : palette.textMuted, fontSize: 11, fontWeight: '700' }}>{m}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View>
          <Text style={{ color: palette.text, fontWeight: '600', marginBottom: 4 }}>API Key</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={aiKey}
              onChangeText={persistAiKey}
              placeholder="enter key for direct AI access"
              placeholderTextColor={palette.textMuted}
              secureTextEntry={!showAiKey}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Button title={showAiKey ? 'Hide' : 'Show'} onPress={() => setShowAiKey((v) => !v)} variant="ghost" size="sm" />
          </View>
          <Text style={{ color: palette.textMuted, fontSize: 11, marginTop: 6 }}>
            {aiKey ? '✓ AI calls go directly from your phone — no backend needed.' : 'When set, AI features work without a backend server.'}
          </Text>
        </View>
      </Card>

      <SectionTitle title="Backend (optional)" subtitle="Only needed for compilation" />
      <Card style={{ marginBottom: 12 }}>
        <View>
          <Text style={{ color: palette.text, fontWeight: '600', marginBottom: 4 }}>Backend URL</Text>
          <TextInput
            style={styles.input}
            value={backendUrl}
            onChangeText={persistBackendUrl}
            placeholder="http://192.168.1.100:3001 (optional)"
            placeholderTextColor={palette.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={{ color: palette.textMuted, fontSize: 11, marginTop: 6 }}>
            Only needed for on-device compilation. AI features work without it when an API key is set above.
          </Text>
        </View>
      </Card>

      <SectionTitle title="Diagnostics" subtitle="System health checks" />
      <Card style={{ marginBottom: 12 }}>
        <Row justify="space-between" style={{ marginBottom: 8 }}>
          <Text style={{ color: palette.text, fontWeight: '600' }}>Native USB module</Text>
          <Badge label={isNativeUsbAvailable() ? 'available' : 'unavailable'} tone={isNativeUsbAvailable() ? 'success' : 'warn'} />
        </Row>
        <Row justify="space-between" style={{ marginBottom: 8 }}>
          <Text style={{ color: palette.text, fontWeight: '600' }}>AI mode</Text>
          <Text style={{ color: aiKey ? palette.text : palette.textMuted, fontSize: 13 }}>{aiKey ? 'direct (phone)' : 'backend (if running)'}</Text>
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
  input: {
    borderWidth: 1,
    borderColor: 'rgba(150,150,150,0.3)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
});