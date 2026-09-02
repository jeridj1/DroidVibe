import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme/ThemeProvider';
import { SectionTitle, Card, Badge, Row, Button, Divider } from '@/src/components/ui';
import { WaveformViewer } from '@/src/components/WaveformViewer';
import {
  listDevices,
  requestPermission,
  openSerial,
  closeSerial,
  capture,
  isNativeUsbAvailable,
  flashHelperFirmwareFromAsset,
} from '@/src/lib/transport';
import type { UsbDevice, RP2040HelperMode } from '@droidvibe/shared';

type BenchTab = 'monitor' | 'plotter' | 'logic';

const RP2040_MODES: { mode: RP2040HelperMode; label: string; desc: string }[] = [
  { mode: 'logic-analyzer', label: 'Logic Analyzer', desc: '8-channel GPIO capture' },
  { mode: 'swd', label: 'SWD Programmer', desc: 'ARM Cortex-M debug' },
  { mode: 'jtag', label: 'JTAG Programmer', desc: 'JTAG boundary scan' },
  { mode: 'avr-isp', label: 'AVR ISP', desc: 'SPI ISP for AVR chips' },
  { mode: 'serial-bridge', label: 'Serial Bridge', desc: 'USB-serial passthrough' },
];

const FIRMWARE_ASSET_PATHS: Record<RP2040HelperMode, string | null> = {
  'logic-analyzer': 'firmware/logic_analyzer_helper.uf2',
  'swd': 'firmware/swd_helper.uf2',
  'jtag': 'firmware/jtag_helper.uf2',
  'avr-isp': 'firmware/avr_isp_helper.uf2',
  'serial-bridge': null,
};

const HOOKUP_GUIDES: Record<string, string[]> = {
  'logic-analyzer': ['GP2 -> CH0 (signal under test)', 'GP3 -> CH1', 'GP4 -> CH2', 'GP5 -> CH3', 'GP6 -> CH4', 'GP7 -> CH5', 'GP8 -> CH6', 'GP9 -> CH7', 'GND -> target GND'],
  swd: ['GP2 -> SWDIO (target SWDIO)', 'GP3 -> SWCLK (target SWCLK)', 'GND -> target GND', '3V3 -> target VCC (optional)'],
  jtag: ['GP2 -> TCK (target TCK)', 'GP3 -> TMS (target TMS)', 'GP4 -> TDI (target TDI)', 'GP5 -> TDO (target TDO)', 'GND -> target GND', '3V3 -> target VCC (optional)'],
  'avr-isp': ['GP2 -> RESET (target RESET)', 'GP3 -> SCK (target SCK)', 'GP4 -> MISO (target MISO)', 'GP5 -> MOSI (target MOSI)', 'GND -> target GND'],
  'serial-bridge': ['GP0 -> target RX', 'GP1 -> target TX', 'GND -> target GND'],
};

