/**
 * DroidVibe Expo app config with Kotlin version override + JVM target fix.
 *
 * Expo SDK 52 ships with Kotlin 1.9.24, but the Compose Compiler 1.5.15
 * (used by expo-modules-core with newArchEnabled) requires Kotlin 1.9.25.
 * Additionally, SDK 52 + Java 17 can trigger JVM target mismatch errors
 * between compileJavaWithJavac (17) and kspReleaseKotlin (21).
 * This config plugin patches gradle.properties after prebuild to fix both.
 *
 * Also enables buildFeatures.buildConfig = true in app/build.gradle, which
 * is required because AGP 8.x disables BuildConfig generation by default
 * but the generated MainActivity.kt and MainApplication.kt reference it.
 */

// Load config plugins with fallback for different export paths
let withAppBuildGradle, withGradleProperties;
try {
  const plugins = require('expo/config-plugins');
  withAppBuildGradle = plugins.withAppBuildGradle;
  withGradleProperties = plugins.withGradleProperties;
  console.log('[DroidVibe] Config plugins loaded from expo/config-plugins:', {
    withAppBuildGradle: typeof withAppBuildGradle,
    withGradleProperties: typeof withGradleProperties,
  });
} catch (e) {
  console.warn('[DroidVibe] Failed to load config plugins from expo/config-plugins:', e.message);
  try {
    const plugins = require('@expo/config-plugins');
    withAppBuildGradle = plugins.withAppBuildGradle;
    withGradleProperties = plugins.withGradleProperties;
    console.log('[DroidVibe] Config plugins loaded from @expo/config-plugins:', {
      withAppBuildGradle: typeof withAppBuildGradle,
      withGradleProperties: typeof withGradleProperties,
    });
  } catch (e2) {
    console.warn('[DroidVibe] Failed to load config plugins from @expo/config-plugins:', e2.message);
    console.warn('[DroidVibe] Config plugins will NOT run — CI fallback patch will handle buildConfig');
  }
}

function withKotlinVersion(config) {
  if (!withGradleProperties) {
    console.warn('[DroidVibe] withGradleProperties not available — skipping Kotlin version patch');
    return config;
  }
  return withGradleProperties(config, (cfg) => {
    const props = cfg.modResults.properties;

    // --- Kotlin version: 1.9.24 -> 1.9.25 for Compose Compiler 1.5.15 ---
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

    console.log('[DroidVibe] withKotlinVersion plugin applied — gradle.properties patched');
    return cfg;
  });
}

/**
 * Enable buildFeatures.buildConfig = true in app/build.gradle.
 *
 * AGP 8.x (used by RN 0.76.x / Expo SDK 52) disables BuildConfig generation
 * by default. The prebuild-generated MainActivity.kt and MainApplication.kt
 * reference BuildConfig (e.g., for IS_NEW_ARCHITECTURE_ENABLED), so without
 * this flag the :app:compileDebugKotlin task fails with
 * "Unresolved reference: BuildConfig".
 */
function withBuildConfigEnabled(config) {
  if (!withAppBuildGradle) {
    console.warn('[DroidVibe] withAppBuildGradle not available — skipping BuildConfig patch');
    return config;
  }
  return withAppBuildGradle(config, (cfg) => {
    const contents = cfg.modResults.contents;

    // Skip if already enabled
    if (/buildConfig\s*=\s*true/.test(contents)) {
      console.log('[DroidVibe] buildConfig = true already present in app/build.gradle');
      return cfg;
    }

    // If buildConfig = false, replace with true
    if (/buildConfig\s*=\s*false/.test(contents)) {
      cfg.modResults.contents = contents.replace(
        /buildConfig\s*=\s*false/g,
        'buildConfig = true'
      );
      console.log('[DroidVibe] Replaced buildConfig = false -> true in app/build.gradle');
      return cfg;
    }

    // If a buildFeatures block already exists, add buildConfig = true inside it
    if (/buildFeatures\s*{/.test(contents)) {
      cfg.modResults.contents = contents.replace(
        /(buildFeatures\s*{)/,
        '$1\n        buildConfig = true'
      );
      console.log('[DroidVibe] Added buildConfig = true to existing buildFeatures block');
    } else {
      // Otherwise, add a buildFeatures block at the start of the android { } block
      cfg.modResults.contents = contents.replace(
        /(android\s*{)/,
        '$1\n    buildFeatures {\n        buildConfig = true\n    }'
      );
      console.log('[DroidVibe] Added buildFeatures block with buildConfig = true');
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
    plugins: [withKotlinVersion, withBuildConfigEnabled],
    experiments: {
      tsrPaths: true,
    },
    ios: { supportsTablet: true },
  },
};
