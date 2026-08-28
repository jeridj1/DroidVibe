import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme/ThemeProvider';
import { Card, Badge, Button, Row, SectionTitle } from '@/src/components/ui';
import { WaveformViewer } from '@/src/components/WaveformViewer';

type Tab = 'serial' | 'plotter' | 'logic';

export default function BenchScreen() {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('serial');
  const [paused, setPaused] = useState(false);
  const [lines, setLines] = useState<string[]>(['> Serial monitor ready.', '> Connect a board to stream data.']);

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.text }]}>Bench</Text>
        <Row>
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
            <SectionTitle title="Serial monitor" subtitle="Live UART output (115200 8N1)" />
            <Card style={{ minHeight: 240, backgroundColor: palette.monoBg, borderColor: palette.surfaceBorder }}>
              <Text style={{ color: palette.monoText, fontFamily: 'monospace', fontSize: 12, lineHeight: 16 }}>
                {lines.join('\n')}
              </Text>
            </Card>
            <Row style={{ marginTop: 8 }}>
              <Button title={paused ? 'Resume' : 'Pause'} onPress={() => setPaused((v) => !v)} variant="ghost" />
              <View style={{ width: 8 }} />
              <Button title="Clear" onPress={() => setLines(['> cleared'])} variant="ghost" />
              <View style={{ flex: 1 }} />
              <Button title="Export" onPress={() => {}} variant="ghost" />
            </Row>
          </>
        )}

        {tab === 'plotter' && (
          <>
            <SectionTitle title="Serial plotter" subtitle="Numeric values per line, one series per column" />
            <Card style={{ height: 260, padding: 8, backgroundColor: palette.monoBg }}>
              <WaveformViewer mode="plotter" palette={palette} />
            </Card>
            <Row style={{ marginTop: 8 }}>
              <Button title={paused ? 'Resume' : 'Pause'} onPress={() => setPaused((v) => !v)} variant="ghost" />
              <View style={{ flex: 1 }} />
              <Button title="Export CSV" onPress={() => {}} variant="ghost" />
            </Row>
          </>
        )}

        {tab === 'logic' && (
          <>
            <SectionTitle title="Logic analyzer" subtitle="RP2040 capture · zoom · cursors · protocol decode" />
            <Card style={{ height: 260, padding: 8, backgroundColor: palette.monoBg }}>
              <WaveformViewer mode="logic" palette={palette} />
            </Card>
            <Row style={{ marginTop: 8, flexWrap: 'wrap' }}>
              <Badge label="UART" tone="accent" />
              <View style={{ width: 6 }} />
              <Badge label="I2C" tone="accent" />
              <View style={{ width: 6 }} />
              <Badge label="SPI" tone="accent" />
            </Row>
            <Text style={{ color: palette.warning, fontSize: 12, marginTop: 8 }}>
              Capture requires a verified RP2040 helper firmware image (not bundled). Waveform shows a demo signal.
            </Text>
            <Row style={{ marginTop: 8 }}>
              <Button title="Export capture" onPress={() => {}} variant="ghost" />
            </Row>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10 },
  title: { fontSize: 26, fontWeight: '800' },
  seg: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, marginLeft: 6 },
});