export default function BenchScreen() {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<BenchTab>('logic');
  const [connectedDevice, setConnectedDevice] = useState<UsbDevice | null>(null);
  const [devices, setDevices] = useState<UsbDevice[]>([]);
  const [nativeUsb] = useState(isNativeUsbAvailable());
  const [selectedMode, setSelectedMode] = useState<RP2040HelperMode>('logic-analyzer');
  const [picoBootsel, setPicoBootsel] = useState(false);
  const [flashing, setFlashing] = useState(false);
  const [flashMsg, setFlashMsg] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [captureData, setCaptureData] = useState<number[] | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [sampleRate, setSampleRate] = useState(1000000);
  const [numSamples, setNumSamples] = useState(8192);
  const [channels, setChannels] = useState(8);

  useEffect(() => {
    listDevices().then(setDevices).catch(() => {});
    const interval = setInterval(() => listDevices().then(setDevices).catch(() => {}), 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const pico = devices.find(d => d.bootsel || d.isRp2040);
    if (pico) {
      setPicoBootsel(pico.bootsel);
      if (!connectedDevice) setConnectedDevice(pico);
    }
  }, [devices]);

  async function preparePico() {
    const pico = devices.find(d => d.bootsel);
    if (!pico) {
      Alert.alert('No Pico in BOOTSEL mode', 'Hold the BOOTSEL button on your Raspberry Pi Pico while plugging it in, then try again.');
      return;
    }
    const assetPath = FIRMWARE_ASSET_PATHS[selectedMode];
    if (!assetPath) {
      Alert.alert('No Firmware Needed', 'Serial Bridge mode works with the default Pico firmware.');
      return;
    }
    setFlashing(true);
    setFlashMsg('Requesting USB access...');
    try {
      if (pico.permission !== 'granted') {
        const allowed = await requestPermission(pico.id);
        if (!allowed) throw new Error('USB permission was denied');
      }
      setFlashMsg('Flashing ' + selectedMode + ' helper firmware...');
      const result = await flashHelperFirmwareFromAsset(pico.id, assetPath, true);
      setFlashMsg(result.ok ? selectedMode + ' firmware flashed successfully. Reconnect or wait for the Pico to reboot.' : 'Flash failed: ' + result.message);
    } catch (e) {
      setFlashMsg('Flash failed: ' + (e as Error).message);
    } finally {
      setFlashing(false);
    }
  }

  async function doCapture() {
    const pico = devices.find(d => d.isRp2040 && !d.bootsel);
    if (!pico) {
      setCaptureError('No RP2040 in application mode found. Flash the LA helper firmware first (Prepare Pico).');
      return;
    }
    setCapturing(true);
    setCaptureError(null);
    setCaptureData(null);
    try {
      if (pico.permission !== 'granted') {
        const allowed = await requestPermission(pico.id);
        if (!allowed) throw new Error('USB permission was denied');
      }
      const opened = await openSerial(pico.id, { baudRate: 115200, dataBits: 8, stopBits: 1, parity: 'none', dtr: false, rts: false });
      if (!opened) throw new Error('Could not open the Pico serial interface');
      const result = await capture({ deviceId: pico.id, sampleRate, numSamples, channels, triggerType: 'none', triggerChannel: 0, triggerEdge: 'rising' });
      setCaptureData(Array.from(result.data));
      await closeSerial(pico.id);
    } catch (e) {
      setCaptureError((e as Error).message);
    } finally {
      setCapturing(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, paddingTop: insets.top + 8 }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <SectionTitle title="RP2040 Bench" subtitle={nativeUsb ? 'USB hardware tools' : 'Native USB requires the installed DroidVibe APK'} />
        <Card>
          <Text style={[styles.heading, { color: palette.text }]}>Mode</Text>
          <View style={styles.wrap}>
            {RP2040_MODES.map(m => <Pressable key={m.mode} onPress={() => setSelectedMode(m.mode)} style={[styles.mode, { borderColor: selectedMode === m.mode ? palette.accent : palette.border }]}><Text style={{ color: palette.text, fontWeight: '700' }}>{m.label}</Text><Text style={{ color: palette.textMuted, fontSize: 11 }}>{m.desc}</Text></Pressable>)}
          </View>
          <Button title={flashing ? 'Flashing…' : 'Prepare Pico'} onPress={preparePico} disabled={flashing || !nativeUsb} />
          {flashMsg && <Text style={{ color: palette.textMuted, marginTop: 8 }}>{flashMsg}</Text>}
        </Card>
        {selectedMode === 'logic-analyzer' && <Card>
          <Text style={[styles.heading, { color: palette.text }]}>Logic analyzer</Text>
          <Text style={{ color: palette.textMuted }}>GP2 through GP9 are sampled by RP2040 PIO and streamed over USB.</Text>
          <Row gap={8} style={{ marginTop: 10 }}><Text style={{ color: palette.text }}>Rate</Text><TextInput value={String(sampleRate)} onChangeText={v => setSampleRate(Math.max(1, Math.min(10000000, Number(v) || 1)))} keyboardType="numeric" style={[styles.input, { color: palette.text, borderColor: palette.border }]} /><Text style={{ color: palette.text }}>Samples</Text><TextInput value={String(numSamples)} onChangeText={v => setNumSamples(Math.max(1, Math.min(32768, Number(v) || 1)))} keyboardType="numeric" style={[styles.input, { color: palette.text, borderColor: palette.border }]} /></Row>
          <Button title={capturing ? 'Capturing…' : 'Capture'} onPress={doCapture} disabled={capturing || !nativeUsb} />
          {captureError && <Text style={{ color: palette.danger, marginTop: 8 }}>{captureError}</Text>}
          {captureData && <WaveformViewer data={captureData} sampleRate={sampleRate} channels={channels} />}
        </Card>}
        <Card>
          <Text style={[styles.heading, { color: palette.text }]}>Connection</Text>
          <Text style={{ color: palette.textMuted }}>{connectedDevice ? `${connectedDevice.productName ?? 'RP2040'} · ${picoBootsel ? 'BOOTSEL' : 'application mode'}` : 'No RP2040 detected'}</Text>
          {(HOOKUP_GUIDES[selectedMode] ?? []).map((line, i) => <Text key={i} style={{ color: palette.textMuted, marginTop: 4 }}>{line}</Text>)}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  heading: { fontSize: 16, fontWeight: '800', marginBottom: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  mode: { borderWidth: 1, borderRadius: 10, padding: 10, minWidth: '45%' },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, minWidth: 90 },
});
