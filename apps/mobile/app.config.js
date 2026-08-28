/**
 * DroidVibe Expo app config with Kotlin version override.
 *
 * Expo SDK 52 ships with Kotlin 1.9.24, but the Compose Compiler 1.5.15
 * (used by expo-modules-core with newArchEnabled) requires Kotlin 1.9.25.
 * This config plugin patches gradle.properties after prebuild to fix the
 * version mismatch.
 */
const { withGradleProperties } = require('expo/config-plugins');

function withKotlinVersion(config) {
  return withGradleProperties(config, (cfg) => {
    const props = cfg.modResults.properties;
    let found = false;
    for (const prop of props) {
      if (prop.key === 'kotlinVersion') {
        prop.value = '1.9.25';
        found = true;
      }
    }
    if (!found) {
      props.push({ key: 'kotlinVersion', value: '1.9.25' });
    }
    return cfg;
  });
}

module.exports = {
  expo: {
    name: 'DroidVibe',
    slug: 'droidvibe',
    scheme: 'droidvibe',
    version: '1.0.0',
    orientation: 'default',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    android: {
      package: 'com.droidvibe.app',
      minSdkVersion: 24,
      targetSdkVersion: 35,
      edgeToEdgeEnabled: true,
      permissions: ['android.hardware.usb.host'],
      features: [
        { name: 'android.hardware.usb.host', required: false },
      ],
    },
    plugins: [withKotlinVersion],
    experiments: {
      tsrPaths: true,
    },
    ios: { supportsTablet: true },
  },
};
