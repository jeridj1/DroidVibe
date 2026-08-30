import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import type { Palette } from '@/src/theme/colors';

interface Props {
  mode: 'plotter' | 'logic';
  palette: Palette;
  /** Marks the viewer as displaying demo/synthetic data */
  dataSource?: 'demo' | 'serial' | 'capture';
  /** Optional real numeric data for plotter mode (overrides demo) */
  seriesData?: number[];
}

/**
 * Lightweight waveform viewer rendered with plain Views (no Skia/SVG
 * dependency). Supports a demo numeric series for the plotter and a demo
 * 8-channel digital capture for the logic analyzer.
 *
 * When dataSource is 'demo' (the default), a prominent "DEMO DATA" badge
 * is displayed so users never mistake generated data for real hardware
 * measurements.
 */
export function WaveformViewer({ mode, palette, dataSource = 'demo', seriesData }: Props) {
  const [zoom, setZoom] = useState(1);
  const [cursorA, setCursorA] = useState(30);
  const [cursorB, setCursorB] = useState(70);

  const sampleCount = Math.floor(240 * zoom);
  const isDemo = dataSource === 'demo';

  if (mode === 'plotter') {
    const series = seriesData ?? useMemoSeries(sampleCount);
    const min = -1.1, max = 1.1;
    return (
      <View style={{ flex: 1, padding: 6 }}>
        {isDemo && <DemoBadge palette={palette} />}
        <View style={{ flex: 1, flexDirection: 'row' }}>
          {series.map((v, i) => {
            const h = ((v - min) / (max - min)) * 100;
            return <View key={i} style={{ flex: 1, justifyContent: 'flex-end' }}>
              <View style={{ height: Math.max(2, Math.min(100, h)) + '%', backgroundColor: palette.accent, borderRadius: 2 } as ViewStyle} />
            </View>;
          })}
        </View>
        <ZoomBar zoom={zoom} setZoom={setZoom} palette={palette} />
      </View>
    );
  }

  // logic analyzer — 8 digital channels
  const channels = 8;
  const rows = Array.from({ length: channels }, (_, ch) =>
   
 Array.from({ length: sampleCount }, (_, i) => {
      if (ch === 0) return uartFrame(i, sampleCount);
      return (((i >> ch) + ch) % 4 < 2) ? 1 : 0;
    }),
  );
  const delta = Math.abs(cursorB - cursorA);
  const freq = delta > 0 ? (1000 / delta).toFixed(1) : '—';

  return (
    <View style={{ flex: 1, padding: 6 }}>
      {isDemo && <DemoBadge palette={palette} />}
      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        {rows.map((row, ch) => (
          <View key={ch} style={{ height: 18, flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: palette.textMuted, fontSize: 9, width: 28 }}>CH{ch}</Text>
            <View style={{ flex: 1, height: 16, flexDirection: 'row', alignItems: 'center' }}>
              {row.map((bit, i) => (
                <View key={i} style={{
                  flex: 1, height: bit ? 12 : 2, backgroundColor: bit ? palette.accent : palette.accentDim,
                  alignSelf: bit ? 'flex-start' : 'flex-end', borderRadius: 1,
                }} />
              ))}
            </View>
          </View>
        ))}
      </View>

      <View style={{ height: 2, backgroundColor: palette.danger, opacity: 0.5, marginVertical: 4, marginLeft: cursorA + '%' } as ViewStyle} />
      <View style={{ height: 2, backgroundColor: palette.typeColor, opacity: 0.5, marginBottom: 4, marginLeft: cursorB + '%' } as ViewStyle} />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: palette.monoText, fontSize: 10 }}>{'\u0394t = ' + delta + ' samples'}</Text>
        <Text style={{ color: palette.monoText, fontSize: 10 }}>{'f \u2248 ' + freq + ' Hz'}</Text>
      </View>

      <View style={{ marginTop: 6, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Pressable onPress={() => setCursorA((c) => (c + 10) % 100)}><Text style={{ color: palette.accent, fontSize: 10 }}>{'\u25C0 A \u25B6'}</Text></Pressable>
        <Pressable onPress={() => setCursorB((c) => (c + 10) % 100)}><Text style={{ color: palette.accent, fontSize: 10 }}>{'\u25C0 B \u25B6'}</Text></Pressable>
      </View>

      {isDemo && (
        <View style={{ marginTop: 6 }}>
          <Text style={{ color: palette.stringColor, fontSize: 9, fontFamily: 'monospace' }}>UART: 0xA5 0x3C 0x7F</Text>
          <Text style={{ color: palette.highlight, fontSize: 9, fontFamily: 'monospace' }}>I2C: START 0x50 ACK</Text>
          <Text style={{ color: palette.numberColor, fontSize: 9, fontFamily: 'monospace' }}>SPI: 0xFF 0x00</Text>
        </View>
      )}

      <ZoomBar zoom={zoom} setZoom={setZoom} palette={palette} />
    </View>
  );
}

function DemoBadge({ palette }: { palette: Palette }) {
  return (
    <View style={{ position: 'absolute', top: 4, right: 4, zIndex: 1, backgroundColor: palette.warning + '33', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: palette.warning }}>
      <Text style={{ color: palette.warning, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 }}>DEMO DATA</Text>
    </View>
  );
}

function ZoomBar({ zoom, setZoom, palette }: { zoom: number; setZoom: (n: number) => void; palette: Palette }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 }}>
      <Pressable onPress={() => setZoom(Math.max(0.4, zoom - 0.2))} style={styles.zb}>
        <Text style={{ color: palette.accent, fontWeight: '800' }}>{'\u2212'}</Text>
      </Pressable>
      <Text style={{ color: palette.monoText, fontSize: 10, marginHorizontal: 6, alignSelf: 'center' }}>{zoom.toFixed(1) + '\u00D7'}</Text>
      <Pressable onPress={() => setZoom(Math.min(4, zoom + 0.2))} style={styles.zb}>
        <Text style={{ color: palette.accent, fontWeight: '800' }}>+</Text>
      </Pressable>
    </View>
  );
}

function uartFrame(i: number, n: number): number {
  const p = (i / n) * 30;
  const phase = p % 10;
  if (phase < 1) return 0;
  if (phase < 9) return ((phase | 0) %
 2);
  return 1;
}

function useMemoSeries(n: number): number[] {
  return Array.from({ length: n }, (_, i) => Math.sin(i * 0.18) * Math.cos(i * 0.05));
}

const styles = StyleSheet.create({
  zb: { width: 24, height: 24, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
});