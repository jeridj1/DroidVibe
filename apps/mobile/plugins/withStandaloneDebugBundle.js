const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withStandaloneDebugBundle(config) {
  return withAppBuildGradle(config, (modConfig) => {
    const contents = modConfig.modResults.contents;
    const replaced = contents.replace(
      /debuggableVariants\s*=\s*\[[^\]]*\]/,
      'debuggableVariants = []'
    );
    modConfig.modResults.contents = replaced !== contents
      ? replaced
      : contents.replace(/react\s*\{/, 'react {\n    debuggableVariants = []');
    return modConfig;
  });
};
