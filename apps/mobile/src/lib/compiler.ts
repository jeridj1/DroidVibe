/**
 * On-device compiler for Arduino sketches.
 * Uses lazy-downloaded avr-gcc + arduino-cli to compile sketches locally.
 */

import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import { exec, execSync } from 'react-native-exec';
import { getApiUrl } from './appConfig';

// Cache directories
const CACHE_DIR = `${RNFS.DocumentDirectoryPath}/cache`;
const AVR_GCC_DIR = `${CACHE_DIR}/avr-gcc`;
const ARDUINO_CLI_DIR = `${CACHE_DIR}/arduino-cli`;
const BOARD_PACKAGES_DIR = `${CACHE_DIR}/arduino/packages`;
const LIBRARIES_DIR = `${CACHE_DIR}/arduino/libraries`;

// avr-gcc download URL (Termux's prebuilt toolchain for Android arm64)
const AVR_GCC_URL = 'https://github.com/termux/termux-packages/releases/download/2024.05.01/avr-gcc-arm64.tar.xz';

// arduino-cli download URL (Linux arm64)
const ARDUINO_CLI_URL = 'https://github.com/arduino/arduino-cli/releases/download/0.36.0/arduino-cli_0.36.0_Linux_arm64.tar.gz';

// Arduino board package index
const ARDUINO_PACKAGE_INDEX_URL = 'https://downloads.arduino.cc/packages/package_index.json';

/**
 * Check if avr-gcc is installed locally.
 */
export async function isAvrGccInstalled(): Promise<boolean> {
  try {
    const exists = await RNFS.exists(`${AVR_GCC_DIR}/bin/avr-gcc`);
    return exists;
  } catch (e) {
    console.error('Error checking avr-gcc:', e);
    return false;
  }
}

/**
 * Download and extract avr-gcc toolchain.
 */
export async function installAvrGcc(onProgress?: (progress: number, message: string) => void): Promise<boolean> {
  try {
    // Create cache directory
    await RNFS.mkdir(CACHE_DIR);
    await RNFS.mkdir(AVR_GCC_DIR);

    // Download avr-gcc
    const downloadDest = `${CACHE_DIR}/avr-gcc.tar.xz`;
    onProgress?.(0, 'Downloading avr-gcc...');
    
    // Use a simple fetch + write for now (replace with proper download in production)
    const response = await fetch(AVR_GCC_URL);
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Failed to download avr-gcc');
    
    const contentLength = +response.headers.get('content-length') || 0;
    let received = 0;
    const chunks: Uint8Array[] = [];
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      onProgress?.(received / contentLength, `Downloaded ${Math.round(received / 1024 / 1024)}MB...`);
    }
    
    // Combine chunks and write to file
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    
    await RNFS.writeFile(downloadDest, combined.buffer as ArrayBuffer, 'base64');
    
    // Extract (using tar.xz - requires a native module or shell command)
    onProgress?.(0.8, 'Extracting avr-gcc...');
    await exec(`tar -xf ${downloadDest} -C ${AVR_GCC_DIR}`);
    await RNFS.unlink(downloadDest);
    
    onProgress?.(1.0, 'avr-gcc installed successfully!');
    return true;
  } catch (e) {
    console.error('Error installing avr-gcc:', e);
    onProgress?.(0, `Failed to install avr-gcc: ${e}`);
    return false;
  }
}

/**
 * Check if arduino-cli is installed locally.
 */
export async function isArduinoCliInstalled(): Promise<boolean> {
  try {
    const exists = await RNFS.exists(`${ARDUINO_CLI_DIR}/arduino-cli`);
    return exists;
  } catch (e) {
    console.error('Error checking arduino-cli:', e);
    return false;
  }
}

/**
 * Download and extract arduino-cli.
 */
export async function installArduinoCli(onProgress?: (progress: number, message: string) => void): Promise<boolean> {
  try {
    // Create cache directory
    await RNFS.mkdir(CACHE_DIR);
    await RNFS.mkdir(ARDUINO_CLI_DIR);

    // Download arduino-cli
    const downloadDest = `${CACHE_DIR}/arduino-cli.tar.gz`;
    onProgress?.(0, 'Downloading arduino-cli...');
    
    const response = await fetch(ARDUINO_CLI_URL);
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Failed to download arduino-cli');
    
    const contentLength = +response.headers.get('content-length') || 0;
    let received = 0;
    const chunks: Uint8Array[] = [];
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      onProgress?.(received / contentLength, `Downloaded ${Math.round(received / 1024 / 1024)}MB...`);
    }
    
    // Combine chunks and write to file
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    
    await RNFS.writeFile(downloadDest, combined.buffer as ArrayBuffer, 'base64');
    
    // Extract
    onProgress?.(0.8, 'Extracting arduino-cli...');
    await exec(`tar -xzf ${downloadDest} -C ${ARDUINO_CLI_DIR}`);
    await RNFS.unlink(downloadDest);
    
    // Make executable
    await exec(`chmod +x ${ARDUINO_CLI_DIR}/arduino-cli`);
    
    onProgress?.(1.0, 'arduino-cli installed successfully!');
    return true;
  } catch (e) {
    console.error('Error installing arduino-cli:', e);
    onProgress?.(0, `Failed to install arduino-cli: ${e}`);
    return false;
  }
}

/**
 * Compile an Arduino sketch locally using avr-gcc + arduino-cli.
 */
