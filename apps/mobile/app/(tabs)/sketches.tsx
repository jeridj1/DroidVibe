import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme/ThemeProvider';
import { Card, Badge, Button, Row, SectionTitle } from '@/src/components/ui';
import { api } from '@/src/lib/api';
import { setPendingSketch } from '@/src/lib/sketchBridge';
import { getLocalSketches, deleteLocalSketch, type LocalSketch } from '@/src/lib/offlineSketches';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SketchItem { id: string; name: string; fqbn: string; port: string | null; updatedAt: number; }

const EXAMPLE_PRESETS = [
  { id: 'blink', name: 'Blink', fqbn: 'arduino:avr:uno', board: 'Arduino Uno' },
  { id: 'serial-test', name: 'SerialTest', fqbn: 'arduino:avr:uno', board: 'Arduino Uno' },
  { id: 'analog-read', name: 'AnalogRead', fqbn: 'arduino:avr:uno', board: 'Arduino Uno' },
  { id: 'pico-blink', name: 'PicoBlink', fqbn: 'rp2040:rp2040:rpipico', board: 'Raspberry Pi Pico' },
];

const EXAMPLE_CODE: Record<string, string> = {
  blink: '// DroidVibe \u2014 Blink\nvoid setup() {\n  pinMode(LED_BUILTIN, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(LED_BUILTIN, HIGH);\n  delay(1000);\n  digitalWrite(LED_BUILTIN, LOW);\n  delay(1000);\n}\n',
  'serial-test': '// DroidVibe \u2014 Serial Test\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println("DroidVibe Serial Test");\n}\n\nvoid loop() {\n  Serial.print("uptime_ms=");\n  Serial.println(millis());\n  delay(500);\n}\n',
  'analog-read': '// DroidVibe \u2014 Analog Read\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int val = analogRead(A0);\n  Serial.print("A0=");\n  Serial.println(val);\n  delay(100);\n}\n',
  'pico-blink': '// DroidVibe \u2014 Pico Blink (RP2040)\nvoid setup() {\n  pinMode(LED_BUILTIN, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(LED_BUILTIN, HIGH);\n  delay(500);\n  digitalWrite(LED_BUILTIN, LOW);\n  delay(500);\n}\n',
};

const BLANK_CODE = '// New Sketch\nvoid setup() {\n  // put your setup code here, to run once:\n\n}\n\nvoid loop() {\n  // put your main code here, to run repeatedly:\n\n}\n';

const RECENTS_KEY = '@droidvibe/recents';

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  return Math.floor(diff / 86400000) + 'd ago';
}

