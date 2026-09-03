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
    console.warn('[DroidVibe] Config plugins will NOT run - CI fallback patch will handle buildConfig');
  }
}

/**
 * Safely get the gradle.properties as an array of {key, value} objects.
 * Different versions of @expo/config-plugins may provide modResults
 * in different formats (PropertiesConfig object, raw string, or Map).
 */
function getGradleProps(modResults) {
  if (modResults && Array.isArray(modResults.properties)) {
    return modResults;
  }
  if (typeof modResults === 'string') {
    return null;
  }
  if (modResults && !Array.isArray(modResults.properties)) {
    console.warn('[DroidVibe] modResults.properties is not iterable:', typeof modResults.properties);
    if (typeof modResults === 'object' && modResults !== null) {
      modResults.properties = [];
      return modResults;
    }
  }
  return null;
}

function withKotlinVersion(config) {
  if (!withGradleProperties) {
    console.warn('[DroidVibe] withGradleProperties not available - skipping Kotlin version patch');
    return config;
  }
  return withGradleProperties(config, (cfg) => {
    const modResults = getGradleProps(cfg.modResults);
    if (!modResults) {
      console.warn('[DroidVibe] Could not get gradle.properties - skipping Kotlin version patch');
      return cfg;
    }
    const props = modResults.properties;
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
    console.log('[DroidVibe] withKotlinVersion plugin applied - gradle.properties patched');
    return cfg;
  });
}

function withBuildConfigEnabled(config) {
  if (!withAppBuildGradle) {
    console.warn('[DroidVibe] withAppBuildGradle not available - skipping BuildConfig + namespace patch');
    return config;
  }
  return withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;
    let modified = false;
    if (!/namespaces+"com.droidvibe.app"/.test(contents)) {
      if (/namespaces+"[^"]*"/.test(contents)) {
        contents = contents.replace(/namespaces+"[^"]*"/, 'namespace "com.droidvibe.app"');
        console.log('[DroidVibe] Fixed namespace to com.droidvibe.app in app/build.gradle');
        modified = true;
      } else if (/androids*{/.test(contents)) {
        contents = contents.replace(/(androids*{)/, '$1
    namespace "com.droidvibe.app"');
        console.log('[DroidVibe] Added namespace com.droidvibe.app to app/build.gradle');
        modified = true;
      }
    }
    if (!/buildConfigs*=s*true/.test(contents)) {
      if (/buildConfigs*=s*false/.test(contents)) {
        contents = contents.replace(/buildConfigs*=s*false/g, 'buildConfig = true');
        console.log('[DroidVibe] Replaced buildConfig = false -> true in app/build.gradle');
        modified = true;
      } else if (/buildFeaturess{/.test(contents)) {
        contents = contents.replace(/(buildFeaturess{)/, '$1
        buildConfig = true');
        console.log('[DroidVibe] Added buildConfig = true to existing buildFeatures block');
        modified = true;
      } else if (/androids{/.test(contents)) {
        contents = contents.replace(/(androids{)/, '$1
    buildFeatures {
        buildConfig = true
    }');
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