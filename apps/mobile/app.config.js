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

const { withGradleProperties, withAppBuildGradle } = require('@expo/config-plugins');

function withKotlinVersion(config) {
  return withGradleProperties(config, (cfg) => {
    cfg.modResults.properties = cfg.modResults.properties || [];

    // Force Kotlin 1.9.25 for Compose Compiler compatibility
    let foundKotlin = false;
    for (const prop of cfg.modResults.properties) {
      if (prop.key === 'android.kotlinVersion') {
        prop.value = '1.9.25';
        foundKotlin = true;
      }
    }
    if (!foundKotlin) {
      cfg.modResults.properties.push({ key: 'android.kotlinVersion', value: '1.9.25' });
    }

    // Fix JVM target validation
    let foundJvmMode = false;
    for (const prop of cfg.modResults.properties) {
      if (prop.key === 'kotlin.jvm.target.validation.mode') {
        prop.value = 'warning';
        foundJvmMode = true;
      }
    }
    if (!foundJvmMode) {
      cfg.modResults.properties.push({ key: 'kotlin.jvm.target.validation.mode', value: 'warning' });
    }

    // Gradle performance optimizations
    let foundJvmArgs = false;
    for (const prop of cfg.modResults.properties) {
      if (prop.key === 'org.gradle.jvmargs') {
        prop.value = '-Xmx3g';
        foundJvmArgs = true;
      }
    }
    if (!foundJvmArgs) {
      cfg.modResults.properties.push({ key: 'org.gradle.jvmargs', value: '-Xmx3g' });
    }

    let foundParallel = false;
    for (const prop of cfg.modResults.properties) {
      if (prop.key === 'org.gradle.parallel') {
        prop.value = 'true';
        foundParallel = true;
      }
    }
    if (!foundParallel) {
      cfg.modResults.properties.push({ key: 'org.gradle.parallel', value: 'true' });
    }

    let foundCaching = false;
    for (const prop of cfg.modResults.properties) {
      if (prop.key === 'org.gradle.caching') {
        prop.value = 'true';
        foundCaching = true;
      }
    }
    if (!foundCaching) {
      cfg.modResults.properties.push({ key: 'org.gradle.caching', value: 'true' });
    }

    console.log('[DroidVibe] withKotlinVersion plugin applied - gradle.properties patched');
    return cfg;
  });
}

function withBuildConfigEnabled(config) {
  return withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;
    let modified = false;

    // Fix namespace to match app.json
    if (!/namespace\s+"com\.droidvibe\.app"/.test(contents)) {
      if (/namespace\s+"[^\"]*""/.test(contents)) {
        contents = contents.replace(/namespace\s+"[^\"]*" /, 'namespace "com.droidvibe.app"');
        console.log('[DroidVibe] Fixed namespace to com.droidvibe.app in app/build.gradle');
        modified = true;
      }
    }

    // Ensure buildConfig is enabled
    if (!/buildConfig\s*=\s*true/.test(contents)) {
      if (/buildFeatures\s*{/.test(contents)) {
        contents = contents.replace(/buildFeatures\s*{/, 'buildFeatures {\n        buildConfig = true');
        console.log('[DroidVibe] Added buildConfig = true to existing buildFeatures block');
        modified = true;
      } else if (/android\s*{/.test(contents)) {
        contents = contents.replace(/android\s*{/, 'android {\n    buildFeatures {\n        buildConfig = true\n    }');
        console.log('[DroidVibe] Added buildFeatures block with buildConfig = true');
        modified = true;
      }
    }

    // Set Java compatibility to 17
    if (!/sourceCompatibility\s+JavaVersion\.VERSION_17/.test(contents)) {
      if (/compileOptions\s*{/.test(contents)) {
        contents = contents.replace(/compileOptions\s*{/, 'compileOptions {\n        sourceCompatibility JavaVersion.VERSION_17\n        targetCompatibility JavaVersion.VERSION_17');
        console.log('[DroidVibe] Added Java 17 compatibility to compileOptions');
        modified = true;
      }
    }

    // Set Kotlin JVM target to 17
    if (!/jvmTarget\s*=\s*[\'\"]17[\'\"]/.test(contents)) {
      if (/kotlinOptions\s*{/.test(contents)) {
        contents = contents.replace(/kotlinOptions\s*{/, 'kotlinOptions {\n        jvmTarget = \'17\'');
        console.log('[DroidVibe] Added jvmTarget = 17 to kotlinOptions');
        modified = true;
      }
    }

    // Suppress Kotlin version compatibility check for Compose
    if (!/suppressKotlinVersionCompatibilityCheck/.test(contents)) {
      if (/kotlinOptions\s*{/.test(contents)) {
        contents = contents.replace(/kotlinOptions\s*{/, 'kotlinOptions {\n        freeCompilerArgs += [\'-P\', \'plugin:androidx.compose.compiler.plugins.kotlin:suppressKotlinVersionCompatibilityCheck=true\']');
        console.log('[DroidVibe] Added suppressKotlinVersionCompatibilityCheck for Compose');
        modified = true;
      }
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
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#00979D'
      }
    },
    plugins: [withKotlinVersion, withBuildConfigEnabled],
    experiments: {
      tsrPaths: true,
    },
    ios: { supportsTablet: true },
  },
};