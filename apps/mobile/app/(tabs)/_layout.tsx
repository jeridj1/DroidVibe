import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/ThemeProvider';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TabLayout() {
  const { palette } = useTheme();
  const tint = palette.accent;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={['bottom']}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: tint,
          tabBarInactiveTintColor: palette.textMuted,
          tabBarStyle: {
            backgroundColor: palette.bgElevated,
            borderTopColor: palette.surfaceBorder,
            height: 60,
            paddingBottom: 4,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        }}
      >
        <Tabs.Screen
          name="sketches"
          options={{
            title: 'Sketches',
            tabBarIcon: ({ color, size }) => <Ionicons name="folder-open" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="editor"
          options={{
            title: 'Editor',
            tabBarIcon: ({ color, size }) => <Ionicons name="code-slash" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="devices"
          options={{
            title: 'Devices',
            tabBarIcon: ({ color, size }) => <Ionicons name="hardware-chip" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="bench"
          options={{
            title: 'Bench',
            tabBarIcon: ({ color, size }) => <Ionicons name="pulse" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} />,
          }}
        />
      </Tabs>
    </SafeAreaView>
  );
}
