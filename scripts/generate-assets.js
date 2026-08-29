#!/usr/bin/env node
/**
 * Generate PNG app icons and splash screens from SVG sources.
 * Requires sharp: npm install -g sharp (or pnpm add -g sharp)
 *
 * Usage: node scripts/generate-assets.js
 *
 * Generates:
 *   apps/mobile/assets/icon.png          (1024x1024)
 *   apps/mobile/assets/splash.png        (1242x2436)
 *   apps/mobile/assets/adaptive-icon.png  (1024x1024)
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '..', 'apps', 'mobile', 'assets');
const SVG_DIR = path.join(__dirname, '..', 'assets-src');

async function main() {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });

  // Generate icon
  await sharp(path.join(SVG_DIR, 'icon.svg'))
    .resize(1024, 1024)
    .png()
    .toFile(path.join(ASSETS_DIR, 'icon.png'));
  console.log('Generated icon.png');

  // Generate splash
  await sharp(path.join(SVG_DIR, 'splash.svg'))
    .resize(1242, 2436)
    .png()
    .toFile(path.join(ASSETS_DIR, 'splash.png'));
  console.log('Generated splash.png');

  // Generate adaptive icon
  await sharp(path.join(SVG_DIR, 'adaptive-icon.svg'))
    .resize(1024, 1024)
    .png()
    .toFile(path.join(ASSETS_DIR, 'adaptive-icon.png'));
  console.log('Generated adaptive-icon.png');

  console.log('\nAll assets generated successfully.');
  console.log('If you don\'t have sharp installed: pnpm add -g sharp');
}

main().catch(err => {
  console.error('Failed to generate assets:', err.message);
  console.error('\nInstall sharp first: pnpm add -g sharp');
  process.exit(1);
});
