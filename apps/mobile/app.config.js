/**
 * DroidVibe Expo app config with Kotlin/JVM/build configuration fixes.
 */

let withAppBuildGradle, withGradleProperties;
try {
  const plugins = require('expo/config-plugins');
  withAppBuildGradle = plugins.withAppBuildGradle;
  withGradleProperties = plugins.withGradleProperties;
} catch (e) {
  try {
    const plugins = require('@expo/config-plugins');
    withAppBuildGradle = plugins.withAppBuildGradle;
    withGradleProperties = plugins.withGradleProperties;
  } catch (e2) {
    console.warn('[DroidVibe] Config plugins unavailable; CI fallback patches will handle build configuration.');
  }
}

function getGradleProps(modResults) {
  if (modResults && Array.isArray(modResults.properties)) return modResults;
  if (typeof modResults === 'string') return null;
  if (modResults && typeof modResults === 'object') {
    if (!Array.isArray(modResults.properties)) modResults.properties = [];
    return modResults;
  }
  return null;
}

function withKotlinVersion(config) {
  if (!withGradleProperties) return config;
  return withGradleProperties(config, (cfg) => {
    const modResults = getGradleProps(cfg.modResults);
    if (!modResults) return cfg;
    const props = modResults.properties;
    let found = false;
    for (const prop of props) {
      if (prop.key === 'android.kotlinVersion') { prop.value = '1.9.25'; found = true; }
    }
    if (!found) props.push({ key: 'android.kotlinVersion', value: '1.9.25' });
    found = false;
    for (const prop of props) {
      if (prop.key === 'kotlin.jvm.target.validation.mode') { prop.value = 'warning'; found = true; }
    }
    if (!found) props.push({ key: 'kotlin.jvm.target.validation.mode', value: 'warning' });
    found = false;
    for (const prop of props) {
      if (prop.key === 'org.gradle.jvmargs') { prop.value = '-Xmx3g'; found = true; }
    }
    if (!found) props.push({ key: 'org.gradle.jvmargs', value: '-Xmx3g' });
    return cfg;
  });
}

function withBuildConfigEnabled(config) {
  if (!withAppBuildGradle) return config;
  return withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;
    let modified = false;
    if (!/namespace\s+"com\.droidvibe\.app"/.test(contents)) {
      if (/namespace\s+"[^"]*"/.test(contents)) {
        contents = contents.replace(/namespace\s+"[^"]*"/, 'namespace "com.droidvibe.app"');
        modified = true;
      } else if (/android\s*{/.test(contents)) {
        contents = contents.replace(/(android\s*{)/, '$1\n    namespace "com.droidvibe.app"');
        modified = true;
      }
    }
    if (!/buildConfig\s*=\s*true/.test(contents)) {
      if (/buildConfig\s*=\s*false/.test(contents)) {
        contents = contents.replace(/buildConfig\s*=\s*false/g, 'buildConfig = true');
      } else if (/buildFeatures\s*{/.test(contents)) {
        contents = contents.replace(/(buildFeatures\s*{)/, '$1\n        buildConfig = true');
      } else if (/android\s*{/.test(contents)) {
        contents = contents.replace(/(android\s*{)/, '$1\n    buildFeatures {\n        buildConfig = true\n    }');
      }
      modified = true;
    }
    if (modified) cfg.modResults.contents = contents;
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
      features: [{ name: 'android.hardware.usb.host', required: false }],
    },
    plugins: [
      withKotlinVersion,
      withBuildConfigEnabled,
      require('./plugins/withStandaloneDebugBundle'),
    ],
    experiments: { tsrPaths: true },
    ios: { supportsTablet: true },
  },
};
