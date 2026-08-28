import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  ActivityIndicator,
  Modal,
  FlatList,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme/ThemeProvider';
import { CodeEditor } from '@/src/components/CodeEditor';
import { Button, Badge, Row, SectionTitle, Card } from '@/src/components/ui';
import { api } from '@/src/lib/api';
import { listDevices, upload, flashUf2, isNativeUsbAvailable } from '@/src/lib/transport';
import { identifyBoard } from '@droidvibe/shared';
import { consumePendingSketch } from '@/src/lib/sketchBridge';
import type { Diagnostic, UsbDevice, UploadProtocol, UploadProgress } from '@droidvibe/shared';

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
  const [firmware, setFirmware] = useState<string | null>(null);
  const [showDevicePicker, setShowDevicePicker] = useState(false);
  const [devices, setDevices] = useState<UsbDevice[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [sketchName, setSketchName] = useState('Sketch');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiGen, setShowAiGen] = useState(false);
  const nativeUsb = isNativeUsbAvailable();

  // Load pending sketch from sketchBridge on mount
  useEffect(() => {
    const pending = consumePendingSketch();
    if (pending) {
      setCode(pending.code);
      setSketchName(pending.name);
    }
  }, []);

  const boardName = BOARDS.find((b) => b.fqbn === fqbn)?.name ?? fqbn;

  async function doCompile(): Promise<string | null> {
    setCompiling(true);
    setBuildStage('compiling');
    setError(null);
    setDiagnostics([]);
    setAi(null);
    setFirmware(null);
    try {
      const r = (await api.compile({
        name: sketchName,
        fqbn,
        files: [{ path: sketchName.replace(/[^A-Za-z0-9_]/g, '_') + '.ino', content: code }],
      })) as any;
      setDiagnostics(r.diagnostics ?? []);
      if (r.ok) {
        const fw = r.firmware ?? null;
        setFirmware(fw);
        setBuildStage(fw ? 'idle' : 'failed');
        if (!fw) {
          setError('Compilation succeeded but no firmware artifact was returned.');
          return null;
        }
        return fw;
      } else {
        setBuildStage('failed');
        return null;
      }
    } catch (e) {
      setError((e as Error).message);
      setBuildStage('failed');
      return null;
    } finally {
      setCompiling(false);
    }
  }

  async function startUpload() {
    if (!nativeUsb) {
      setError('Native USB unavailable. Build a DroidVibe dev/production APK to access USB hardware.');
      return;
    }
    setError(null);
    setUploadMsg(null);
    // Ensure we have firmware
    let fw = firmware;
    if (!fw) {
      fw = await doCompile();
    }
    if (!fw) return;

    // Open device picker
    const devs = await listDevices();
    setDevices(devs);
    if (devs.length === 0) {
      setError('No USB devices detected. Connect a board via USB-OTG.');
      setBuildStage('failed');
      return;
    }
    setShowDevicePicker(true);
  }

  async function doUploadToDevice(device: UsbDevice) {
    setShowDevicePicker(false);
    let fw = firmware;
    if (!fw) {
      fw = await doCompile();
      if (!fw) return;
    }

    setUploading(true);
    setBuildStage('connecting');
    setUploadMsg(null);
    setProgress(0);

    try {
      const id = identifyBoard(device.vendorId, device.productId);
      const protocol: UploadProtocol = device.bootsel
        ? 'picoboot'
        : id?.protocol ?? 'stk500v1';

      let result;
      if (device.bootsel || protocol === 'picoboot') {
        setBuildStage('uploading');
        setUploadMsg('Flashing via PICOBOOT…');
        result = await flashUf2(device.id, fw, true);
      } else {
        setBuildStage('uploading');
        setUploadMsg('Uploading via ' + protocol + '…');
        result = await upload(
          {
            device: { id: device.id, vendorId: device.vendorId, productId: device.productId },
            protocol,
            firmware: fw,
            filename: sketchName.replace(/[^A-Za-z0-9_]/g, '_') + '.ino',
            baudRate: 115200,
            verify: true,
          },
          (p: UploadProgress) => {
            setProgress(p.progress);
            if (p.message) setUploadMsg(p.message);
          },
        );
      }

      if (result.ok && result.verified) {
        setBuildStage('verified');
        setUploadMsg('Upload verified successfully.');
        setProgress(1);
      } else if (result.ok) {
        setBuildStage('verified');
        setUploadMsg('Upload completed. Verification not confirmed.');
        setProgress(1);
      } else {
        setBuildStage('failed');
        setUploadMsg(result.message);
      }
    } catch (e) {
      setBuildStage('failed');
      setUploadMsg((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function doExplain() {
    if (diagnostics.length === 0) return;
    setAi('Thinking…');
    try {
      const r = (await api.ai.explainError({ diagnostics, code })) as any;
      setAi(r.explanation);
    } catch (e) {
      setAi('AI offline: ' + (e as Error).message);
    }
  }

  async function doGenerate() {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiResult(null);
    setAi(null);
    try {
      const r = (await api.ai.generate({ prompt: aiPrompt, boardFqbn: fqbn })) as any;
      setAiResult(r.code ?? r.sketch ?? r.output ?? null);
    } catch (e) {
      setAiResult(null);
      setAi('AI offline: ' + (e as Error).message);
    } finally {
      setAiLoading(false);
    }
  }

  async function doFix() {
    setAiLoading(true);
    setAiResult(null);
    setAi(null);
    try {
      const r = (await api.ai.fix({ code, diagnostics })) as any;
      setAiResult(r.code ?? r.fixedCode ?? null);
    } catch (e) {
      setAiResult(null);
      setAi('AI offline: ' + (e as Error).message);
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => setBoardOpen((v) => !v)} style={styles.boardPicker}>
          <Text style={{ color: palette.textMuted, fontSize: 11 }}>Board</Text>
          <Row>
            <Text style={{ color: palette.text, fontWeight: '700' }}>{boardName}</Text>
            <Text style={{ color: palette.accent, marginLeft: 4 }}>{boardOpen ? '\u25B2' : '\u25BC'}</Text>
          </Row>
        </Pressable>
        <Row>
          <Button title="Verify" onPress={() => doCompile()} disabled={compiling || uploading} variant="ghost" />
          <View style={{ width: 8 }} />
          <Button title="Upload" onPress={startUpload} disabled={compiling || uploading} />
        </Row>
      </View>

      {!nativeUsb && (
        <View style={[styles.banner, { backgroundColor: palette.warning + '18', borderColor: palette.warning }]}>
          <Text style={{ color: palette.warning, fontSize: 12, fontWeight: '600' }}>
            Expo Go detected — native USB unavailable. Build a dev/production APK for hardware access.
          </Text>
        </View>
      )}

      {boardOpen && (
        <View style={styles.boardList}>
          {BOARDS.map((b) => (
            <Pressable
              key={b.fqbn}
              onPress={() => { setFqbn(b.fqbn); setBoardOpen(false); }}
              style={styles.boardItem}
            >
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
          <SectionTitle title="Output" subtitle={compiling ? 'Compiling…' : uploading ? 'Uploading…' : undefined} />
          {(compiling || uploading) && <ActivityIndicator color={palette.accent} />}
          {diagnostics.length > 0 && <Button title="Explain (AI)" onPress={doExplain} variant="ghost" />}
          {diagnostics.length > 0 && <Button title="Fix (AI)" onPress={doFix} disabled={aiLoading} variant="ghost" />}
          <Button title="Generate" onPress={() => setShowAiGen((v) => !v)} variant="ghost" />
        </Row>

        <BuildStageBar stage={buildStage} progress={progress} palette={palette} />

        {uploadMsg && (
          <Text style={{ color: palette.text, fontSize: 12, marginBottom: 4 }}>{uploadMsg}</Text>
        )}
        {error && <Text style={{ color: palette.danger, fontSize: 12, marginBottom: 4 }}>{error}</Text>}

        <ScrollView style={{ maxHeight: 160 }}>
          {diagnostics.map((d, i) => (
            <Card key={i} style={{ marginBottom: 6, padding: 10 }}>
              <Row>
                <Badge
                  label={d.severity}
                  tone={d.severity === 'error' ? 'danger' : d.severity === 'warning' ? 'warn' : 'neutral'}
                />
                <Text style={{ color: palette.text, marginLeft: 8, fontSize: 13 }}>
                  {d.file}:{d.line}:{d.column}
                </Text>
              </Row>
              <Text style={{ color: palette.text, fontSize: 12, marginTop: 4 }}>{d.message}</Text>
              {d.explanation ? (
                <Text style={{ color: palette.accent, fontSize: 12, marginTop: 4 }}>{d.explanation}</Text>
              ) : null}
            </Card>
          ))}
          {ai && (
            <Card style={{ marginBottom: 6, padding: 10, borderLeftWidth: 3, borderLeftColor: palette.accent }}>
              <Text style={{ color: palette.textMuted, fontSize: 11, fontWeight: '700' }}>AI ASSISTANT</Text>
              <Text style={{ color: palette.text, fontSize: 13, marginTop: 4 }}>{ai}</Text>
            </Card>
          )}
          {showAiGen && (
            <Card style={{ marginBottom: 6, padding: 10 }}>
              <Text style={{ color: palette.textMuted, fontSize: 11, fontWeight: '700' }}>AI CODE GENERATOR</Text>
              <TextInput
                value={aiPrompt}
                onChangeText={setAiPrompt}
                placeholder="Describe what you want to build… (e.g. 'blink LED with button')"
                placeholderTextColor={palette.textMuted}
                multiline
                style={{
                  color: palette.text,
                  borderWidth: 1,
                  borderColor: palette.surfaceBorder,
                  borderRadius: 8,
                  padding: 8,
                  marginTop: 6,
                  fontSize: 13,
                  minHeight: 60,
                }}
              />
              <Row style={{ marginTop: 6 }}>
                <Button title={aiLoading ? 'Generating…' : 'Generate'} onPress={doGenerate} disabled={aiLoading} />
                {aiLoading && <ActivityIndicator color={palette.accent} style={{ marginLeft: 8 }} />}
              </Row>
            </Card>
          )}
          {aiResult !== null && (
            <Card style={{ marginBottom: 6, padding: 10, borderLeftWidth: 3, borderLeftColor: palette.success }}>
              <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ color: palette.textMuted, fontSize: 11, fontWeight: '700' }}>AI GENERATED CODE</Text>
                <Button
                  title="Insert into editor"
                  onPress={() => { setCode(aiResult); setAiResult(null); setShowAiGen(false); setDiagnostics([]); }}
                  variant="ghost"
                />
              </Row>
              <Text style={{ color: palette.monoText, fontFamily: 'monospace', fontSize: 11, lineHeight: 16 }}>
                {aiResult.split('\n').slice(0, 20).join('\n')}
                {aiResult.split('\n').length > 20 ? '\n…' : ''}
              </Text>
            </Card>
          )}
          {diagnostics.length === 0 && !compiling && !ai && !uploadMsg && (
            <Text style={{ color: palette.textMuted, fontSize: 12 }}>
              No diagnostics. Tap Verify to compile, Upload to flash firmware.
            </Text>
          )}
        </ScrollView>
      </View>

      {/* Device picker modal */}
      <Modal visible={showDevicePicker} animationType="slide" transparent onRequestClose={() => setShowDevicePicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: palette.surface, borderColor: palette.surfaceBorder }]}>
            <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ color: palette.text, fontSize: 18, fontWeight: '800' }}>Select device</Text>
              <Button title="Cancel" onPress={() => setShowDevicePicker(false)} variant="ghost" />
            </Row>
            <FlatList
              data={devices}
              keyExtractor={(d) => d.id}
              renderItem={({ item }) => {
                const id = identifyBoard(item.vendorId, item.productId);
                return (
                  <Pressable
                    onPress={() => doUploadToDevice(item)}
                    style={[styles.deviceItem, { borderColor: palette.surfaceBorder }]}
                  >
                    <Row style={{ justifyContent: 'space-between' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: palette.text, fontWeight: '700', fontSize: 15 }}>
                          {id?.name ?? item.productName ?? 'Unknown device'}
                        </Text>
                        <Text style={{ color: palette.textMuted, fontSize: 12, marginTop: 2 }}>
                          {item.manufacturer ?? '—'} · VID {item.vendorId} PID {item.productId}
                        </Text>
                      </View>
                      {item.bootsel && <Badge label="BOOTSEL" tone="accent" />}
                    </Row>
                    {id && (
                      <Row style={{ marginTop: 6 }}>
                        <Badge label={id.protocol} tone="accent" />
                        <Text style={{ color: palette.textMuted, fontSize: 11, marginLeft: 8 }}>{id.fqbn}</Text>
                      </Row>
                    )}
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <Text style={{ color: palette.textMuted, textAlign: 'center', padding: 20 }}>
                  No devices found. Connect a board and tap Rescan on the Devices tab.
                </Text>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function BuildStageBar({ stage, progress, palette }: { stage: string; progress: number; palette: any }) {
  const stages = ['idle', 'compiling', 'connecting', 'uploading', 'verified'];
  const colors: Record<string, string> = {
    idle: palette.textMuted,
    compiling: palette.accent,
    connecting: palette.accent,
    uploading: palette.accent,
    verified: palette.success,
    failed: palette.danger,
  };
  const failed = stage === 'failed';
  const activeIdx = stages.indexOf(stage);

  return (
    <View style={{ marginBottom: 8 }}>
      <Row>
        {stages.map((s, i) => {
          const reached = !failed && activeIdx >= i;
          const active = !failed && activeIdx === i;
          const color = failed ? palette.danger : reached ? colors[stage] : palette.surfaceBorder;
          return (
            <View key={s} style={{ flex: 1, marginHorizontal: 2 }}>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: color }} />
              <Text style={{ color: active ? colors[stage] : palette.textMuted, fontSize: 9, marginTop: 2, textAlign: 'center' }}>
                {s}
              </Text>
            </View>
          );
        })}
      </Row>
      {(stage === 'uploading' || stage === 'connecting') && progress > 0 && (
        <View style={{ height: 3, borderRadius: 1.5, backgroundColor: palette.surfaceBorder, marginTop: 6, overflow: 'hidden' }}>
          <View style={{ height: '100%', width: `${Math.round(progress * 100)}%`, backgroundColor: palette.accent }} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 8 },
  banner: { marginHorizontal: 12, marginBottom: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  boardPicker: { paddingVertical: 4 },
  boardList: { paddingHorizontal: 12, paddingBottom: 8 },
  boardItem: { paddingVertical: 8, borderBottomWidth: 0.5, borderColor: 'rgba(150,150,150,0.2)' },
  bottomPanel: { borderTopWidth: 1, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 16 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, padding: 20, maxHeight: '70%' },
  deviceItem: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
});
