/**
 * DroidVibe shared hardware vocabulary.
 *
 * This is the single source of truth for the device state machine, USB device
 * model, serial options, upload protocols/stages and capture configuration.
 * Both the mobile client and the cloud backend consume these types.
 */

/** Distinct device lifecycle states. Never collapse "unknown" into "verified". */
export type DeviceState =
  | 'detected'
  | 'permission-required'
  | 'selected'
  | 'connected'
  | 'busy'
  | 'verified'
  | 'unknown'
  | 'failed';

/** Upload protocols supported by the native transport. */
export type UploadProtocol =
  | 'stk500v1'
  | 'stk500v2'
  | 'avr109'
  | 'esptool'
  | 'uf2'
  | 'picoboot'
  | 'dfu';

/** Serial line configuration. */
export interface SerialOptions {
  baudRate: number;
  dataBits: 7 | 8;
  stopBits: 1 | 2;
  parity: 'none' | 'even' | 'odd';
  dtr: boolean;
  rts: boolean;
}

export const DEFAULT_SERIAL_OPTIONS: SerialOptions = {
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  dtr: false,
  rts: false,
};

/** A USB device as seen by the native transport. */
export interface UsbDevice {
  id: string;
  /** USB vendor ID (hex string, e.g. "2a03"). */
  vendorId: string;
  /** USB product ID (hex string, e.g. "0043"). */
  productId: string;
  serialNumber: string | null;
  manufacturer: string | null;
  productName: string | null;
  /** Detected driver family for serial bridges. */
  driver: 'cdc-acm' | 'ch340' | 'cp210x' | 'ftdi' | 'unknown';
  /** True when the device enumerated in BOOTSEL mode (RP2040). */
  bootsel: boolean;
  permission: 'granted' | 'denied' | 'pending' | 'unknown';
  state: DeviceState;
}

/** Request payload for an upload operation. */
export interface UploadRequest {
  device: Pick<UsbDevice, 'id' | 'vendorId' | 'productId'>;
  protocol: UploadProtocol;
  /** Firmware bytes, base64-encoded. */
  firmware: string;
  filename: string;
  baudRate?: number;
  verify: boolean;
}

/** Staged progress reported during upload. Never report "done" on failure. */
export type UploadStage =
  | 'preparing'
  | 'resetting'
  | 'handshake'
  | 'erasing'
  | 'writing'
  | 'verifying'
  | 'done'
  | 'failed';

export interface UploadProgress {
  stage: UploadStage;
  /** 0..1 progress within the current stage. */
  progress: number;
  /** Bytes written / total bytes where known. */
  bytesWritten?: number;
  bytesTotal?: number;
  message?: string;
}

/** Result of an upload operation. */
export interface UploadResult {
  ok: boolean;
  stage: UploadStage;
  verified: boolean;
  message: string;
}

/** Logic-analyzer capture configuration. */
export interface CaptureConfig {
  sampleRate: number;
  numSamples: number;
  channels: number;
  trigger: {
    type: 'edge' | 'pattern' | 'none';
    channel?: number;
    edge?: 'rising' | 'falling';
    pattern?: number[];
    patternMask?: number[];
  };
}

/** Packed capture result returned by the bench. */
export interface CaptureResult {
  config: CaptureConfig;
  /** Packed samples — each 32-bit word holds up to 8 channel bits. */
  data: Uint8Array;
  actualSamples: number;
  durationUs: number;
}

/** A single compiler diagnostic. */
export interface Diagnostic {
  severity: 'error' | 'warning' | 'info';
  file: string;
  line: number;
  column: number;
  message: string;
  code?: string;
  /** Plain-English explanation, filled in by the diagnostics translator. */
  explanation?: string;
}

/** Result of a compile request. */
export interface CompileResult {
  ok: boolean;
  diagnostics: Diagnostic[];
  /** Firmware bytes (base64) when compilation succeeded. */
  firmware?: string;
  firmwarePath?: string;
  fqbn: string;
  durationMs: number;
  stdout: string;
}

/** Board identity resolved from a VID/PID pair. */
export interface BoardIdentity {
  vendorId: string;
  productId: string;
  name: string;
  manufacturer: string;
  fqbn: string;
  protocol: UploadProtocol;
  notes?: string;
}

/** Minimal sketch file descriptor. */
export interface SketchFile {
  path: string;
  content: string;
  language: 'ino' | 'cpp' | 'c' | 'h' | 'text';
}

export interface Sketch {
  id: string;
  name: string;
  fqbn: string;
  port: string | null;
  updatedAt: number;
  files: SketchFile[];
}
