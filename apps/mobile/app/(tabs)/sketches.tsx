import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme/ThemeProvider';
import { Card, Badge, Button, Row, SectionTitle } from '@/src/components/ui';
import { api } from '@/src/lib/api';

interface SketchItem { id: string; name: string; fqbn: string; port: string | null; updatedAt: string; }

const EXAMPLE_PRESETS = [
  { id: 'blink', name: 'Blink', fqbn: 'arduino:avr:uno', board: 'Arduino Uno' },
  { id: 'serial-test', name: 'SerialTest', fqbn: 'arduino:avr:uno', board: 'Arduino Uno' },
  { id: 'analog-read', name: 'AnalogRead', fqbn: 'arduino:avr:uno', board: 'Arduino Uno' },
  { id: 'pico-blink', name: 'PicoBlink', fqbn: 'rp2040:rp2040:rpipico', board: 'Raspberry Pi Pico' },
];

export default function SketchesScreen() {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const [cloud, setCloud] = useState<SketchItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let active = true;
    api.sketches
      .list()
      .then((r) => active && (setCloud((r as any).sketches ?? []), setOffline(false)))
      .catch(() => active && setOffline(true))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: palette.text }]}>Sketches</Text>
          <Text style={{ color: palette.textMuted, fontSize: 13 }}>
            Cloud projects · examples · templates
          </Text>
        </View>
        <Button title="New" onPress={() => {}} />
      </View>

      <FlatList
        ListHeaderComponent={
          <>
            <SectionTitle title="Start from an example" subtitle="Curated starter sketches" />
            <FlatList
              horizontal
              data={EXAMPLE_PRESETS}
              keyExtractor={(i) => i.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 8 }}
              renderItem={({ item }) => (
                <Pressable style={{ marginRight: 10 }}>
                  <Card style={{ width: 180 }}>
                    <Text style={{ color: palette.text, fontWeight: '700' }}>{item.name}</Text>
                    <Text style={{ color: palette.textMuted, fontSize: 12, marginTop: 2 }}>{item.board}</Text>
                    <View style={{ marginTop: 8 }}><Badge label={item.fqbn} tone="accent" /></View>
                  </Card>
                </Pressable>
              )}
            />

            <View style={{ height: 16 }} />
            <SectionTitle title="Cloud sketches" subtitle={offline ? 'Backend offline — showing local only' : undefined} />
            {loading && <ActivityIndicator color={palette.accent} />}
            {offline && <Text style={{ color: palette.warning, fontSize: 13 }}>Backend unreachable. Start the server (pnpm web:dev).</Text>}
          </>
        }
        data={cloud ?? []}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <Card style={{ marginBottom: 10 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: palette.text, fontWeight: '700', fontSize: 15 }}>{item.name}</Text>
                <Text style={{ color: palette.textMuted, fontSize: 12 }}>{item.fqbn}</Text>
              </View>
              <Badge label={item.port ? item.port : 'no port'} tone="neutral" />
            </Row>
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: '800' },
});
