const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Let Metro resolve workspace packages (monorepo).
config.watchFolders = [
  path.resolve(__dirname, '../../node_modules'),
  path.resolve(__dirname, '../../packages/shared'),
  path.resolve(__dirname, '../../packages/native-usb'),
];
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(__dirname, '../../node_modules'),
];

module.exports = config;
