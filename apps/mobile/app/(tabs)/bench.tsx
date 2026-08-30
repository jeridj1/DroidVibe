import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable, TextInput, FlatList, Modal, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme/ThemeProvider';
import { Card, Badge, Button, Row, SectionTitle } from '@/src/components/ui';
import { WaveformViewer } from '@/src/components/WaveformViewer';
import {
  listDevices,
  openSerial,
  closeSerial,
  writeSerial,
  addSerialDataListener,
  addDeviceListener,
  isNativeUsbAvailable,
} from '@/src/lib/transport';
import { identifyBoard, DEFAULT_SERIAL_OPTIONS } from '@droidvibe/shared';
import type { UsbDevice, SerialOptions } from '@droidvibe/shared';

type Tab = 'serial' | 'plotter' | 'logic';

const BAUD_RATES = [9600, 19200, 38400, 57600, 115200, 230400];
const MAX_LINES = 500;
const MAX_PLOTTER_POINTS = 240;

function bytesToText(data: Uint8Array): string {
  let result = '';
  for (let i = 0; i < data.length; i++) {
    result += String.fromCharCode(data[i]);
  }
  return result;
}

export default function BenchScreen() {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('serial');
  const [paused, setPaused] = useState(false);
  const [lines, setLines] = useState<string[]>(['> Serial monitor ready.', '> Connect a board to stream data.']);

  const nativeUsb = isNativeUsbAvailable();
  const [showDevicePicker, setShowDevicePicker] = useState(false);
  const [devices, setDevices] = useState<UsbDevice[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<UsbDevice | null>(null);
  const [baudRate, setBaudRate] = useState(115200);
  const [inputText, setInputText] = useState('');
  const [disconnected, setDisconnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [plotterData, setPlotterData] = useState<number[]>([]);
  const scrollRef = useRef<ScrollView>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const pausedRef = useRef(false);
  const deviceIdRef = useRef<string | null>(null);
  const lastDeviceRef = useRef<UsbDevice | null>(null);
  const plotterBufferRef = useRef<string>('');

  useEffect(() => { pausedRef.current = paused; }, [paused]);

  // Listen for USB detach events to detect disconnection + auto-reconnect
  useEffect(() => {
    const unsub = addDeviceListener((e) => {
      if (e.type === 'detach' && deviceIdRef.current === e.device.id) {
        setDisconnected(true);
        setConnectedDevice(null);
        setLines((prev) => [...prev, '> USB device disconnected.']);
        if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
        deviceIdRef.current = null;
      }
      if (e.type === 'attach' && disconnected && lastDeviceRef.current) {
        // Auto-reconnect: try to re-open the serial port
        const reattach = e.device;
        const expectedVendor = lastDeviceRef.current.vendorId;
        const expectedProduct = lastDeviceRef.current.productId;
        if (reattach.vendorId === expectedVendor && reattach.productId === expectedProduct) {
          setReconnecting(true);
          setLines((prev) => [...prev, '> Device reconnected. Re-opening serial port...']);
          setTimeout(() => {
            reconnectSerial(reattach);
          }, 1000);
        }
      }
    });
    return () => { unsub(); };
  }, [disconnected, connectedDevice]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
      if (deviceIdRef.current) { closeSerial(deviceIdRef.current).catch(() => {}); }
    };
  }, []);

  async function connectSerial() {
    if (!nativeUsb) return;
    const devs = await listDevices();
    setDevices(devs);
    if (devs.length === 0) {
      setLines((prev) => [...prev, '> No USB devices detected.']);
      return;
    }
    setShowDevicePicker(true);
  }

  async function selectDevice(device: UsbDevice) {
    setShowDevicePicker(false);
    setDisconnected(false);
    await openSerialConnection(device);
  }

  async function openSerialConnection(device: UsbDevice) {
    try {
      const opts: SerialOptions = { ...DEFAULT_SERIAL_OPTIONS, baudRate };
      const ok = await openSerial(device.id, opts);
      if (!ok) {
        setLines((prev) => [...prev, '> Failed to open serial port. The board may be in use by another app.']);
        return false;
      }
      setConnectedDevice(device);
      deviceIdRef.current = device.id;
      lastDeviceRef.current = device;
      setLines((prev) => [...prev, '> Connected to ' + (device.productName ?? device.id) + ' at ' + baudRate + ' baud.']);
      setPlotterData([]);

      const unsub = addSerialDataListener(device.id, (data: Uint8Array) => {
        if (pausedRef.current) return;
        const text = bytesToText(data);

        // Serial monitor: accumulate lines
        setLines((prev) => {
          const newLines = text.split('\n');
          const combined = [...prev];
          if (combined.length > 0 && !combined[combined.length - 1].startsWith('>')) {
            combined[combined.length - 1] += newLines[0];
          } else {
            combined.push(newLines[0]);
          }
          for (let i = 1; i < newLines.length; i++) combined.push(newLines[i]);
          return combined.slice(-MAX_LINES);
        });

        // Plotter: parse numeric values from serial output
        plotterBufferRef.current += text;
        const bufLines = plotterBufferRef.current.split('\n');
        plotterBufferRef.current = bufLines.pop() ?? '';
        for (const line of bufLines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          // Parse first numeric value (Arduino Serial Plotter format: val1,val2,...)
          const firstVal = parseFloat(trimmed.split(',')[0]);
          if (!isNaN(firstVal)) {
            setPlotterData((prev) => [...prev.slice(-(MAX_PLOTTER_POINTS - 1)), firstVal]);
          }
        }
      });
      unsubRef.current = unsub;
      return true;
    } catch (e) {
      setLines((prev) => [...prev, '> Error: ' + (e as Error).message]);
      return false;
    }
  }

  async function reconnectSerial(device: UsbDevice) {
    const ok = await openSerialConnection(device);
    setReconnecting(false);
    if (ok) {
      setDisconnected(false);
      setLines((prev) => [...prev, '> Reconnected successfully.']);
    } else {
      setLines((prev) => [...prev, '> Reconnection failed. Tap Connect to try manually.']);
    }
  }

  async function disconnectSerial() {
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
    if (connectedDevice) {
      await closeSerial(connectedDevice.id).catch(() => {});
      setConnectedDevice(null);
      deviceIdRef.current = null;
      setLines((prev) => [...prev, '> Disconnected.']);
    }
  }

  async function sendData() {
    if (!connectedDevice || !inputText.trim()) return;
    try {
      const bytes = new Uint8Array(inputText.length + 1);
      for (let i = 0; i < inputText.length; i++) bytes[i] = inputText.charCodeAt(i);
      bytes[inputText.length] = 10;
      await writeSerial(connectedDevice.id, bytes);
      setLines((prev) => [...prev, '> sent: ' + inputText]);
      setInputText('');
    } catch (e) {
      setLines((prev) => [...prev, '> Send error: ' + (e as Error).message]);
    }
  }

  async function exportSerial() {
    try {
      const content = lines.join('\n');
      await Share.share({ message: content, title: 'DroidVibe Serial Export' });
    } catch (e) {
      setLines((prev) => [...prev, '> Export error: ' + (e as Error).message]);
    }
  }

  async function exportPlotterCSV() {
    try {
      const csv = plotterData.map((v, i) => i + ',' + v).join('\n');
      await Share.share({ message: 'index,value\n' + csv, title: 'DroidVibe Plotter Export' });
    } catch (e) {
      setLines((prev) => [...prev, '> CSV export error: ' + (e as Error).message]);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.text }]}>Bench</Text>
        <Row gap={6}>
          {(['serial', 'plotter', 'logic'] as Tab[]).map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={[styles.seg, { backgroundColor: tab === t ? palette.accent : palette.bgInset }]}
            >
              <Text style={{ color: tab === t ? palette.textOnAccent : palette.textMuted, fontSize: 12, fontWeight: '700' }}>
                {t === 'serial' ? 'Monitor' : t === 'plotter' ? 'Plotter' : 'Logic'}
              </Text>
            </Pressable>
          ))}
        </Row>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        {tab === 'serial' && (
          <>
            <SectionTitle
              title="Serial monitor"
              subtitle={
                reconnecting
                  ? 'Reconnecting...'
                  : disconnected
                    ? 'Device disconnected — reconnecting automatically'
                    : connectedDevice
                      ? (connectedDevice.productName ?? connectedDevice.id) + ' · ' + baudRate + ' baud'
                      : nativeUsb
                        ? 'Not connected — tap Connect'
                        : 'Native USB unavailable (Expo Go)'
              }
            />

            {!nativeUsb && (
              <View style={[styles.banner, { backgroundColor: palette.warning + '18', borderColor: palette.warning }]}>
                <Text style={{ color: palette.warning, fontSize: 12 }}>
                  Build a DroidVibe dev/production APK for serial hardware access.
                </Text>
              </View>
            )}

            {disconnected && !reconnecting && (
              <View style={[styles.banner, { backgroundColor: palette.danger + '18', borderColor: palette.danger }]}>
                <Text style={{ color: palette.danger, fontSize: 12 }}>
                  USB device disconnected. Reconnect the board to resume streaming.
                </Text>
              </View>
            )}

            {reconnecting && (
              <View style={[styles.banner, { backgroundColor: palette.accent + '18', borderColor: palette.accent }]}>
                <Text style={{ color: palette.accent, fontSize: 12 }}>
                  Reconnecting to device...
                </Text>
              </View>
            )}

            <Row gap={8} style={{ marginBottom: 8, flexWrap: 'wrap' }}>
              {!connectedDevice ? (
                <Button title="Connect" onPress={connectSerial} disabled={!nativeUsb || reconnecting} loading={reconnecting} />
              ) : (
                <Button title="Disconnect" onPress={disconnectSerial} variant="danger" />
              )}
              {connectedDevice && (
                <>
                  <Button title={paused ? 'Resume' : 'Pause'} onPress={() => setPaused((v) => !v)} variant="ghost" />
                  <Button title="Clear" onPress={() => setLines(['> cleared'])} variant="ghost" />
                  <Button title="Export" onPress={exportSerial} variant="ghost" />
                </>
              )}
            </Row>

            {nativeUsb && !connectedDevice && (
              <Row gap={4} style={{ marginBottom: 8, flexWrap: 'wrap' }}>
                <Text style={{ color: palette.textMuted, fontSize: 12, marginRight: 8 }}>Baud:</Text>
                {BAUD_RATES.map((b) => (
                  <Pressable
                    key={b}
                    onPress={() => setBaudRate(b)}
                    style={[styles.baudBtn, { backgroundColor: baudRate === b ? palette.accent : palette.bgInset }]}
                  >
                    <Text style={{ color: baudRate === b ? palette.textOnAccent : palette.textMuted, fontSize: 11, fontWeight: '700' }}>
                      {b}
                    </Text>
                  </Pressable>
                ))}
              </Row>
            )}

            <Card style={{ minHeight: 240, backgroundColor: palette.monoBg, borderColor: palette.surfaceBorder }}>
              <ScrollView ref={scrollRef} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
                <Text style={{ color: palette.monoText, fontFamily: 'monospace', fontSize: 12, lineHeight: 16 }}>
                  {lines.join('\n')}
                </Text>
              </ScrollView>
            </Card>

            {connectedDevice && (
              <Row gap={8} style={{ marginTop: 8 }}>
                <TextInput
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder="Type to send..."
                  placeholderTextColor={palette.textMuted}
                  style={[styles.sendInput, { color: palette.text, borderColor: palette.surfaceBorder, backgroundColor: palette.surface }]}
                  onSubmitEditing={sendData}
                />
                <Button title="Send" onPress={sendData} />
              </Row>
            )}
          </>
        )}

        {tab === 'plotter' && (
          <>
            <SectionTitle
              title="Serial plotter"
              subtitle={
                connectedDevice
                  ? 'Live data from ' + (connectedDevice.productName ?? connectedDevice.id)
                  : 'Demo data — connect a board to stream real values'
              }
            />
            <Card style={{ height: 260, padding: 8, backgroundColor: palette.monoBg }}>
              <WaveformViewer
                mode="plotter"
                palette={palette}
                dataSource={connectedDevice ? 'serial' : 'demo'}
                seriesData={connectedDevice && plotterData.length > 0 ? plotterData : undefined}
              />
            </Card>
            {connectedDevice && plotterData.length > 0 && (
              <Text style={{ color: palette.textMuted, fontSize: 11, marginTop: 8 }}>
                {plotterData.length} data points buffered. Parsing first numeric value per line.
              </Text>
            )}
            {!connectedDevice && (
              <Text style={{ color: palette.textMuted, fontSize: 11, marginTop: 8 }}>
                Plotter shows demo data. Connect a board and stream values via Serial.print() to see live plots.
              </Text>
            )}
            {connectedDevice && plotterData.length > 0 && (
              <Row gap={8} style={{ marginTop: 8 }}>
                <Button title="Export CSV" onPress={exportPlotterCSV} variant="ghost" size="sm" />
              </Row>
            )}
          </>
        )}

        {tab === 'logic' && (
          <>
            <SectionTitle title="Logic analyzer" subtitle="RP2040 capture · zoom · cursors · protocol decode" />
            <Card style={{ height: 260, padding: 8, backgroundColor: palette.monoBg }}>
              <WaveformViewer mode="logic" palette={palette} dataSource="demo" />
            </Card>
            <Text style={{ color: palette.warning, fontSize: 12, marginTop: 8 }}>
              Capture requires a verified RP2040 helper firmware image (not bundled). Waveform shows a demo signal.
            </Text>
          </>
        )}
      </ScrollView>

      <Modal visible={showDevicePicker} animationType="slide" transparent onRequestClose={() => setShowDevicePicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: palette.surface, borderColor: palette.surfaceBorder }]}>
            <Row justify="space-between" style={{ marginBottom: 12 }}>
              <Text style={{ color: palette.text, fontSize: 18, fontWeight: '800' }}>Select serial device</Text>
              <Button title="Cancel" onPress={() => setShowDevicePicker(false)} variant="ghost" />
            </Row>
            <FlatList
              data={devices}
              keyExtractor={(d) => d.id}
              renderItem={({ item }) => {
                const id = identifyBoard(item.vendorId, item.productId);
                return (
                  <Pressable
                    onPress={() => selectDevice(item)}
                    style={[styles.deviceItem, { borderColor: palette.surfaceBorder }]}
                  >
                    <Text style={{ color: palette.text, fontWeight: '700', fontSize: 15 }}>
                      {id?.name ?? item.productName ?? 'Unknown device'}
                    </Text>
                    <Text style={{ color: palette.textMuted, fontSize: 12, marginTop: 2 }}>
                      {item.manufacturer ?? '—'} · VID {item.vendorId} PID {item.productId}
                    </Text>
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <Text style={{ color: palette.textMuted, textAlign: 'center', padding: 20 }}>
                  No devices found. Connect a board and try again.
                </Text>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10 },
  title: { fontSize: 26, fontWeight: '800' },
  seg: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  banner: { padding: 10, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
  baudBtn: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  sendInput: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: 'monospace' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, padding: 20, maxHeight: '70%' },
  deviceItem: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
});
