import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme/ThemeProvider';
import { CodeEditor } from '@/src/components/CodeEditor';
import { Button, Badge, Row, SectionTitle, Card } from '@/src/components/ui';
import { api } from '@/src/lib/api';
import {
  listDevices,
  requestPermission,
  upload,
  flashUf2,
  isNativeUsbAvailable,
} from '@/src/lib/transport';
import { identifyBoard } from '@droidvibe/shared';
import type { Diagnostic, UsbDevice, UploadProgress } from '@droidvibe/shared';

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

const STAGE_LABELS: Record<string, string> = {
  idle: 'Idle',
  compiling: 'Compiling…',
  compiled: 'Compiled',
  detected: 'Select device',
  selected: 'Connecting…',
  connected: 'Connected',
  uploading: 'Uploading…',
  verifying: 'Verifying…',
  verified: 'Verified',
  done: 'Done',
  failed: 'Failed',
};

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
  const [progressStage, setProgressStage] = useState<string>('');
  const [ai, setAi] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [firmware, setFirmware] = useState<string | null>(null);
  const [devicePickerOpen, setDevicePickerOpen] = useState(false);
  const [devices, setDevices] = useState<UsbDevice[]>([]);
  const [uploading, setUploading] = useState(false);
  const nativeUsb = isNativeUsbAvailable();

  const boardName = BOARDS.find((b) => b.fqbn === fqbn)?.name ?? fqbn;

  async function doCompile() {
    setCompiling(true);
    setBuildStage('compiling');
    setError(null);
    setDiagnostics([]);
    setAi(null);
    setFirmware(null);
    try {
      const r = await api.compile({
        name: 'Sketch',
        fqbn,
        files: [{ path: 'Sketch.ino', content: code }],
      });
      setDiagnostics((r.diagnostics as Diagnostic[]) ?? []);
      if (r.ok) {
        setFirmware(r.firmware ?? null);
        setBuildStage('compiled');
      } else {
        setBuildStage('failed');
      }
    } catch (e) {
      setError((e as Error).message);
      setBuildStage('failed');
    } finally {
      setCompiling(false);
    }
  }

  async function openDevicePicker() {
    if (!firmware) {
      setError('Compile first before uploading.');
      return;
    }
    setError(null);
    try {
      const devs = await listDevices();
      setDevices(devs);
      setDevicePickerOpen(true);
    } catch (e) {
      setError('Failed to list USB devices: ' + (e as Error).message);
    }
  }

  async function selectDevice(device: UsbDevice) {
    setDevicePickerOpen(false);
    setBuildStage('selected');
    setUploading(true);
    setError(null);
    setProgress(0);
    setProgressStage('preparing');

    try {
      const granted = await requestPermission(device.id);
      if (!granted) {
        setError('USB permission denied for ' + (device.productName ?? device.id));
        setBuildStage('failed');
        setUploading(false);
        return;
      }

      const boardId = identifyBoard(device.vendorId, device.productId);
      const usePicoboot = device.bootsel || boardId?.protocol === 'picoboot';

      const onProgress = (p: UploadProgress) => {
        setProgressStage(p.stage);
        setProgress(p.progress);
        if (p.stage === 'writing') setBuildStage('uploading');
        else if (p.stage === 'verifying') setBuildStage('verifying');
        else if (p.stage === 'done') setBuildStage('verified');
        else if (p.stage === 'failed') setBuildStage('failed');
      };

      let result;
      if (usePicoboot) {
        result = await flashUf2(device.id, firmware!, true);
      } else {
        result = await upload(
          {
            device: { id: device.id, vendorId: device.vendorId, productId: device.productId },
            protocol: boardId?.protocol ?? 'stk500v1',
            firmware: firmware!,
            filename: 'Sketch.ino',
            verify: true,
          },
          onProgress,
        );
      }

      if (result.ok && result.verified) {
        setBuildStage('verified');
        setProgress(1);
        setProgressStage('done');
      } else {
        setBuildStage('failed');
        setError(result.message || 'Upload failed.');
      }
    } catch (e) {
      setBuildStage('failed');
      setError('Upload error: ' + (e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function doExplain() {
    if (diagnostics.length === 0) return;
    setAi('Thinking…');
    try {
      const r = await api.ai.explainError({ diagnostics, code });
      setAi((r as any).explanation);
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
            <Text style={{ color: palette.accent, marginLeft: 6 }}>{boardOpen ? '▲' : '▼'}</Text>
          </Row>
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button
            label={compiling ? 'Compiling…' : 'Compile'}
            onPress={doCompile}
            disabled={compiling || uploading}
            variant="primary"
          />
          <Button
            label="Upload"
            onPress={openDevicePicker}
            disabled={compiling || uploading || !firmware}
            variant="accent"
          />
        </View>
      </View>

      {boardOpen && (
        <View style={[styles.boardDropdown, { backgroundColor: palette.card, borderColor: palette.border }]}>
          {BOARDS.map((b) => (
            <Pressable
              key={b.fqbn}
              onPress={() => { setFqbn(b.fqbn); setBoardOpen(false); }}
              style={[styles.boardItem, b.fqbn === fqbn && { backgroundColor: palette.accent + '15' }]}
            >
              <Text style={{ color: palette.text, fontWeight: b.fqbn === fqbn ? '700' : '400' }}>
                {b.name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {!nativeUsb && (
        <View style={[styles.warning, { backgroundColor: '#fff3cd', borderColor: '#ffc107' }]}>
          <Text style={{ color: '#856404', fontSize: 12, flex: 1 }}>
            Native USB unavailable (Expo Go). Upload requires a DroidVibe dev/production build.
          </Text>
        </View>
      )}

      <ScrollView
        style={styles.editorScroll}
        contentContainerStyle={{ paddingBottom: 200 }}
        keyboardShouldPersistTaps="handled"
      >
        <CodeEditor value={code} onChange={setCode} />

        {(buildStage !== 'idle' || compiling || uploading) && (
          <View style={[styles.statusBar, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {compiling && <ActivityIndicator size="small" color={palette.accent} />}
              <Text style={{ color: palette.text, fontWeight: '600' }}>
                {STAGE_LABELS[buildStage] ?? buildStage}
              </Text>
              {progressStage && buildStage !== 'idle' && buildStage !== 'failed' && (
                <Text style={{ color: palette.textMuted, fontSize: 12 }}>
                  ({progressStage} {Math.round(progress * 100)}%)
                </Text>
              )}
            </View>
            {(uploading || (progress > 0 && progress < 1)) && (
              <View style={[styles.progressTrack, { backgroundColor: palette.border }]}>
                <View
                  style={[
                    styles.progressFill,
                    { backgroundColor: palette.accent, width: `${Math.max(2, progress * 100)}%` },
                  ]}
                />
              </View>
            )}
          </View>
        )}

        {error && (
          <Card style={{ marginTop: 8, borderColor: '#dc3545' }}>
            <Text style={{ color: '#dc3545', fontSize: 13 }}>{error}</Text>
          </Card>
        )}

        {diagnostics.length > 0 && (
          <View style={{ marginTop: 8, gap: 4 }}>
            <SectionTitle>Diagnostics ({diagnostics.length})</SectionTitle>
            {diagnostics.map((d, i) => (
              <Card key={i} style={{ padding: 8 }}>
                <Row>
                  <Badge
                    label={d.severity.toUpperCase()}
                    color={d.severity === 'error' ? '#dc3545' : d.severity === 'warning' ? '#ffc107' : palette.accent}
                  />
                  <Text style={{ color: palette.textMuted, fontSize: 11 }}>
                    {d.file}:{d.line}:{d.column}
                  </Text>
                </Row>
                <Text style={{ color: palette.text, fontSize: 13, marginTop: 4 }}>{d.message}</Text>
                {d.explanation && (
                  <Text style={{ color: palette.textMuted, fontSize: 12, marginTop: 2, fontStyle: 'italic' }}>
                    {d.explanation}
                  </Text>
                )}
              </Card>
            ))}
            <Button label="Explain with AI" onPress={doExplain} variant="ghost" />
          </View>
        )}

        {ai && (
          <Card style={{ marginTop: 8 }}>
            <SectionTitle>AI Assistant</SectionTitle>
            <Text style={{ color: palette.text, fontSize: 13 }}>{ai}</Text>
          </Card>
        )}
      </ScrollView>

      <Modal visible={devicePickerOpen} animationType="slide" transparent={true} onRequestClose={() => setDevicePickerOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: palette.bg }]}>
            <View style={[styles.modalHeader, { borderBottomColor: palette.border }]}>
              <Text style={{ color: palette.text, fontWeight: '700', fontSize: 16 }}>Select USB Device</Text>
              <Pressable onPress={() => setDevicePickerOpen(false)}>
                <Text style={{ color: palette.accent, fontSize: 16 }}>Cancel</Text>
              </Pressable>
            </View>

            {devices.length === 0 ? (
              <View style={{ padding: 24, alignItems: 'center' }}>
                <Text style={{ color: palette.textMuted, textAlign: 'center' }}>
                  No USB devices detected. Connect an Arduino and tap to retry.
                </Text>
                <Button
                  label="Refresh"
                  onPress={async () => setDevices(await listDevices())}
                  variant="primary"
                />
              </View>
            ) : (
              <FlatList
                data={devices}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                  const boardId = identifyBoard(item.vendorId, item.productId);
                  return (
                    <Pressable
                      onPress={() => selectDevice(item)}
                      style={[styles.deviceItem, { borderBottomColor: palette.border }]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: palette.text, fontWeight: '600' }}>
                          {item.productName ?? boardId?.name ?? 'Unknown Device'}
                        </Text>
                        <Text style={{ color: palette.textMuted, fontSize: 11 }}>
                          {item.manufacturer ?? 'Unknown'} · VID:{item.vendorId} PID:{item.productId}
                          {item.bootsel ? ' · BOOTSEL' : ''}
                        </Text>
                        {boardId && (
                          <Text style={{ color: palette.accent, fontSize: 11 }}>
                            {boardId.fqbn} · {boardId.protocol}
                          </Text>
                        )}
                      </View>
                      <Text style={{ color: palette.accent, fontSize: 20 }}>›</Text>
                    </Pressable>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  boardPicker: { paddingVertical: 4 },
  boardDropdown: {
    marginHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  boardItem: { paddingVertical: 10, paddingHorizontal: 14 },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: 4,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  editorScroll: { flex: 1, paddingHorizontal: 0 },
  statusBar: {
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
  },
});
