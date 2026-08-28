/**
 * @droidvibe/native-usb — TypeScript API surface for the native USB transport.
 *
 * The implementation lives in Kotlin (android.hardware.usb). This module is
 * only available in a custom Expo dev/production build; under Expo Go it falls
 * back to the mock transport exported from the mobile app's transport layer.
 */
import type {
  SerialOptions,
  UploadRequest,
  UploadProgress,
  UploadResult,
  CaptureConfig,
  CaptureResult,
  UsbDevice,
} from '@droidvibe/shared';

export interface DroidVibeUsbModuleType {
  listDevices(): Promise<UsbDevice[]>;
  hasDevicePermission(deviceId: string): Promise<boolean>;
  requestPermission(deviceId: string): Promise<boolean>;
  openSerial(deviceId: string, options: SerialOptions): Promise<boolean>;
  writeSerial(deviceId: string, data: Uint8Array): Promise<number>;
  closeSerial(deviceId: string): Promise<boolean>;
  /** Subscribe to incoming serial data. Returns an unsubscribe function. */
  addSerialDataListener(deviceId: string, cb: (data: Uint8Array) => void): () => void;
  /** Subscribe to USB device attach/detach. */
  addDeviceListener(cb: (event: { type: 'attach' | 'detach'; device: UsbDevice }) => void): () => void;
  upload(request: UploadRequest, onProgress?: (p: UploadProgress) => void): Promise<UploadResult>;
  capture(config: CaptureConfig): Promise<CaptureResult>;
  /** Flash an RP2040 in BOOTSEL via PICOBOOT. */
  flashUf2(deviceId: string, uf2Base64: string, verify: boolean): Promise<UploadResult>;
}

/** Lazily loads the native module; returns null when unavailable (Expo Go). */
export function getNativeUsbModule(): DroidVibeUsbModuleType | null {
  try {
    // expo-modules autolinking exposes the native module under this name.
    const NativeModules = (globalThis as any).nativeModulesProxy ?? (globalThis as any).NativeModules;
    const mod = NativeModules?.DroidVibeUsb;
    if (mod) return mod as DroidVibeUsbModuleType;
    // Fallback: require from expo-modules-core
    const modules = require('expo-modules-core');
    const m = modules.NativeModulesProxy?.DroidVibeUsb;
    return m ? (m as DroidVibeUsbModuleType) : null;
  } catch {
    return null;
  }
}
