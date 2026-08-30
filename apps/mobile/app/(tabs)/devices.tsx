import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, LayoutAnimation, Platform } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme/ThemeProvider';
import { Card, Badge, Button, Row, SectionTitle, EmptyState, HardwareStatusBadge } from '@/src/components/ui';
import { listDevices, requestPermission, addDeviceListener, isNativeUsbAvailable, openSerial } from '@/src/lib/transport';
import { identifyBoard } from '@droidvibe/shared';
import type { UsbDevice } from '@droidvibe/shared';

export default function DevicesScreen() {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const [devices, setDevices] = useState<UsbDevice[]>([]);
  const native = isNativeUsbAvailable();

  async function refresh() {
    setDevices(await listDevices());
  }
  useEffect(() => {
    refresh();
    const unsub = addDeviceListener((e) => {
      if (Platform.OS === 'android') {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      }
      if (e.type === 'attach') setDevices((prev) => [...prev.filter((d) => d.id !== e.device.id), e.device]);
      else setDevices((prev) => prev.filter((d) => d.id !== e.device.id));
    });
    return unsub;
  }, []);

  const identifiedCount = devices.filter((d) => identifyBoard(d.vendorId, d.productId)).length;

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: palette.text }]}>Devices</Text>
          <Text style={{ color: palette.textMuted, fontSize: 13 }}>
            {native
              ? devices.length + ' connected · ' + identifiedCount + ' identified'
              : 'Expo Go — native USB unavailable'}
          </Text>
        </View>
        <Button title="Rescan" onPress={refresh} variant="ghost" />
      </View>

      <FlatList
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        ListEmptyComponent={
          <EmptyState
            icon="🔌"
            title="No USB devices detected"
            subtitle={native ? 'Connect a board via USB-OTG cable.' : 'Build a DroidVibe dev/production APK to access native USB.'}
          />
        }
        data={devices}
        keyExtractor={(d) => d.id}
        renderItem={({ item }) => {
          const id = identifyBoard(item.vendorId, item.productId);
          return (
            <Card style={{ marginBottom: 10 }}>
              <Row justify="space-between">
                <View style={{ flex: 1 }}>
                  <Text style={{ color: palette.text, fontWeight: '700', fontSize: 15 }}>
                    {id?.name ?? item.productName ?? 'Unknown device'}
                  </Text>
                  <Text style={{ color: palette.textMuted, fontSize: 12, marginTop: 2 }}>
                    {item.manufacturer ?? '—'} · VID {item.vendorId} PID {item.productId}
                  </Text>
                </View>
                <Badge label={item.bootsel ? 'BOOTSEL' : item.driver} tone={item.bootsel ? 'accent' : 'neutral'} />
              </Row>

              <Row gap={6} style={{ marginTop: 8 }}>
                {id && <Badge label={id.protocol} tone="accent" />}
                {id && <Badge label={id.fqbn} tone="neutral" />}
              </Row>

              <Row gap={6} style={{ marginTop: 8 }}>
                <HardwareStatusBadge state={item.state} />
                <View style={{ flex: 1 }} />
                {item.permission !== 'granted' ? (
                  <Button
                    title="Allow access"
                    onPress={() => requestPermission(item.id).then(refresh)}
                    variant="ghost"
                    size="sm"
                  />
                ) : null}
                {item.permission === 'granted' && (
                  <>
                    <Button
                      title="Monitor"
                      onPress={() => {
                        router.push('/(tabs)/bench');
                      }}
                      variant="ghost"
                      size="sm"
                    />
                    <Button
                      title="Upload"
                      onPress={() => {
                        router.push('/(tabs)/editor');
                      }}
                      size="sm"
                    />
                  </>
                )}
              </Row>

              {item.bootsel && (
                <Text style={{ color: palette.accent, fontSize: 11, marginTop: 6 }}>
                  RP2040 in BOOTSEL — ready for PICOBOOT flashing.
                </Text>
              )}
            </Card>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: '800' },
});