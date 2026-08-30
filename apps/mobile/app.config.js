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
    console.warn('[DroidVibe] Config plugins will NOT run \u2014 CI fallback patch will handle buildConfig');
  }
}

/**
 * Safely get the gradle.properties as an array of {key, value} objects.
 * Different versions of @expo/config-plugins may provide modResults in
 * different formats (PropertiesConfig object, raw string, or Map).
 */
function getGradleProps(modResults) {
  // Case 1: PropertiesConfig with .properties array
  if (modResults && Array.isArray(modResults.properties)) {
    return modResults;
  }
  // Case 2: modResults is a raw string (the file content)
  if (typeof modResults === 'string') {
    return null; // Can't patch a raw string in-place
  }
  // Case 3: modResults has no properties field or it's not an array
  if (modResults && !Array.isArray(modResults.properties)) {
    console.warn('[DroidVibe] modResults.properties is not iterable:', typeof modResults.properties);
    // Initialize properties as empty array if modResults is an object
    if (typeof modResults === 'object' && modResults !== null) {
      modResults.properties = [];
      return modResults;
    }
  }
  return null;
}

function withKotlinVersion(config) {
  if (!withGradleProperties) {
    console.warn('[DroidVibe] withGradleProperties not available \u2014 skipping Kotlin version patch');
    return config;
  }
  return withGradleProperties(config, (cfg) => {
    const modResults = getGradleProps(cfg.modResults);
    if (!modResults) {
      console.warn('[DroidVibe] Could not get gradle.properties \u2014 skipping Kotlin version patch');
      return cfg;
    }
    const props = modResults.properties;

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

    console.log('[DroidVibe] withKotlinVersion plugin applied \u2014 gradle.properties patched');
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
    console.warn('[DroidVibe] withAppBuildGradle not available \u2014 skipping BuildConfig + namespace patch');
    return config;
  }
  return withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;
    let modified = false;

    // Fix namespace (must match Kotlin file package com.droidvibe.app for R class + BuildConfig generation)
    if (!/namespace\s+"com\.droidvibe\.app"/.test(contents)) {
      if (/namespace\s+"[^"]*"/.test(contents)) {
        contents = contents.replace(/namespace\s+"[^"]*"/, 'namespace "com.droidvibe.app"');
        console.log('[DroidVibe] Fixed namespace to com.droidvibe.app in app/build.gradle');
        modified = true;
      } else if (/android\s*{/.test(contents)) {
        contents = contents.replace(/(android\s*{)/, '$1\n    namespace "com.droidvibe.app"');
        console.log('[DroidVibe] Added namespace com.droidvibe.app to app/build.gradle');
        modified = true;
      }
    }

    // Enable buildConfig = true (AGP 8.x disables it by default)
    if (!/buildConfig\s*=\s*true/.test(contents)) {
      if (/buildConfig\s*=\s*false/.test(contents)) {
        contents = contents.replace(/buildConfig\s*=\s*false/g, 'buildConfig = true');
        console.log('[DroidVibe] Replaced buildConfig = false -> true in app/build.gradle');
        modified = true;
      } else if (/buildFeatures\s*{/.test(contents)) {
        contents = contents.replace(/(buildFeatures\s*{)/, '$1\n        buildConfig = true');
        console.log('[DroidVibe] Added buildConfig = true to existing buildFeatures block');
        modified = true;
      } else if (/android\s*{/.test(contents)) {
        contents = contents.replace(/(android\s*{)/, '$1\n    buildFeatures {\n        buildConfig = true\n    }');
        console.log('[DroidVibe] Added buildFeatures block with buildConfig = true');
        modified = true;
      }
    } else {
      console.log('[DroidVibe] buildConfig = true already present in app/build.gradle');
    }

    if (modified) {
      cfg.modResults.contents = contents;
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
