import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '@/src/theme/ThemeProvider';
import { Card, Badge, Button, Row, SectionTitle } from '@/src/components/ui';
import { api } from '@/src/lib/api';
import { setPendingSketch } from '@/src/lib/sketchBridge';

interface SketchItem { id: string; name: string; fqbn: string; port: string | null; updatedAt: string; }

const EXAMPLE_CODE: Record<string, string> = {
  blink: `// Blink — turns an LED on for 1s, off for 1s.
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
  'serial-test': `// SerialTest — echo serial input back to the host.
void setup() {
  Serial.begin(9600);
  Serial.println("Serial ready");
}

void loop() {
  if (Serial.available() > 0) {
    int b = Serial.read();
    Serial.print("Echo: ");
    Serial.println((char)b);
  }
}
`,
  'analog-read': `// AnalogRead — read A0 and print the value.
void setup() {
  Serial.begin(9600);
}

void loop() {
  int val = analogRead(A0);
  Serial.print("A0 = ");
  Serial.println(val);
  delay(100);
}
`,
  'pico-blink': `// PicoBlink — blink the onboard LED on RP2040.
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
      .then((r) => { if (active) { setCloud((r as any).sketches ?? []); setOffline(false); } })
      .catch(() => { if (active) setOffline(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function openExample(id: string, name: string) {
    const code = EXAMPLE_CODE[id] ?? '';
    setPendingSketch(code, name);
    router.navigate('/(tabs)/editor');
  }

  function newSketch() {
    setPendingSketch('', 'New Sketch');
    router.navigate('/(tabs)/editor');
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
        <Button label="New" onPress={newSketch} variant="accent" />
      </View>

      <FlatList
        ListHeaderComponent={
          <>
            <SectionTitle>Start from an example</SectionTitle>
            <FlatList
              horizontal
              data={EXAMPLE_PRESETS}
              keyExtractor={(i) => i.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 8 }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => openExample(item.id, item.name)}
                  style={{ marginRight: 10 }}
                >
                  <Card style={{ width: 180 }}>
                    <Text style={{ color: palette.text, fontWeight: '700' }}>{item.name}</Text>
                    <Text style={{ color: palette.textMuted, fontSize: 12, marginTop: 2 }}>{item.board}</Text>
                    <View style={{ marginTop: 8 }}><Badge label={item.fqbn} color={palette.accent} /></View>
                  </Card>
                </Pressable>
              )}
            />

            <View style={{ height: 16 }} />
            <SectionTitle>Cloud sketches</SectionTitle>
            {offline && <Text style={{ color: '#ffc107', fontSize: 13, marginBottom: 8 }}>Backend unreachable. Start the server (pnpm web:dev).</Text>}
          </>
        }
        data={cloud ?? []}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <Card style={{ marginBottom: 10 }}>
            <Row>
              <View style={{ flex: 1 }}>
                <Text style={{ color: palette.text, fontWeight: '700', fontSize: 15 }}>{item.name}</Text>
                <Text style={{ color: palette.textMuted, fontSize: 12 }}>{item.fqbn}</Text>
              </View>
              <Badge label={item.port ?? 'no port'} color={palette.textMuted} />
            </Row>
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: { fontSize: 24, fontWeight: '800' },
});
