import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme/ThemeProvider';
import { Card, Badge, Button, Row, SectionTitle } from '@/src/components/ui';
import { api } from '@/src/lib/api';
import { setPendingSketch } from '@/src/lib/sketchBridge';

interface SketchItem { id: string; name: string; fqbn: string; port: string | null; updatedAt: number; }

const EXAMPLE_PRESETS = [
  { id: 'blink', name: 'Blink', fqbn: 'arduino:avr:uno', board: 'Arduino Uno' },
  { id: 'serial-test', name: 'SerialTest', fqbn: 'arduino:avr:uno', board: 'Arduino Uno' },
  { id: 'analog-read', name: 'AnalogRead', fqbn: 'arduino:avr:uno', board: 'Arduino Uno' },
  { id: 'pico-blink', name: 'PicoBlink', fqbn: 'rp2040:rp2040:rpipico', board: 'Raspberry Pi Pico' },
];

const EXAMPLE_CODE: Record<string, string> = {
  blink: `// DroidVibe — Blink
void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(1000);
  digitalWrite(LED_BUILTIN, LOW);
  delay(1000);
}
`,
  'serial-test': `// DroidVibe — Serial Test
void setup() {
  Serial.begin(9600);
  Serial.println("DroidVibe Serial Test");
}

void loop() {
  Serial.print("uptime_ms=");
  Serial.println(millis());
  delay(500);
}
`,
  'analog-read': `// DroidVibe — Analog Read
void setup() {
  Serial.begin(9600);
}

void loop() {
  int val = analogRead(A0);
  Serial.print("A0=");
  Serial.println(val);
  delay(100);
}
`,
  'pico-blink': `// DroidVibe — Pico Blink (RP2040)
// Built-in LED is GP25 on Raspberry Pi Pico
void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(500);
  digitalWrite(LED_BUILTIN, LOW);
  delay(500);
}
`,
};

const BLANK_CODE = `// New Sketch
void setup() {
  // put your setup code here, to run once:

}

void loop() {
  // put your main code here, to run repeatedly:

}
`;

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
      .then((r) => active && (setCloud(((r as any).sketches ?? []) as SketchItem[]), setOffline(false)))
      .catch(() => active && setOffline(true))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  function openExample(id: string, name: string) {
    const code = EXAMPLE_CODE[id] ?? '';
    setPendingSketch(code, name);
    router.push('/editor');
  }

  function newSketch() {
    setPendingSketch(BLANK_CODE, 'New Sketch');
    router.push('/editor');
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: palette.text }]}>Sketches</Text>
          <Text style={{ color: palette.textMuted, fontSize: 13 }}>
            Cloud projects · examples · templates
          </Text>
        </View>
        <Button title="New" onPress={newSketch} />
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
                <Pressable style={{ marginRight: 10 }} onPress={() => openExample(item.id, item.name)}>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: '800' },
});
