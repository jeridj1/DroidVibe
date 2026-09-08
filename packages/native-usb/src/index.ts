/** @droidvibe/native-usb TypeScript API surface. */
import { requireOptionalNativeModule } from 'expo-modules-core';
import type { SerialOptions, UploadRequest, UploadProgress, UploadResult, CaptureConfig, CaptureResult, UsbDevice, HelperFirmwareRequest, SwdTransferRequest, JtagTransferRequest, RP2040Mode, CompileResult } from '@droidvibe/shared';

export interface DroidVibeUsbModuleType {
  listDevices(): Promise<UsbDevice[]>;
  hasDevicePermission(deviceId: string): Promise<boolean>;
  requestPermission(deviceId: string): Promise<boolean>;
  openSerial(deviceId: string, options: SerialOptions): Promise<boolean>;
  writeSerial(deviceId: string, data: Uint8Array): Promise<number>;
  closeSerial(deviceId: string): Promise<boolean>;
  addSerialDataListener(deviceId: string, cb: (data: Uint8Array) => void): () => void;
  addDeviceListener(cb: (event: { type: 'attach' | 'detach'; device: UsbDevice }) => void): () => void;
  upload(request: UploadRequest, onProgress?: (p: UploadProgress) => void): Promise<UploadResult>;
  capture(config: CaptureConfig): Promise<CaptureResult>;
  flashUf2(deviceId: string, uf2Base64: string, verify: boolean): Promise<UploadResult>;
  flashHelperFirmware(request: HelperFirmwareRequest): Promise<UploadResult>;
  enterBootselViaSerial(deviceId: string): Promise<boolean>;
  swdTransfer(request: SwdTransferRequest): Promise<number>;
  jtagTransfer(request: JtagTransferRequest): Promise<Uint8Array>;
  isRp2040Bootsel(deviceId: string): Promise<boolean>;
  getRp2040Mode(deviceId: string): Promise<{ mode: RP2040Mode; isRP2040: boolean }>;
  compileLocal(input: { name: string; fqbn: string; files: Array<{ path: string; content: string }> }): Promise<CompileResult>;
  isLocalToolchainInstalled(): Promise<boolean>;
}

interface RawNativeModule {
  listDevices(): Promise<UsbDevice[]>; hasDevicePermission(deviceId: string): Promise<boolean>; requestPermission(deviceId: string): Promise<boolean>;
  openSerial(deviceId: string, options: SerialOptions): Promise<boolean>; writeSerial(deviceId: string, data: Uint8Array): Promise<number>; closeSerial(deviceId: string): Promise<boolean>;
  upload(request: { deviceId: string; vendorId: string; productId: string; protocol: string; firmwareBase64: string; filename: string; baudRate: number; verify: boolean }): Promise<UploadResult>;
  capture(config: CaptureConfig): Promise<CaptureResult>; flashUf2(deviceId: string, uf2Base64: string, verify: boolean): Promise<UploadResult>;
  flashHelperFirmware(request: HelperFirmwareRequest): Promise<UploadResult>; enterBootselViaSerial(deviceId: string): Promise<boolean>;
  swdTransfer(request: SwdTransferRequest): Promise<number>; jtagTransfer(request: JtagTransferRequest): Promise<Uint8Array>;
  isRp2040Bootsel(deviceId: string): Promise<boolean>; getRp2040Mode(deviceId: string): Promise<{ mode: RP2040Mode; isRP2040: boolean }>;
  addListener(eventName: string, listener: (payload: any) => void): { remove(): void };
}
interface RawCompilerModule {
  compileLocal(input: { name: string; fqbn: string; filesJson: string }): Promise<CompileResult>;
  isLocalToolchainInstalled(): Promise<boolean>;
}
function mapUploadRequest(req: UploadRequest) { return { deviceId: req.device.id, vendorId: req.device.vendorId, productId: req.device.productId, protocol: req.protocol, firmwareBase64: req.firmware, filename: req.filename, baudRate: req.baudRate ?? 115200, verify: req.verify }; }

export function getNativeUsbModule(): DroidVibeUsbModuleType | null {
  try {
    const raw = requireOptionalNativeModule<RawNativeModule>('DroidVibeUsb');
    const compiler = requireOptionalNativeModule<RawCompilerModule>('DroidVibeCompiler');
    if (!raw) return null;
    return {
      listDevices: () => raw.listDevices(), hasDevicePermission: id => raw.hasDevicePermission(id), requestPermission: id => raw.requestPermission(id),
      openSerial: (id, opts) => raw.openSerial(id, opts), writeSerial: (id, data) => raw.writeSerial(id, data), closeSerial: id => raw.closeSerial(id),
      addSerialDataListener: (deviceId, cb) => { const sub = raw.addListener('onUsbData', (p: {deviceId?: string; data?: number[]}) => { if (p?.deviceId === deviceId && p.data) cb(new Uint8Array(p.data)); }); return () => sub.remove(); },
      addDeviceListener: cb => { const sub = raw.addListener('onDeviceEvent', cb); return () => sub.remove(); },
      upload: (request, onProgress) => { let sub: {remove(): void} | null = null; if (onProgress) sub = raw.addListener('onUploadProgress', onProgress); return raw.upload(mapUploadRequest(request)).finally(() => sub?.remove()); },
      capture: config => raw.capture(config), flashUf2: (id, b64, verify) => raw.flashUf2(id, b64, verify), flashHelperFirmware: req => raw.flashHelperFirmware(req),
      enterBootselViaSerial: id => raw.enterBootselViaSerial(id), swdTransfer: req => raw.swdTransfer(req), jtagTransfer: req => raw.jtagTransfer(req),
      isRp2040Bootsel: id => raw.isRp2040Bootsel(id), getRp2040Mode: id => raw.getRp2040Mode(id),
      compileLocal: input => { if (!compiler) return Promise.reject(new Error('Local compiler module unavailable; use a DroidVibe APK build, not Expo Go.')); return compiler.compileLocal({ name: input.name, fqbn: input.fqbn, filesJson: JSON.stringify(input.files) }); },
      isLocalToolchainInstalled: () => compiler?.isLocalToolchainInstalled() ?? Promise.resolve(false),
    };
  } catch { return null; }
}
