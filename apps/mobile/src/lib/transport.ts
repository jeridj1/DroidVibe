/**
 * USB transport facade. Uses the native USB module when available (custom dev/
 * production build); otherwise falls back to a mock that never fabricates
 * hardware success (per the no-fake-success directive).
 */
import { getNativeUsbModule, type DroidVibeUsbModuleType } from '@droidvibe/native-usb';
import type {
  UsbDevice,
  SerialOptions,
  UploadRequest,
  UploadProgress,
  UploadResult,
  CaptureConfig,
  CaptureResult,
  HelperFirmwareRequest,
  SwdTransferRequest,
  JtagTransferRequest,
  RP2040Mode,
} from '@droidvibe/shared';

const native: DroidVibeUsbModuleType | null = getNativeUsbModule();

export const isNativeUsbAvailable = (): boolean => native !== null;

export async function listDevices(): Promise<UsbDevice[]> {
  if (native) return native.listDevices();
  return [];
}

export async function requestPermission(deviceId: string): Promise<boolean> {
  if (native) return native.requestPermission(deviceId);
  return false;
}

export function addDeviceListener(cb: (e: { type: 'attach' | 'detach'; device: UsbDevice }) => void): () => void {
  if (native) return native.addDeviceListener(cb);
  return () => {};
}

export async function openSerial(deviceId: string, options: SerialOptions): Promise<boolean> {
  if (native) return native.openSerial(deviceId, options);
  throw new Error('Native USB unavailable (Expo Go). Use a DroidVibe dev/production build.');
}

export async function writeSerial(deviceId: string, data: Uint8Array): Promise<number> {
  if (native) return native.writeSerial(deviceId, data);
  throw new Error('Native USB unavailable');
}

export function addSerialDataListener(deviceId: string, cb: (data: Uint8Array) => void): () => void {
  if (native) return native.addSerialDataListener(deviceId, cb);
  return () => {};
}

export async function closeSerial(deviceId: string): Promise<boolean> {
  if (native) return native.closeSerial(deviceId);
  return false;
}

export async function upload(
  request: UploadRequest,
  onProgress?: (p: UploadProgress) => void,
): Promise<UploadResult> {
  if (native) return native.upload(request, onProgress);
  return { ok: false, stage: 'failed', verified: false, message: 'Native USB unavailable (Expo Go).' };
}

/** Flash an RP2040 in BOOTSEL via PICOBOOT. */
export async function flashUf2(
  deviceId: string,
  uf2Base64: string,
  verify: boolean,
): Promise<UploadResult> {
  if (native) return native.flashUf2(deviceId, uf2Base64, verify);
  return { ok: false, stage: 'failed', verified: false, message: 'Native USB unavailable (Expo Go).' };
}

export async function capture(config: CaptureConfig): Promise<CaptureResult> {
  if (native) return native.capture(config);
  throw new Error('Capture requires native USB + verified RP2040 helper firmware.');
}

// ---- RP2040 multi-mode functions ----

/** Flash helper firmware onto an RP2040 in BOOTSEL mode. */
export async function flashHelperFirmware(
  request: HelperFirmwareRequest,
): Promise<UploadResult> {
  if (native) return native.flashHelperFirmware(request);
  return { ok: false, stage: 'failed', verified: false, message: 'Native USB unavailable (Expo Go).' };
}

/** Send the Pico back to BOOTSEL mode via serial command (requires open serial). */
export async function enterBootselViaSerial(deviceId: string): Promise<boolean> {
  if (native) return native.enterBootselViaSerial(deviceId);
  return false;
}

/** SWD transfer (read or write a 32-bit word via SWD helper firmware). */
export async function swdTransfer(request: SwdTransferRequest): Promise<number> {
  if (native) return native.swdTransfer(request);
  throw new Error('SWD transfer requires native USB + SWD helper firmware.');
}

/** JTAG transfer (shift TMS/TDI and read TDO via JTAG helper firmware). */
export async function jtagTransfer(request: JtagTransferRequest): Promise<Uint8Array> {
  if (native) return native.jtagTransfer(request);
  throw new Error('JTAG transfer requires native USB + JTAG helper firmware.');
}

/** Check if an RP2040 device is in BOOTSEL mode. */
export async function isRp2040Bootsel(deviceId: string): Promise<boolean> {
  if (native) return native.isRp2040Bootsel(deviceId);
  return false;
}

/** Get the RP2040 mode (bootsel, application, or not-rp2040). */
export async function getRp2040Mode(
  deviceId: string,
): Promise<{ mode: RP2040Mode; isRP2040: boolean }> {
  if (native) return native.getRp2040Mode(deviceId);
  return { mode: 'not-rp2040', isRP2040: false };
}
