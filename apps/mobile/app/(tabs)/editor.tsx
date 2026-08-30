import React, { useEffect, useState, useRef } from 'react';
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
  LayoutAnimation,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme/ThemeProvider';
import { CodeEditor } from '@/src/components/CodeEditor';
import { Button, Badge, Row, SectionTitle, Card, HardwareStatusBadge } from '@/src/components/ui';
import { api } from '@/src/lib/api';
import { listDevices, upload, flashUf2, isNativeUsbAvailable, addDeviceListener } from '@/src/lib/transport';
import { identifyBoard } from '@droidvibe/shared';
import { consumePendingSketch } from '@/src/lib/sketchBridge';
import { saveLocalSketch, getLastUsedBoard, setLastUsedBoard } from '@/src/lib/offlineSketches';
import type { Diagnostic, UsbDevice, UploadProtocol, UploadProgress, UploadStage, BoardIdentity } from '@droidvibe/shared';

const DEFAULT_CODE = `// DroidVibe - Blink
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

// Map common failure messages to actionable suggestions
function failureSuggestion(message: string): string | null {
  const msg = (message || '').toLowerCase();
  if (msg.includes('permission') || msg.includes('denied')) {
    return 'USB permission was denied. Go to the Devices tab and tap "Allow access".';
  }
  if (msg.includes('timeout') || msg.includes('handshake')) {
    return 'The board did not respond. Press the reset button and try again.';
  }
  if (msg.includes('verification') || msg.includes('verify')) {
    return 'Firmware was written but verification failed. The board may have an incompatible bootloader.';
  }
  if (msg.includes('connection') || msg.includes('refused') || msg.includes('busy') || msg.includes('in use')) {
    return 'The board may be in use by another app. Close other serial apps and try again.';
  }
  if (msg.includes('disconnected') || msg.includes('detach')) {
    return 'The USB cable was disconnected. Reconnect the board and try again.';
  }
  if (msg.includes('native usb') || msg.includes('expo go')) {
    return 'Build a DroidVibe dev/production APK for hardware access.';
  }
  return null;
}

function formatStageLabel(stage: UploadStage, protocol?: string): string {
  const labels: Record<UploadStage, string> = {
    preparing: 'Preparing firmware',
    resetting: protocol === 'avr109' ? 'Waiting for bootloader' : 'Resetting board',
    handshake: 'Establishing handshake',
    erasing: 'Erasing flash',
    writing: 'Writing firmware',
    verifying: 'Verifying',
    done: 'Complete',
    failed: 'Failed',
  };
  return labels[stage] ?? stage;
}

// Map UploadStage to BuildStageBar position
const STAGE_MAP: Record<UploadStage, string> = {
  preparing: 'uploading',
  resetting: 'uploading',
  handshake: 'uploading',
  erasing: 'uploading',
  writing: 'uploading',
  verifying: 'verifying',
  done: 'verified',
  failed: 'failed',
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
  const [uploadStageDetail, setUploadStageDetail] = useState<string | null>(null);

  const [progress, setProgress] = useState(0);
  const [ai, setAi] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorSuggestion, setErrorSuggestion] = useState<string | null>(null);
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
  const [scrollToLine, setScrollToLine] = useState<number | undefined>(undefined);
  const [identifiedBoard, setIdentifiedBoard] = useState<BoardIdentity | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  // Undo/redo history
  const [history, setHistory] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const lastCodeRef = useRef(DEFAULT_CODE);
  // Find/replace
  const [showFind, setShowFind] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [findCount, setFindCount] = useState(0);
  const nativeUsb = isNativeUsbAvailable();
  const uploadDeviceRef = useRef<UsbDevice | null>(null);
  const uploadAbortedRef = useRef(false);
  const buildStageRef = useRef<string>('idle');

  // Keep buildStageRef in sync for use in onProgress closure
  useEffect(() => {
    buildStageRef.current = buildStage;
  }, [buildStage]);

  // Track code changes for undo history (debounced — only snapshots meaningful edits)
  useEffect(() => {
    if (code === lastCodeRef.current) return;
    const 
timer = setTimeout((
) => {
      setHistory((prev) => [...prev.slice(-49), lastCodeRef.current]);
      setRedoStack([]);
      lastCodeRef.current = code;
    }, 500);
    return () => clearTimeout(timer);
  }, [code]);

  // Count find matches when text changes
  useEffect(() => {
    if (!findText) { setFindCount(0); return; }
    let count = 0;
    let pos = 0;
    while ((pos = code.indexOf(findText, pos)) !== -1) {
      count++;
      pos += findText.length;
    }
    setFindCount(count);
  }, [findText, code]);

  function undo() {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setRedoStack((r) => [...r, code]);
    setHistory((h) => h.slice(0, -1));
    lastCodeRef.current = prev;
    setCode(prev);
  }

  function redo() {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setHistory((h) => [...h, code]);
    setRedoStack((r) => r.slice(0, -1));
    lastCodeRef.current = next;
    setCode(next);
  }

  function doReplace() {
    if (!findText || findCount === 0) return;
    const newCode = code.replace(findText, replaceText);
    lastCodeRef.current = newCode;
    setCode(newCode);
  }

  function doReplaceAll() {
    if (!findText) return;
    const newCode = code.split(findText).join(replaceText);
    lastCodeRef.current = newCode;
    setCode(newCode);
  }

  // Load pending sketch from sketchBridge on mount
  useEffect(() => {
    const pending = consumePendingSketch();
    if (pending) {
      setCode(pending.code);
      setSketchName(pending.name);
    }
    // Pre-select last-used board
    getLastUsedBoard().then((lastBoard) => {
      if (lastBoard) setFqbn(lastBoard);
    });
  }, []);

  // USB disconnect detection — abort in-progress upload
  useEffect(() => {
    if (!nativeUsb) return;
    const unsub = addDeviceListener((e) => {
      if (e.type === 'detach' && uploadDeviceRef.current && e.device.id === uploadDeviceRef.current.id) {
        if (uploading) {

          uploadAbortedRef.current = true;
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setBuildStage('failed');
          setUploadMsg('USB disconnected during upload.');
          setErrorSuggestion('The USB cable was disconnected mid-upload. Reconnect the board and try again.');
          setUploading(false);
        }
        setIdentifiedBoard(null);
      }
    });
    return () => unsub();
  }, [nativeUsb, uploading]);

  const boardName = BOARDS.find((b) => b.fqbn === fqbn)?.name ?? fqbn;

  async function doCompile(): Promise<string | null> {
    setCompiling(true);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setBuildStage('compiling');
    setError(null);
    setErrorSuggestion(null);
    setDiagnostics([]);
    setAi(null);
    setFirmware(null);
    setUploadStageDetail(null);
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
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setBuildStage(fw ? 'idle' : 'failed');
        if (!fw) {
          setError('Compilation succeeded but no firmware artifact was returned.');
          return null;
        }
        return fw;
      } else {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setBuildStage('failed');
        return null;
      }
    } catch (e) {
      setError((e as Error).message);
      setErrorSuggestion(failureSuggestion((e as Error).message));
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setBuildStage('failed');
      return null;
    } finally {
      setCompiling(false);
    }
  }

  async function startUpload() {
    if (!nativeUsb) {
  
    setError('Native USB unavailable. Build a DroidVibe dev/production APK to access USB hardware.');
      setErrorSuggestion(failureSuggestion('Native USB unavailable'));
      return;
    }
    setError(null);
    setErrorSuggestion(null);
    setUploadMsg(null);
    setIdentifiedBoard(null);
    // Ensure we have firmware
    let fw = firmware;
    if (!fw) {
      fw = await doCompile();
    }
    if (!fw) return;

    // Open device picker — filter to only permission-granted devices
    const devs = await listDevices();
    const granted = devs.filter((d) => d.permission === 'granted');
    setDevices(granted);
    if (granted.length === 0) {
      const hasPending = devs.some((d) => d.permission === 'pending' || d.permission === 'unknown');
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setBuildStage('failed');
      if (hasPending) {
        setError('No devices with USB permission granted.');
        setErrorSuggestion('Go to the Devices tab and tap "Allow access" on your board, then try again.');
      } else {
        setError('No USB devices detected. Connect a board via USB-OTG.');
        setErrorSuggestion(null);
      }
      return;
    }
    setShowDevicePicker(true);
  }

  function handleUploadResult(result: any) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (result.ok && result.verified) {
      setBuildStage('verified');
      setUploadMsg('Upload verified successfully.');
      setUploadStageDetail(null);
      setProgress(1);
      setErrorSuggestion(null);
    } else if (result.ok) {
      setBuildStage('verified');
      setUploadMsg('Upload completed. Verification not confirmed.');
      setUploadStageDetail(null);
      setProgress(1);
      setErrorSuggestion('The upload completed but verification was not confirmed. This may indicate a bootloader issue.');
    } else {
      setBuildStage('failed');
      setUploadMsg(result.message);
      setErrorSuggestion(failureSuggestion(result.message));
    }
  }

  async function doUploadToDevice(device: UsbDevice) {
    setShowDevicePicker(false);
    let fw = firmware;
    if (!fw) {
      fw = await doCompile();
      if (!fw) return;
    }

    uploadDeviceRef.current = device;
    uploadAbortedRef.current = false;

    // Board identification — explicit confirmed state
    const id = identifyBoard(device.vendorId, device.productId);
    setIdentifiedBoard(id);

    setUploading(true);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setBuildStage('connecting');
    setUploadStageDetail(null);
    setUploadMsg(null);
    setProgress(0);
    setError(null);
    setErrorSuggestion(null);

    try {
      const protocol: UploadProtocol = device.bootsel
        ? 'picoboot'
        : id?.protocol ?? 'stk500v1';

      let result;
      if (device.bootsel || protocol === 'picoboot') {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setBuildStage('uploading');
        setUploadStageDetail('Flashing via PICOBOOT');
        setUploadMsg('Flashing via PICOBOOT...');
        result = await flashUf2(device.id, fw, true);
      } else {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setBuildStage('uploading');
        setUploadStageDetail('Preparing');
        setUploadMsg('Uploading via ' + protocol + '...');
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
            if (uploadAbortedRef.current) return;
            setProgress(p.progress);
            const newStage = STAGE_MAP[p.stage] ?? 'uploading';
            if (newStage !== buildStageRef.current) {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setBuildStage(newStage);
            }
            setUploadStageDetail(formatStageLabel(p.stage, protocol));
            if (p.message) setUploadMsg(p.message);
            else if (p.stage === 'resetting' && protocol === 'avr109') {
              setUploadMsg('Waiting for bootloader to start...');
            }
          },
        );
      }

      if (!uploadAbortedRef.current) {
        handleUploadResult(result);
      }
    } catch (e) {
      if (!uploadAbortedRef.current) {
        const msg = (e as Error).message;
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setBuildStage('failed');
        setUploadMsg(msg);
        setErrorSuggestion(failureSuggestion(msg));
      }
    } finally {
      setUploading(false);
      uploadDeviceRef.current = null;
    }
  }

  async function doExplain() {
    if (diagnostics.length === 0) return;
    setAi('Thinking...');
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

  async function doSave() {
   
 setSaveState('saving');
    try {
      await saveLocalSketch({ name: sketchName, code, fqbn });
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch (e) {
      setSaveState('idle');
      setError('Save failed: ' + (e as Error).message);
    }
  }

  function tapDiagnostic(d: Diagnostic) {
    if (d.line > 0) {
      setScrollToLine(d.line);
      setTimeout(() => setScrollToLine(undefined), 200);
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
        <Row gap={4}>
          <Button title="Undo" onPress={undo} disabled={history.length === 0} variant="ghost" size="sm" />
          <Button title="Redo" onPress={redo} disabled={redoStack.length === 0} variant="ghost" size="sm" />
          <Button title="Find" onPress={() => setShowFind(true)} variant="ghost" size="sm" />
          <Button
            title={saveState === 'saving' ? 'Saving...' : saveState === 'saved' ? 'Saved!' : 'Save'}
            onPress={doSave}
            disabled={saveState === 'saving'}
            variant="ghost"
            size="sm"
          />
          <Button
            title="Verify"
            onPress={() => doCompile()}
            disabled={compiling || uploading}
            loading={compiling}
            variant="ghost"
          />
          <Button
            title="Upload"
            onPress={startUpload}
            disabled={compiling || uploading}
            loading={uploading}
       
   />
        </Row>
     
 </View>

      {!nativeUsb && (
        <View style={[styles.banner, { backgroundColor: palette.warning + '18', borderColor: palette.warning }]}>
          <Text style={{ color: palette.warning, fontSize: 12, fontWeight: '600' }}>
            Expo Go detected — native USB unavailable. Build a dev/production APK for hardware access.
          </Text>
        </View>
      )}

      {/* Identified board state — explicit confirmed state */}
      {identifiedBoard && (
        <View style={[styles.boardIdBar, { backgroundColor: palette.accent + '12', borderColor: palette.accent + '40' }]}>
          <HardwareStatusBadge state="connected" />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={{ color: palette.text, fontSize: 12, fontWeight: '700' }}>
              Board identified: {identifiedBoard.name}
            </Text>
            <Text style={{ color: palette.textMuted, fontSize: 11 }}>
              {identifiedBoard.protocol} — {identifiedBoard.fqbn}
            </Text>
          </View>
        </View>
      )}

      {boardOpen && (
        <View style={styles.boardList}>
          {BOARDS.map((b) => (
            <Pressable
              key={b.fqbn}
              onPress={() => {
                setFqbn(b.fqbn);
                setLastUsedBoard(b.fqbn);
                setBoardOpen(false);
              }}
              style={styles.boardItem}
            >
              <Text style={{ color: palette.text }}>{b.name}</Text>
              <Text style={{ color: palette.textMuted, fontSize: 11 }}>{b.fqbn}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={{ flex: 1, paddingHorizontal: 12 }}>
        <CodeEditor value={code} onChange={setCode} diagnostics={diagnostics} scrollToLine={scrollToLine} />
      </View>

      <View style={[styles.bottomPanel, { backgroundColor: palette.bgElevated, borderColor: palette.surfaceBorder }]}>
        <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
          <SectionTitle
            title="Output"
            subtitle={compiling ? 'Compiling...' : uploading ? 'Uploading...' : undefined}
          />
          {(compiling || uploading) && <ActivityIndicator color={palette.accent} />}
          {diagnostics.length > 0 && (
            <Button title="Explain (AI)" onPress={doExplain} variant="ghost" size="sm" />
          )}
          {diagnostics.length > 0 && (
            <Button title="Fix (AI)" onPress={doFix} disabled={aiLoading} variant="ghost" size="sm" />
          )}
          <Button title="Generate" onPress={() => setShowAiGen((v) => !v)} variant="ghost" size="sm" />
        </Row>

        <BuildStageBar stage={buildStage} progress={progress} palette={palette} />

        {uploadStageDetail && (buildStage === 'uploading' || buildStage === 'verifying') && (
          <Text style={{ color: palette.accent, fontSize: 12, fontWeight: '600', marginBottom: 4 }}>
            {uploadStageDetail}
          </Text>
        )}
        {uploadMsg && (
          <Text
            style={{
              color: buildStage === 'failed' ? palette.danger : buildStage === 'verified' ? palette.success : palette.text,
              fontSize: 12,
              marginBottom: 4,
            }}
          >
            {uploadMsg}
          </Text>
        )}
        {error && (
          <Text style={{ color: palette.danger, fontSize: 12, marginBottom: 2, fontWeight: '600' }}>{error}</Text>
        )}
        {errorSuggestion && (
          <Text style={{ color: palette.textMuted, fontSize: 12, marginBottom: 4, fontStyle: 'italic' }}>
            Tip: {errorSuggestion}
          </Text>
        )}

        <ScrollView style={{ maxHeight: 160 }}>
          {diagnostics.map((d, i) => (
            <Pressable key={i} onPress={() => tapDiagnostic(d)}>
              <Card style={{ marginBottom: 6, padding: 10 }}>
                <Row>
                  <Badge
                    label={d.severity}
                    tone=
{d.severity === 'error' ? 'danger' : d.severity === 'warning' ? 'warn' : 'neutral'}
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
            </Pressable>
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
                placeholder="Describe what you want to build... (e.g. 'blink LED with button')"
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
                <Button
                  title={aiLoading ? 'Generating...' : 'Generate'}
                
  onPress={doGenerate}
      
            disabled={aiLoading}
                  loading={aiLoading}
                />
              </Row>
            </Card>
          )}
          {aiResult !== null && (
            <Card style={{ marginBottom: 6, padding: 10, borderLeftWidth: 3, borderLeftColor: palette.success }}>
              <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ color: palette.textMuted, fontSize: 11, fontWeight: '700' }}>AI GENERATED CODE</Text>
                <Button
                  title="Insert into editor"
                  onPress={() => {
                    setCode(aiResult);
                    setAiResult(null);
                    setShowAiGen(false);
                    setDiagnostics([]);
                  }}
                  variant="ghost"
                  size="sm"
                />
              </Row>
              <Text style={{ color: palette.monoText, fontFamily: 'monospace', fontSize: 11, lineHeight: 16 }}>
                {aiResult.split('\n').slice(0, 20).join('\n')}
                {aiResult.split('\n').length > 20 ? '\n...' : ''}
              </Text>
            </Card>
          )}
          {diagnostics.length === 0 && !compiling && !ai && !uploadMsg && !error && (
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
                      <Row style={{ marginTop: 6 }} gap={8}>
                        <Badge label={id.protocol} tone="accent" />
                        <Text style={{ color: palette.textMuted, fontSize: 11 }}>{id.fqbn}</Text>
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

      {/* Find & Replace modal */}
      <Modal visible=
{showFind} animationType="slide
" transparent onRequestClose={() => setShowFind(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: palette.surface, borderColor: palette.surfaceBorder }]}>
            <Row justify="space-between" style={{ marginBottom: 12 }}>
              <Text style={{ color: palette.text, fontSize: 18, fontWeight: '800' }}>Find &amp; Replace</Text>
              <Button title="Close" onPress={() => setShowFind(false)} variant="ghost" size="sm" />
            </Row>
            <TextInput
              value={findText}
              onChangeText={setFindText}
              placeholder="Find..."
              placeholderTextColor={palette.textMuted}
              style={[styles.findInput, { color: palette.text, borderColor: palette.surfaceBorder, backgroundColor: palette.surface }]}
            />
            <TextInput
              value={replaceText}
              onChangeText={setReplaceText}
              placeholder="Replace with..."
              placeholderTextColor={palette.textMuted}
              style={[styles.findInput, { color: palette.text, borderColor: palette.surfaceBorder, backgroundColor: palette.surface, marginTop: 8 }]}
            />
            <Row gap={8} style={{ marginTop: 12, flexWrap: 'wrap' }}>
              <Button title="Replace" onPress={doReplace} disabled={findCount === 0} variant="ghost" size="sm" />
              <Button title="Replace All" onPress={doReplaceAll} disabled={!findText} variant="ghost" size="sm" />
            </Row>
            {findText && (
              <Text style={{ color: palette.textMuted, fontSize: 12, marginTop: 8 }}>
                {findCount > 0 ? findCount + ' match' + (findCount !== 1 ? 'es' : '') + ' found' : 'No matches found'}
              </Text>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function BuildStageBar({ stage, progress, palette }: { stage: string; progress: number; 
palette: any }) {
  const stages
 = ['idle', 'compiling', 'connecting', 'uploading', 'verifying', 'verified'];
  const stageLabels: Record<string, string> = {
    idle: 'Idle',
    compiling: 'Compile',
    connecting: 'Connect',
    uploading: 'Upload',
    verifying: 'Verify',
    verified: 'Verified',
    failed: 'Failed',
  };
  const colors: Record<string, string> = {
    idle: palette.textMuted,
    compiling: palette.accent,
    connecting: palette.accent,
    uploading: palette.accent,
    verifying: palette.accent,
    verified: palette.success,
    failed: palette.danger,
  };
  const failed = stage === 'failed';
  const activeIdx = stages.indexOf(stage);

  return (
    <View style={{ marginBottom: 8 }}>
      <Row gap={2}>
        {stages.map((s, i) => {
          const reached = !failed && activeIdx >= i;
          const active = !failed && activeIdx === i;
          const color = failed ? palette.danger : reached ? colors[stage] : palette.surfaceBorder;
          return (
            <View key={s} style={{ flex: 1 }}>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: color }} />
              <Text
                style={{
                  color: active ? colors[stage] : palette.textMuted,
                  fontSize: 9,
                  marginTop: 2,
                  textAlign: 'center',
                }}
              >
                {stageLabels[s] ?? s}
              </Text>
            </View>
          );
        })}
      </Row>
      {(stage === 'uploading' || stage === 'connecting' || stage === 'verifying') && progress > 0 && (
        <View
          style={{
            height: 3,
            borderRadius: 1.5,
            backgroundColor: palette.surfaceBorder,
            marginTop: 6,
            overflow: 'hidden',
          }}
        >
          <View
            style={{ height: '100%', width: Math.round(progress * 100) + '%', backgroundColor: palette.accent } as ViewStyle}
          />
        </View>
   
   )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  banner: { marginHorizontal: 12, marginBottom: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  boardIdBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  boardPicker: { paddingVertical: 4 },
  boardList: { paddingHorizontal: 12, paddingBottom: 8 },
  boardItem: { paddingVertical: 8, borderBottomWidth: 0.5, borderColor: 'rgba(150,150,150,0.2)' },
  bottomPanel: { borderTopWidth: 1
    borderColor: 'rgba(150,150,150,0.2)',
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', maxHeight: '60%', borderRadius: 12, padding: 16, borderWidth: 1 },
  deviceItem: { padding: 12, borderBottomWidth: 0.5, borderColor: 'rgba(150,150,150,0.2)' },
  findInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
});
