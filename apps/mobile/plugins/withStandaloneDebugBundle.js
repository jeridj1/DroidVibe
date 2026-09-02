const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Make the Android debug APK self-contained.
 *
 * React Native normally treats the debug variant as Metro-dependent and
 * therefore skips JS bundling. DroidVibe must also run completely offline
 * from an installed APK, so debug must contain index.android.bundle/assets.
 */
module.exports = function withStandaloneDebugBundle(config) {
  return withAppBuildGradle(config, (modConfig) => {
    let contents = modConfig.modResults.contents;

    const replaced = contents.replace(
      /debuggableVariants\s*=\s*\[[^\]]*\]/,
      'debuggableVariants = []'
    );

    if (replaced !== contents) {
      modConfig.modResults.contents = replaced;
      return modConfig;
    }

    // Defensive fallback for generated Gradle templates that do not emit the
    // property by default. Adding it to the React Gradle configuration forces
    // the debug variant through the JS bundling task.
    modConfig.modResults.contents = contents.replace(
      /react\s*\{/,
      'react {\n    debuggableVariants = []'
    );

    return modConfig;
  });
};
