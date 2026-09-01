import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/src/theme/ThemeProvider';

const ONBOARDING_KEY = '@droidvibe/onboarding_seen';

/**
 * Root entry route. Decides whether to show onboarding (first run) or go
 * straight to the editor (returning user). Without this file Expo Router has
 * no match for "/" and shows "Unmatched Route" on launch.
 */
export default function IndexScreen() {
  const { palette } = useTheme();
  const ready = useRef(false);

  useEffect(() => {
    if (ready.current) return;
    ready.current = true;
    AsyncStorage.getItem(ONBOARDING_KEY).then((seen) => {
      if (seen === 'true') {
        router.replace('/(tabs)/editor');
      } else {
        router.replace('/onboarding');
      }
    });
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <ActivityIndicator size="large" color={palette.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