export async function compileSketch(
  code: string,
  fqbn: string,
  onProgress?: (progress: number, message: string) => void
): Promise<{ success: boolean; hex?: string; error?: string }> {
  try {
    // Ensure tools are installed
    if (!(await isAvrGccInstalled())) {
      onProgress?.(0, 'Installing avr-gcc...');
      const gccInstalled = await installAvrGcc(onProgress);
      if (!gccInstalled) {
        return { success: false, error: 'Failed to install avr-gcc. Check your internet connection.' };
      }
    }
    
    if (!(await isArduinoCliInstalled())) {
      onProgress?.(0, 'Installing arduino-cli...');
      const cliInstalled = await installArduinoCli(onProgress);
      if (!cliInstalled) {
        return { success: false, error: 'Failed to install arduino-cli. Check your internet connection.' };
      }
    }

    // Create a temporary sketch directory
    const sketchDir = `${CACHE_DIR}/sketches/${Date.now()}`;
    await RNFS.mkdir(sketchDir);
    
    // Write the sketch file
    const sketchName = 'sketch';
    const sketchFile = `${sketchDir}/${sketchName}.ino`;
    await RNFS.writeFile(sketchFile, code, 'utf8');

    // Install the board platform if not already installed
    const platform = getPlatformFromFQBN(fqbn);
    if (platform) {
      onProgress?.(0.2, `Installing platform ${platform}...`);
      await installBoardPlatform(platform);
    }

    // Compile using arduino-cli
    onProgress?.(0.4, 'Compiling sketch...');
    const outputDir = `${sketchDir}/output`;
    await RNFS.mkdir(outputDir);
    
    const avrGccPath = `${AVR_GCC_DIR}/bin`;
    const arduinoCliPath = `${ARDUINO_CLI_DIR}/arduino-cli`;
    
    // Set PATH to include avr-gcc
    const env = {
      PATH: `${avrGccPath}:${process.env.PATH || ''}`,
      ARDUINO_DIRECTORIES: BOARD_PACKAGES_DIR,
    };
    
    // Run arduino-cli compile
    const compileCmd = `${arduinoCliPath} compile --fqbn ${fqbn} --build-path ${outputDir} ${sketchFile}`;
    const compileResult = await exec(compileCmd, { cwd: sketchDir, env });
    
    if (compileResult.exitCode !== 0) {
      return { success: false, error: compileResult.stderr || 'Compilation failed' };
    }

    // Read the hex file
    const hexFile = `${outputDir}/${sketchName}.ino.hex`;
    const hexExists = await RNFS.exists(hexFile);
    if (!hexExists) {
      return { success: false, error: 'No hex file generated' };
    }
    
    const hex = await RNFS.readFile(hexFile, 'utf8');
    
    onProgress?.(1.0, 'Compilation successful!');
    return { success: true, hex };
  } catch (e) {
    console.error('Error compiling sketch:', e);
    return { success: false, error: `Compilation error: ${e}` };
  }
}

/**
 * Install a board platform (e.g., AVR, ESP32) using arduino-cli.
 */
async function installBoardPlatform(platform: string): Promise<boolean> {
  try {
    const arduinoCliPath = `${ARDUINO_CLI_DIR}/arduino-cli`;
    const result = await exec(`${arduinoCliPath} core install ${platform}`);
    return result.exitCode === 0;
  } catch (e) {
    console.error('Error installing board platform:', e);
    return false;
  }
}

/**
 * Get the platform name from an FQBN (e.g., 'arduino:avr' from 'arduino:avr:uno').
 */
function getPlatformFromFQBN(fqbn: string): string | null {
  const parts = fqbn.split(':');
  if (parts.length >= 2) {
    return `${parts[0]}:${parts[1]}`;
  }
  return null;
}

/**
 * List installed board platforms.
 */
export async function listInstalledPlatforms(): Promise<string[]> {
  try {
    const arduinoCliPath = `${ARDUINO_CLI_DIR}/arduino-cli`;
    const result = await exec(`${arduinoCliPath} core list`);
    if (result.exitCode !== 0) return [];
    
    // Parse output to extract platform names
    const platforms: string[] = [];
    const lines = result.stdout.split('\n');
    for (const line of lines) {
      if (line.includes('Installed')) {
        const match = line.match(/ID:\s*([^\s]+)/);
        if (match) platforms.push(match[1]);
      }
    }
    return platforms;
  } catch (e) {
    console.error('Error listing installed platforms:', e);
    return [];
  }
}

/**
 * Fetch the Arduino board package index.
 */
export async function fetchBoardPackageIndex(): Promise<any> {
  try {
    const response = await fetch(ARDUINO_PACKAGE_INDEX_URL);
    return await response.json();
  } catch (e) {
    console.error('Error fetching board package index:', e);
    return {};
  }
}

/**
 * Install a library using arduino-cli.
 */
export async function installLibrary(libraryName: string): Promise<boolean> {
  try {
    const arduinoCliPath = `${ARDUINO_CLI_DIR}/arduino-cli`;
    const result = await exec(`${arduinoCliPath} lib install ${libraryName}`);
    return result.exitCode === 0;
  } catch (e) {
    console.error('Error installing library:', e);
    return false;
  }
}

/**
 * List installed libraries.
 */
export async function listInstalledLibraries(): Promise<string[]> {
  try {
    const arduinoCliPath = `${ARDUINO_CLI_DIR}/arduino-cli`;
    const result = await exec(`${arduinoCliPath} lib list`);
    if (result.exitCode !== 0) return [];
    
    const libraries: string[] = [];
    const lines = result.stdout.split('\n');
    for (const line of lines) {
      if (line.includes('Installed')) {
        const match = line.match(/([^\s]+)\s+([^\s]+)/);
        if (match) libraries.push(match[1]);
      }
    }
    return libraries;
  } catch (e) {
    console.error('Error listing installed libraries:', e);
    return [];
  }
}