export default function SketchesScreen() {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const [cloud, setCloud] = useState<SketchItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [localSketches, setLocalSketches] = useState<LocalSketch[]>([]);
  const [recents, setRecents] = useState<{ name: string; code: string; openedAt: number }[]>([]);

  useEffect(() => {
    let active = true;
    api.sketches
      .list()
      .then((r) => active && (setCloud(((r as any).sketches ?? []) as SketchItem[]), setOffline(false)))
      .catch(() => active && setOffline(true))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    getLocalSketches().then(setLocalSketches);
    AsyncStorage.getItem(RECENTS_KEY).then((raw) => {
      if (raw) setRecents(JSON.parse(raw).slice(0, 5));
    });
  }, []);

  function openExample(id: string, name: string) {
    const code = EXAMPLE_CODE[id] ?? '';
    setPendingSketch(code, name);
    addRecent(name, code);
    router.push('/editor');
  }

  function newSketch() {
    setPendingSketch(BLANK_CODE, 'New Sketch');
    addRecent('New Sketch', BLANK_CODE);
    router.push('/editor');
  }

  async function addRecent(name: string, code: string) {
    const newRecent = { name, code, openedAt: Date.now() };
    const updated = [newRecent, ...recents.filter((r) => r.name !== name)].slice(0, 5);
    setRecents(updated);
    AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(updated)).catch(() => {});
  }

  async function openLocalSketch(sketch: LocalSketch) {
    setPendingSketch(sketch.code, sketch.name);
    addRecent(sketch.name, sketch.code);
    router.push('/editor');
  }

  async function deleteSketch(id: string) {
    Alert.alert(
      'Delete sketch',
      'This will permanently delete the local sketch. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteLocalSketch(id);
            setLocalSketches(await getLocalSketches());
          },
        },
      ]
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: palette.text }]}>Sketches</Text>
          <Row gap={6}>
            <Text style={{ color: palette.textMuted, fontSize: 13 }}>
              Cloud Â· local Â· examples
            </Text>
            {offline && <Badge label="offline" tone="warn" dot />}
            {!offline && !loading && cloud && <Badge label="synced" tone="success" dot />}
          </Row>
        </View>
        <Button title="+ New Sketch" onPress={newSketch} size="lg" />
      </View>

      <FlatList
        ListHeaderComponent={
          <>
            {recents.length > 0 && (
              <>
                <SectionTitle title="Recent" subtitle="Recently opened sketches" />
                {recents.map((r, i) => (
                  <Card key={i} style={{ marginBottom: 8 }}>
                    <Pressable onPress={() => { setPendingSketch(r.code, r.name); router.push('/editor'); }}>
                      <Row justify="space-between">
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: palette.text, fontWeight: '700', fontSize: 14 }}>{r.name}</Text>
                          <Text style={{ color: palette.textMuted, fontSize: 11 }}>{timeAgo(r.openedAt)}</Text>
                        </View>
                        <Badge label="recent" tone="accent" />
                      </Row>
                    </Pressable>
                  </Card>
                ))}
                <View style={{ height: 16 }} />
              </>
            )}

            <SectionTitle title="Start from an example" subtitle="Curated starter sketches" />
            <FlatList
              horizontal
              data={EXAMPLE_PRESETS}
              keyExtractor={(i) => i.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 8 }}
              renderItem={({ item }) => (
                <Pressable style={{ marginRight: 10 }} onPress={() => openExample(item.id, item.name)}>
                  <Card style={{ width: 180 }}>
                    <Text style={{ color: palette.text, fontWeight: '700' }}>{item.name}</Text>
                    <Text style={{ color: palette.textMuted, fontSize: 12, marginTop: 2 }}>{item.board}</Text>
                    <View style={{ marginTop: 8 }}><Badge label={item.fqbn} tone="accent" /></View>
                  </Card>
                </Pressable>
              )}
            />

            {localSketches.length > 0 && (
              <>
                <View style={{ height: 16 }} />
                <SectionTitle title="Local sketches" subtitle="Stored on device â works offline" />
              </>
            )}

            {localSketches.map((sketch) => (
              <Card key={sketch.id} style={{ marginBottom: 10 }}>
                <Pressable onPress={() => openLocalSketch(sketch)} onLongPress={() => deleteSketch(sketch.id)}>
                  <Row justify="space-between">
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: palette.text, fontWeight: '700', fontSize: 15 }}>{sketch.name}</Text>
                      <Text style={{ color: palette.textMuted, fontSize: 12 }}>{sketch.fqbn} Â· {timeAgo(sketch.updatedAt)}</Text>
                    </View>
                    <Badge label="local" tone="neutral" dot />
                  </Row>
                </Pressable>
              </Card>
            ))}

            <View style={{ height: 16 }} />
            <SectionTitle
              title="Cloud sketches"
              subtitle={offline ? 'Backend offline â showing local only' : undefined}
              action={offline ? <Badge label="offline" tone="warn" /> : !loading && cloud ? <Badge label="synced" tone="success" dot /> : undefined}
            />
            {loading && <ActivityIndicator color={palette.accent} />}
            {offline && (
              <Text style={{ color: palette.warning, fontSize: 13 }}>
                Backend unreachable. Start the server (pnpm web:dev). Local sketches remain available.
              </Text>
            )}
          </>
        }
        data={cloud ?? []}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <Card style={{ marginBottom: 10 }}>
            <Row justify="space-between">
              <View style={{ flex: 1 }}>
                <Text style={{ color: palette.text, fontWeight: '700', fontSize: 15 }}>{item.name}</Text>
                <Text style={{ color: palette.textMuted, fontSize: 12 }}>{item.fqbn} Â· {timeAgo(item.updatedAt)}</Text>
              </View>
              <Row gap={6}>
                <Badge label="synced" tone="success" dot />
                <Badge label={item.port ? item.port : 'no port'} tone="neutral" />
              </Row>
            </Row>
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: '800' },
});

