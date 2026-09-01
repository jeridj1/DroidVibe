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
  openSerial,
  closeSerial,
  capture,
  isNativeUsbAvailable,
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

const HOOKUP_GUIDES: Record<string, string[]> = {
  'logic-analyzer': [
    'GP2 -> CH0 (signal under test)',
    'GP3 -> CH1',
    'GP4 -> CH2',
    'GP5 -> CH3',
    'GP6 -> CH4',
    'GP7 -> CH5',
    'GP8 -> CH6',
    'GP9 -> CH7',
    'GND -> target GND',
  ],
  swd: [
    'GP2 -> SWDIO (target SWDIO)',
    'GP3 -> SWCLK (target SWCLK)',
    'GND -> target GND',
    '3V3 -> target VCC (optional)',
  ],
  jtag: [
    'GP2 -> TCK (target TCK)',
    'GP3 -> TMS (target TMS)',
    'GP4 -> TDI (target TDI)',
    'GP5 -> TDO (target TDO)',
    'GND -> target GND',
    '3V3 -> target VCC (optional)',
  ],
  'avr-isp': [
    'GP2 -> RESET (target RESET)',
    'GP3 -> SCK (target SCK)',
    'GP4 -> MISO (target MISO)',
    'GP5 -> MOSI (target MOSI)',
    'GND -> target GND',
  ],
  'serial-bridge': [
    'GP0 -> target RX',
    'GP1 -> target TX',
    'GND -> target GND',
  ],
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
    const interval = setInterval(() => {
      listDevices().then(setDevices).catch(() => {});
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const bootsel = devices.find(d => d.bootsel || d.isRp2040);
    if (bootsel) {
      setPicoBootsel(bootsel.bootsel);
      if (!connectedDevice) setConnectedDevice(bootsel);
    }
  }, [devices]);

  async function preparePico() {
    const pico = devices.find(d => d.bootsel);
    if (!pico) {
      Alert.alert(
        'No Pico in BOOTSEL mode',
        'Hold the BOOTSEL button on your Raspberry Pi Pico while plugging it in, then try again.',
      );
      return;
    }
    setFlashing(true);
    setFlashMsg('Flashing ' + selectedMode + ' helper firmware...');
    try {
      Alert.alert(
        'Helper Firmware Required',
        'The ' + selectedMode + ' helper firmware needs to be compiled from the Pico SDK source in firmware/ and bundled into the app. See firmware/README.md for build instructions.\n\nThe PICOBOOT flash pipeline is ready — once the UF2 is bundled, this button will flash it instantly.',
      );
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
      const opened = await openSerial(pico.id, {
        baudRate: 115200,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        dtr: false,
        rts: false,
      });
      if (!opened) {
        setCaptureError('Could not open serial to the Pico. Check USB permission.');
        setCapturing(false);
        return;
      }
      const result = await capture({
        deviceId: pico.id,
        sampleRate,
        numSamples,
        channels,
        trigger: { type: 'none' },
      });
      const samples = Array.from(result.data.slice(0, Math.min(result.actualSamples, 4096)));
      setCaptureData(samples);
      await closeSerial(pico.id);
    } catch (e) {
      setCaptureError((e as Error).message || 'Capture failed');
    } finally {
      setCapturing(false);
    }
  }

  const guide = HOOKUP_GUIDES[selectedMode] || [];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 32 }}
    >
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, marginBottom: 12 }}>
        {(['monitor', 'plotter', 'logic'] as BenchTab[]).map(t => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={{
              flex: 1,
              paddingVertical: 10,
              alignItems: 'center',
              backgroundColor: tab === t ? palette.accent : palette.bgInset,
              borderRadius: 10,
              marginRight: 6,
            }}
          >
            <Text style={{
              color: tab === t ? palette.textOnAccent : palette.textMuted,
              fontSize: 13,
              fontWeight: '700',
              textTransform: 'capitalize',
            }}>{t}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'monitor' && (
        <View style={{ paddingHorizontal: 16 }}>
          <SectionTitle title="Serial Monitor" subtitle="Real-time serial output" />
          <Card>
            <Text style={{ color: palette.textMuted, fontSize: 13 }}>
              {connectedDevice
                ? 'Connected to ' + (connectedDevice.productName || connectedDevice.id)
                : 'No device connected. Go to the Devices tab to connect.'}
            </Text>
          </Card>
        </View>
      )}

      {tab === 'plotter' && (
        <View style={{ paddingHorizontal: 16 }}>
          <SectionTitle title="Serial Plotter" subtitle="Live numeric graphs" />
          <Card>
            <WaveformViewer mode="plot" palette={palette} dataSource={connectedDevice ? 'serial' : 'demo'} />
            <Text style={{ color: palette.textMuted, fontSize: 12, marginTop: 8 }}>
              {connectedDevice
                ? 'Streaming from connected device'
                : 'Plotter shows demo data. Connect a board and stream values via Serial.print() to see live plots.'}
            </Text>
          </Card>
        </View>
      )}

      {tab === 'logic' && (
        <View style={{ paddingHorizontal: 16 }}>
          <SectionTitle
            title="RP2040 Tools"
            subtitle={nativeUsb ? 'Universal programmer & analyzer' : 'Requires native USB build'}
          />

          {!nativeUsb && (
            <Card style={{ marginBottom: 12, borderLeftWidth: 3, borderLeftColor: palette.danger }}>
              <Text style={{ color: palette.danger, fontWeight: '600', fontSize: 13 }}>
                Native USB unavailable (Expo Go)
              </Text>
              <Text style={{ color: palette.textMuted, fontSize: 12, marginTop: 4 }}>
                Build a DroidVibe dev/production APK for hardware access. See docs/DEPLOYMENT.md.
              </Text>
            </Card>
          )}

          <Card style={{ marginBottom: 12 }}>
            <Text style={{ color: palette.text, fontWeight: '600', marginBottom: 8 }}>Select Mode</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {RP2040_MODES.map(m => (
                <Pressable
                  key={m.mode}
                  onPress={() => setSelectedMode(m.mode)}
                  style={{
                    backgroundColor: selectedMode === m.mode ? palette.accent : palette.bgInset,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 10,
                  }}
                >
                  <Text style={{
                    color: selectedMode === m.mode ? palette.textOnAccent : palette.textMuted,
                    fontSize: 12,
                    fontWeight: '700',
                  }}>{m.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={{ color: palette.textMuted, fontSize: 12, marginTop: 6 }}>
              {RP2040_MODES.find(m => m.mode === selectedMode)?.desc}
            </Text>
          </Card>

          <Card style={{ marginBottom: 12 }}>
            <Text style={{ color: palette.text, fontWeight: '600', marginBottom: 6 }}>
              Hookup Guide — {RP2040_MODES.find(m => m.mode === selectedMode)?.label}
            </Text>
            <View style={{ backgroundColor: palette.bgInset, borderRadius: 8, padding: 10 }}>
              {guide.map((line, i) => (
                <Text key={i} style={{
                  color: palette.text,
                  fontFamily: 'monospace',
                  fontSize: 11,
                  lineHeight: 18,
                }}>{line}</Text>
              ))}
            </View>
          </Card>

          <Card style={{ marginBottom: 12 }}>
            <Row justify="space-between" style={{ marginBottom: 8 }}>
              <View>
                <Text style={{ color: palette.text, fontWeight: '600' }}>Prepare Pico</Text>
                <Text style={{ color: palette.textMuted, fontSize: 12 }}>
                  Flash the {selectedMode} helper firmware via PICOBOOT
                </Text>
              </View>
              <Badge
                label={picoBootsel ? 'BOOTSEL ready' : 'waiting'}
                tone={picoBootsel ? 'success' : 'warn'}
              />
            </Row>
            <Button
              title={flashing ? 'Flashing...' : 'Prepare Pico'}
              onPress={preparePico}
              disabled={flashing || !picoBootsel}
              loading={flashing}
            />
            {flashMsg && (
              <Text style={{ color: palette.accent, fontSize: 12, marginTop: 6 }}>{flashMsg}</Text>
            )}
            <Text style={{ color: palette.textMuted, fontSize: 11, marginTop: 8 }}>
              Hold BOOTSEL while plugging in the Pico. After flashing, it reboots into the selected mode.
            </Text>
          </Card>

          {selectedMode === 'logic-analyzer' && (
            <>
              <SectionTitle title="Logic analyzer" subtitle="RP2040 capture · zoom · cursors · protocol decode" />

              <Card style={{ marginBottom: 12 }}>
                <Text style={{ color: palette.text, fontWeight: '600', marginBottom: 8 }}>Capture Settings</Text>
                <Row style={{ marginBottom: 8 }}>
                  <Text style={{ color: palette.textMuted, fontSize: 12 }}>Sample Rate:</Text>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <TextInput
                      style={{
                        borderWidth: 1,
                        borderColor: 'rgba(150,150,150,0.3)',
                        borderRadius: 8,
                        padding: 6,
                        color: palette.text,
                        fontSize: 13,
                      }}
                      value={String(sampleRate)}
                      onChangeText={v => setSampleRate(parseInt(v) || 1000000)}
                      keyboardType="numeric"
                    />
                  </View>
                  <Text style={{ color: palette.textMuted, fontSize: 11, marginLeft: 4 }}>Hz</Text>
                </Row>
                <Row style={{ marginBottom: 8 }}>
                  <Text style={{ color: palette.textMuted, fontSize: 12 }}>Samples:</Text>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <TextInput
                      style={{
                        borderWidth: 1,
                        borderColor: 'rgba(150,150,150,0.3)',
                        borderRadius: 8,
                        padding: 6,
                        color: palette.text,
                        fontSize: 13,
                      }}
                      value={String(numSamples)}
                      onChangeText={v => setNumSamples(parseInt(v) || 8192)}
                      keyboardType="numeric"
                    />
                  </View>
                </Row>
                <Row style={{ marginBottom: 8 }}>
                  <Text style={{ color: palette.textMuted, fontSize: 12 }}>Channels:</Text>
                  <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginLeft: 8 }}>
                    {[1, 2, 4, 8].map(c => (
                      <Pressable
                        key={c}
                        onPress={() => setChannels(c)}
                        style={{
                          backgroundColor: channels === c ? palette.accent : palette.bgInset,
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 8,
                        }}
                      >
                        <Text style={{
                          color: channels === c ? palette.textOnAccent : palette.textMuted,
                          fontSize: 12,
                          fontWeight: '700',
                        }}>{c}</Text>
                      </Pressable>
                    ))}
                  </View>
                </Row>
                <Button
                  title={capturing ? 'Capturing...' : 'Start Capture'}
                  onPress={doCapture}
                  disabled={capturing || !nativeUsb}
                  loading={capturing}
                />
                {captureError && (
                  <Text style={{ color: palette.danger, fontSize: 12, marginTop: 6 }}>{captureError}</Text>
                )}
              </Card>

              <Card style={{ marginBottom: 12 }}>
                <WaveformViewer
                  mode="logic"
                  palette={palette}
                  dataSource={captureData ? 'serial' : 'demo'}
                />
                <Text style={{ color: palette.textMuted, fontSize: 12, marginTop: 8 }}>
                  {captureData
                    ? captureData.length + ' samples captured. Use pinch to zoom, drag to pan.'
                    : 'Waveform shows a demo signal. Flash the LA helper firmware and start a capture for real data.'}
                </Text>
              </Card>
            </>
          )}

          {(selectedMode === 'swd' || selectedMode === 'jtag') && (
            <Card style={{ marginBottom: 12 }}>
              <Text style={{ color: palette.text, fontWeight: '600', marginBottom: 6 }}>
                {selectedMode.toUpperCase()} Programmer
              </Text>
              <Text style={{ color: palette.textMuted, fontSize: 12 }}>
                After flashing the {selectedMode} helper firmware, the Pico acts as a {selectedMode.toUpperCase()} programmer.
                Connect the target according to the hookup guide above, then use the Editor tab to compile firmware
                for your target board. The upload function will route through the {selectedMode} protocol.
              </Text>
              <Divider />
              <Text style={{ color: palette.textMuted, fontSize: 12, marginTop: 4 }}>
                Supported targets: {selectedMode === 'swd' ? 'ARM Cortex-M0/M0+/M3/M4/M7 (RP2040, STM32, nRF52, etc.)' : 'Any JTAG-capable device'}
              </Text>
            </Card>
          )}

          {selectedMode === 'avr-isp' && (
            <Card style={{ marginBottom: 12 }}>
              <Text style={{ color: palette.text, fontWeight: '600', marginBottom: 6 }}>AVR ISP Programmer</Text>
              <Text style={{ color: palette.textMuted, fontSize: 12 }}>
                After flashing the AVR-ISP helper firmware, the Pico acts as an AVR ISP programmer.
                Connect the target AVR chip according to the hookup guide, then use the Editor tab to
                compile and upload firmware via the STK500v1 protocol.
              </Text>
            </Card>
          )}
        </View>
      )}
    </ScrollView>
  );
}
