import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Palette } from '@/src/theme/colors';

interface Props { mode: 'plotter' | 'logic'; palette: Palette; }

/**
 * Lightweight waveform viewer rendered with plain Views (no Skia/SVG
 * dependency). Demonstrates the bench visual language: pinch-style zoom
 * buttons, dual cursors with delta-time, and UART/I2C/SPI decode lanes for
 * the logic-analyzer mode. The plotter shows a demo numeric series; the
 * logic analyzer shows a demo 8-channel digital capture.
 */
export function WaveformViewer({ mode, palette }: Props) {
  const [zoom, setZoom] = useState(1);
  const [cursorA, setCursorA] = useState(30);
  const [cursorB, setCursorB] = useState(70);

  const sampleCount = Math.floor(240 * zoom);

  if (mode === 'plotter') {
    const series = useMemoSeries(sampleCount);
    const min = -1.1, max = 1.1;
    return (
      <View style={{ flex: 1, padding: 6 }}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          {series.map((v, i) => {
            const h = ((v - min) / (max - min)) * 100;
            return <View key={i} style={{ flex: 1, justifyContent: 'flex-end' }}>
              <View style={{ height: `${Math.max(2, Math.min(100, h))}%`, backgroundColor: palette.accent, borderRadius: 2 }} />
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
      // deterministic demo: square waves with different periods + a UART frame
      if (ch === 0) return uartFrame(i, sampleCount);
      return (((i >> ch) + ch) % 4 < 2) ? 1 : 0;
    }),
  );
  const delta = Math.abs(cursorB - cursorA);
  const freq = delta > 0 ? (1000 / delta).toFixed(1) : '—';

  return (
    <View style={{ flex: 1, padding: 6 }}>
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

      <View style={{ height: 2, backgroundColor: palette.danger, opacity: 0.5, marginVertical: 4, marginLeft: `${cursorA}%` }} />
      <View style={{ height: 2, backgroundColor: palette.typeColor, opacity: 0.5, marginBottom: 4, marginLeft: `${cursorB}%` }} />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: palette.monoText, fontSize: 10 }}>Δt = {delta} samples</Text>
        <Text style={{ color: palette.monoText, fontSize: 10 }}>f ≈ {freq} Hz</Text>
      </View>

      <View style={{ marginTop: 6, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Pressable onPress={() => setCursorA((c) => (c + 10) % 100)}><Text style={{ color: palette.accent, fontSize: 10 }}>◀ A ▶</Text></Pressable>
        <Pressable onPress={() => setCursorB((c) => (c + 10) % 100)}><Text style={{ color: palette.accent, fontSize: 10 }}>◀ B ▶</Text></Pressable>
      </View>

      <View style={{ marginTop: 6 }}>
        <Text style={{ color: palette.stringColor, fontSize: 9, fontFamily: 'monospace' }}>UART: 0xA5 0x3C 0x7F</Text>
        <Text style={{ color: palette.highlight, fontSize: 9, fontFamily: 'monospace' }}>I2C: START 0x50 ACK</Text>
        <Text style={{ color: palette.numberColor, fontSize: 9, fontFamily: 'monospace' }}>SPI: 0xFF 0x00</Text>
      </View>

      <ZoomBar zoom={zoom} setZoom={setZoom} palette={palette} />
    </View>
  );
}

function ZoomBar({ zoom, setZoom, palette }: { zoom: number; setZoom: (n: number) => void; palette: Palette }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 }}>
      <Pressable onPress={() => setZoom((z) => Math.max(0.4, z - 0.2))} style={styles.zb}>
        <Text style={{ color: palette.accent, fontWeight: '800' }}>−</Text>
      </Pressable>
      <Text style={{ color: palette.monoText, fontSize: 10, marginHorizontal: 6, alignSelf: 'center' }}>{zoom.toFixed(1)}×</Text>
      <Pressable onPress={() => setZoom((z) => Math.min(4, z + 0.2))} style={styles.zb}>
        <Text style={{ color: palette.accent, fontWeight: '800' }}>+</Text>
      </Pressable>
    </View>
  );
}

function uartFrame(i: number, n: number): number {
  // start bit + 8 data + stop, roughly centered
  const p = (i / n) * 30;
  const phase = p % 10;
  if (phase < 1) return 0; // start
  if (phase < 9) return ((phase | 0) % 2); // data bits
  return 1; // stop/idle
}

function useMemoSeries(n: number): number[] {
  return Array.from({ length: n }, (_, i) => Math.sin(i * 0.18) * Math.cos(i * 0.05));
}

const styles = StyleSheet.create({
  zb: { width: 24, height: 24, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
});
