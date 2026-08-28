/**
 * DroidVibe Expo app config with Kotlin version override + JVM target fix.
 *
 * Expo SDK 52 ships with Kotlin 1.9.24, but the Compose Compiler 1.5.15
 * (used by expo-modules-core with newArchEnabled) requires Kotlin 1.9.25.
 * Additionally, SDK 52 + Java 17 can trigger JVM target mismatch errors
 * between compileJavaWithJavac (17) and kspReleaseKotlin (21).
 * This config plugin patches gradle.properties after prebuild to fix both.
 */
const { withGradleProperties } = require('expo/config-plugins');

function withKotlinVersion(config) {
  return withGradleProperties(config, (cfg) => {
    const props = cfg.modResults.properties;

    // --- Kotlin version: 1.9.24 -> 1.9.25 for Compose Compiler 1.5.15 ---
    // The Expo SDK 52 build.gradle reads: findProperty('android.kotlinVersion')
    // So the property name in gradle.properties MUST be 'android.kotlinVersion'
    let foundKotlin = false;
    for (const prop of props) {
      if (prop.key === 'android.kotlinVersion') {
        prop.value = '1.9.25';
        foundKotlin = true;
      }
    }
    if (!foundKotlin) {
      props.push({ key: 'android.kotlinVersion', value: '1.9.25' });
    }

    // --- JVM target validation: warning instead of error (SDK 52 + Java 17) ---
    let foundJvmMode = false;
    for (const prop of props) {
      if (prop.key === 'kotlin.jvm.target.validation.mode') {
        prop.value = 'warning';
        foundJvmMode = true;
      }
    }
    if (!foundJvmMode) {
      props.push({ key: 'kotlin.jvm.target.validation.mode', value: 'warning' });
    }

    // --- JVM args: prevent OOM on CI runners ---
    let foundJvmArgs = false;
    for (const prop of props) {
      if (prop.key === 'org.gradle.jvmargs') {
        prop.value = '-Xmx3g';
        foundJvmArgs = true;
      }
    }
    if (!foundJvmArgs) {
      props.push({ key: 'org.gradle.jvmargs', value: '-Xmx3g' });
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
