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
  HelperFirmwareRequest,
  SwdTransferRequest,
  JtagTransferRequest,
  RP2040Mode,
} from '@droidvibe/shared';

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
  // ---- RP2040 multi-mode ----
  flashHelperFirmware(request: HelperFirmwareRequest): Promise<UploadResult>;
  enterBootselViaSerial(deviceId: string): Promise<boolean>;
  swdTransfer(request: SwdTransferRequest): Promise<number>;
  jtagTransfer(request: JtagTransferRequest): Promise<Uint8Array>;
  isRp2040Bootsel(deviceId: string): Promise<boolean>;
  getRp2040Mode(deviceId: string): Promise<{ mode: RP2040Mode; isRP2040: boolean }>;
}

interface RawNativeModule {
  listDevices(): Promise<UsbDevice[]>;
  hasDevicePermission(deviceId: string): Promise<boolean>;
  requestPermission(deviceId: string): Promise<boolean>;
  openSerial(deviceId: string, options: SerialOptions): Promise<boolean>;
  writeSerial(deviceId: string, data: Uint8Array): Promise<number>;
  closeSerial(deviceId: string): Promise<boolean>;
  upload(request: {
    deviceId: string;
    vendorId: string;
    productId: string;
    protocol: string;
    firmwareBase64: string;
    filename: string;
    baudRate: number;
    verify: boolean;
  }): Promise<UploadResult>;
  capture(config: CaptureConfig): Promise<CaptureResult>;
  flashUf2(deviceId: string, uf2Base64: string, verify: boolean): Promise<UploadResult>;
  flashHelperFirmware(request: HelperFirmwareRequest): Promise<UploadResult>;
  enterBootselViaSerial(deviceId: string): Promise<boolean>;
  swdTransfer(request: SwdTransferRequest): Promise<number>;
  jtagTransfer(request: JtagTransferRequest): Promise<Uint8Array>;
  isRp2040Bootsel(deviceId: string): Promise<boolean>;
  getRp2040Mode(deviceId: string): Promise<{ mode: RP2040Mode; isRP2040: boolean }>;
  addListener(eventName: string, listener: (payload: any) => void): { remove(): void };
}

function mapUploadRequest(req: UploadRequest) {
  return {
    deviceId: req.device.id,
    vendorId: req.device.vendorId,
    productId: req.device.productId,
    protocol: req.protocol,
    firmwareBase64: req.firmware,
    filename: req.filename,
    baudRate: req.baudRate ?? 115200,
    verify: req.verify,
  };
}

export function getNativeUsbModule(): DroidVibeUsbModuleType | null {
  try {
    let raw: RawNativeModule | null = null;

    const NativeModules =
      (globalThis as any).nativeModulesProxy ?? (globalThis as any).NativeModules;
    const mod = NativeModules?.DroidVibeUsb;
    if (mod) raw = mod as RawNativeModule;

    if (!raw) {
      const req = (globalThis as any).require;
      if (typeof req === 'function') {
        const modules = req('expo-modules-core');
        const m = modules?.NativeModulesProxy?.DroidVibeUsb;
        if (m) raw = m as RawNativeModule;
      }
    }

    if (!raw) return null;

    const wrapped: DroidVibeUsbModuleType = {
      listDevices: () => raw!.listDevices(),
      hasDevicePermission: (id) => raw!.hasDevicePermission(id),
      requestPermission: (id) => raw!.requestPermission(id),
      openSerial: (id, opts) => raw!.openSerial(id, opts),
      writeSerial: (id, data) => raw!.writeSerial(id, data),
      closeSerial: (id) => raw!.closeSerial(id),

      addSerialDataListener: (deviceId, cb) => {
        const sub = raw!.addListener('onUsbData', (payload: { deviceId?: string; data?: number[] }) => {
          if (payload?.deviceId === deviceId && payload.data) {
            cb(new Uint8Array(payload.data));
          }
        });
        return () => sub.remove();
      },

      addDeviceListener: (cb) => {
        const sub = raw!.addListener('onDeviceEvent', (payload: { type: 'attach' | 'detach'; device: UsbDevice }) => {
          cb(payload);
        });
        return () => sub.remove();
      },

      upload: (request, onProgress) => {
        let progressSub: { remove(): void } | null = null;
        if (onProgress) {
          progressSub = raw!.addListener('onUploadProgress', (payload: UploadProgress) => {
            onProgress(payload);
          });
        }
        return raw!.upload(mapUploadRequest(request)).finally(() => {
          progressSub?.remove();
        });
      },

      capture: (config) => raw!.capture(config),
      flashUf2: (deviceId, uf2Base64, verify) => raw!.flashUf2(deviceId, uf2Base64, verify),

      // RP2040 multi-mode
      flashHelperFirmware: (request) => raw!.flashHelperFirmware(request),
      enterBootselViaSerial: (deviceId) => raw!.enterBootselViaSerial(deviceId),
      swdTransfer: (request) => raw!.swdTransfer(request),
      jtagTransfer: (request) => raw!.jtagTransfer(request),
      isRp2040Bootsel: (deviceId) => raw!.isRp2040Bootsel(deviceId),
      getRp2040Mode: (deviceId) => raw!.getRp2040Mode(deviceId),
    };

    return wrapped;
  } catch {
    return null;
  }
}
