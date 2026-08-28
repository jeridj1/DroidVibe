import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme/ThemeProvider';
import { CodeEditor } from '@/src/components/CodeEditor';
import { Button, Badge, Row, SectionTitle, Card } from '@/src/components/ui';
import { api } from '@/src/lib/api';
import type { Diagnostic, UploadStage } from '@droidvibe/shared';

const DEFAULT_CODE = `// DroidVibe — Blink
void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(1000);
  digitalWrite(LED_BUILTIN, LOW);
  delay(1000);
}
`;

const BOARDS = [
  { fqbn: 'arduino:avr:uno', name: 'Arduino Uno' },
  { fqbn: 'arduino:avr:nano', name: 'Arduino Nano' },
  { fqbn: 'arduino:avr:mega', name: 'Arduino Mega 2560' },
  { fqbn: 'arduino:avr:leonardo', name: 'Arduino Leonardo' },
  { fqbn: 'rp2040:rp2040:rpipico', name: 'Raspberry Pi Pico' },
  { fqbn: 'esp32:esp32:esp32', name: 'ESP32' },
];

const STAGE_ORDER: UploadStage[] = ['detected', 'selected', 'connected', 'compiling', 'uploading', 'verified'];

export default function EditorScreen() {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState(DEFAULT_CODE);
  const [fqbn, setFqbn] = useState('arduino:avr:uno');
  const [boardOpen, setBoardOpen] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [buildStage, setBuildStage] = useState<string>('idle');
  const [progress, setProgress] = useState(0);
  const [ai, setAi] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const boardName = BOARDS.find((b) => b.fqbn === fqbn)?.name ?? fqbn;

  async function doCompile() {
    setCompiling(true); setBuildStage('compiling'); setError(null); setDiagnostics([]); setAi(null);
    try {
      const r = await api.compile({ name: 'Sketch', fqbn, files: [{ path: 'Sketch.ino', content: code }] }) as any;
      setDiagnostics(r.diagnostics ?? []);
      setBuildStage(r.ok ? 'compiled' : 'failed');
    } catch (e) {
      setError((e as Error).message); setBuildStage('failed');
    } finally {
      setCompiling(false);
    }
  }

  async function doExplain() {
    if (diagnostics.length === 0) return;
    setAi('Thinking…');
    try {
      const r = await api.ai.explainError({ diagnostics, code }) as any;
      setAi(r.explanation);
    } catch (e) {
      setAi('AI offline: ' + (e as Error).message);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => setBoardOpen((v) => !v)} style={styles.boardPicker}>
          <Text style={{ color: palette.textMuted, fontSize: 11 }}>Board</Text>
          <Row>
            <Text style={{ color: palette.text, fontWeight: '700' }}>{boardName}</Text>
            <Text style={{ color: palette.accent, marginLeft: 4 }}>{boardOpen ? '▲' : '▼'}</Text>
          </Row>
        </Pressable>
        <Row>
          <Button title="Verify" onPress={doCompile} disabled={compiling} variant="ghost" />
          <View style={{ width: 8 }} />
          <Button title="Upload" onPress={() => setBuildStage('detected')} disabled={compiling} />
        </Row>
      </View>

      {boardOpen && (
        <View style={styles.boardList}>
          {BOARDS.map((b) => (
            <Pressable key={b.fqbn} onPress={() => { setFqbn(b.fqbn); setBoardOpen(false); }} style={styles.boardItem}>
              <Text style={{ color: palette.text }}>{b.name}</Text>
              <Text style={{ color: palette.textMuted, fontSize: 11 }}>{b.fqbn}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={{ flex: 1, paddingHorizontal: 12 }}>
        <CodeEditor value={code} onChange={setCode} diagnostics={diagnostics} />
      </View>

      <View style={[styles.bottomPanel, { backgroundColor: palette.bgElevated, borderColor: palette.surfaceBorder }]}>
        <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
          <SectionTitle title="Output" subtitle={compiling ? 'Compiling…' : undefined} />
          {compiling && <ActivityIndicator color={palette.accent} />}
          {diagnostics.length > 0 && <Button title="Explain (AI)" onPress={doExplain} variant="ghost" />}
        </Row>

        <BuildStageBar stage={buildStage} progress={progress} palette={palette} />

        {error && <Text style={{ color: palette.danger, fontSize: 12 }}>{error}</Text>}

        <ScrollView style={{ maxHeight: 160 }}>
          {diagnostics.map((d, i) => (
            <Card key={i} style={{ marginBottom: 6, padding: 10 }}>
              <Row>
                <Badge label={d.severity} tone={d.severity === 'error' ? 'danger' : d.severity === 'warning' ? 'warn' : 'neutral'} />
                <Text style={{ color: palette.text, marginLeft: 8, fontSize: 13 }}>{d.file}:{d.line}:{d.column}</Text>
              </Row>
              <Text style={{ color: palette.text, fontSize: 12, marginTop: 4 }}>{d.message}</Text>
              {d.explanation ? <Text style={{ color: palette.accent, fontSize: 12, marginTop: 4 }}>{d.explanation}</Text> : null}
            </Card>
          ))}
          {ai && (
            <Card style={{ marginBottom: 6, padding: 10, borderLeftWidth: 3, borderLeftColor: palette.accent }}>
              <Text style={{ color: palette.textMuted, fontSize: 11, fontWeight: '700' }}>AI ASSISTANT</Text>
              <Text style={{ color: palette.text, fontSize: 13, marginTop: 4 }}>{ai}</Text>
            </Card>
          )}
          {diagnostics.length === 0 && !compiling && !ai && (
            <Text style={{ color: palette.textMuted, fontSize: 12 }}>No diagnostics. Tap Verify to compile.</Text>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

function BuildStageBar({ stage, progress, palette }: { stage: string; progress: number; palette: any }) {
  const stages = ['idle', 'compiling', 'uploading', 'verified', 'failed'];
  const colors: Record<string, string> = {
    idle: palette.textMuted, compiling: palette.accent, uploading: palette.accent,
    verified: palette.success, failed: palette.danger,
  };
  return (
    <View style={{ marginBottom: 8 }}>
      <Row>
        {stages.map((s, i) => {
          const active = stage === s;
          const reached = stages.indexOf(stage) >= i && stage !== 'failed';
          return (
            <View key={s} style={{ flex: 1, marginHorizontal: 2 }}>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: active || reached ? colors[stage] : palette.surfaceBorder }} />
              <Text style={{ color: active ? colors[stage] : palette.textMuted, fontSize: 9, marginTop: 2, textAlign: 'center' }}>{s}</Text>
            </View>
          );
        })}
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 8 },
  boardPicker: { paddingVertical: 4 },
  boardList: { paddingHorizontal: 12, paddingBottom: 8 },
  boardItem: { paddingVertical: 8, borderBottomWidth: 0.5, borderColor: 'rgba(150,150,150,0.2)' },
  bottomPanel: { borderTopWidth: 1, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 16 },
});
