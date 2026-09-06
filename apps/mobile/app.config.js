/**
 * DroidVibe Expo app config - minimal working version
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

    // Simple string replacements without complex regex
    const fixes = [
      { pattern: 'namespace "com.example.app"', replacement: 'namespace "com.droidvibe.app"' },
      { pattern: 'buildFeatures {', replacement: 'buildFeatures {
        buildConfig = true' },
      { pattern: 'android {', replacement: 'android {
    buildFeatures {
        buildConfig = true
    }' },
      { pattern: 'compileOptions {', replacement: 'compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17' },
      { pattern: 'kotlinOptions {', replacement: 'kotlinOptions {
        jvmTarget = '17'
        freeCompilerArgs += ['-P', 'plugin:androidx.compose.compiler.plugins.kotlin:suppressKotlinVersionCompatibilityCheck=true']' }
    ];

    for (const fix of fixes) {
      if (contents.includes(fix.pattern) && !contents.includes(fix.replacement)) {
        contents = contents.replace(fix.pattern, fix.replacement);
        console.log(`[DroidVibe] Applied fix: ${fix.pattern} -> ${fix.replacement.substring(0, 50)}...`);
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