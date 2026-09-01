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
  vendorId: string;
  productId: string;
  serialNumber: string | null;
  manufacturer: string | null;
  productName: string | null;
  driver: 'cdc-acm' | 'ch340' | 'cp210x' | 'ftdi' | 'unknown';
  bootsel: boolean;
  isRp2040?: boolean;
  permission: 'granted' | 'denied' | 'pending' | 'unknown';
  state: DeviceState;
}

/** Request payload for an upload operation. */
export interface UploadRequest {
  device: Pick<UsbDevice, 'id' | 'vendorId' | 'productId'>;
  protocol: UploadProtocol;
  firmware: string;
  filename: string;
  baudRate?: number;
  verify: boolean;
}

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
  progress: number;
  bytesWritten?: number;
  bytesTotal?: number;
  message?: string;
}

export interface UploadResult {
  ok: boolean;
  stage: UploadStage;
  verified: boolean;
  message: string;
}

export interface HardwareError {
  message: string;
  suggestion: string | null;
  stage?: UploadStage;
}

/** Logic-analyzer capture configuration. */
export interface CaptureConfig {
  deviceId: string;
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
  actualSamples: number;
  durationUs: number;
  data: Uint8Array;
  sampleRate: number;
  channels: number;
}

/** RP2040 operating mode. */
export type RP2040Mode = 'bootsel' | 'application' | 'not-rp2040';

/** Helper firmware mode for the RP2040 multi-tool. */
export type RP2040HelperMode = 'logic-analyzer' | 'swd' | 'jtag' | 'avr-isp' | 'serial-bridge';

/** Request to flash helper firmware onto an RP2040 via PICOBOOT. */
export interface HelperFirmwareRequest {
  deviceId: string;
  uf2Base64: string;
  verify: boolean;
}

/** SWD transfer request (read or write a 32-bit word). */
export interface SwdTransferRequest {
  deviceId: string;
  isRead: boolean;
  apDp: number;
  addr: number;
  data: number;
}

/** JTAG transfer request (shift TMS/TDI and read TDO). */
export interface JtagTransferRequest {
  deviceId: string;
  tmsBase64: string;
  tdiBase64: string;
  bitCount: number;
}

/** A single compiler diagnostic. */
export interface Diagnostic {
  severity: 'error' | 'warning' | 'info';
  file: string;
  line: number;
  column: number;
  message: string;
  code?: string;
  explanation?: string;
}

export interface CompileResult {
  ok: boolean;
  diagnostics: Diagnostic[];
  firmware?: string;
  firmwarePath?: string;
  fqbn: string;
  durationMs: number;
  stdout: string;
}

export interface BoardIdentity {
  vendorId: string;
  productId: string;
  name: string;
  manufacturer: string;
  fqbn: string;
  protocol: UploadProtocol;
  notes?: string;
}

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
