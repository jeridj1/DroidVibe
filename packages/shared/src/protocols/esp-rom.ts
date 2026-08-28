/**
 * ESP ROM-loader (esptool-compatible) protocol logic.
 *
 * SLIP-framed commands: each command block is wrapped with 0xC0 ... 0xC0,
 * with 0xDB 0xDC for an escaped 0xC0 and 0xDB 0xDD for an escaped 0xDB.
 * The transport also strips duplicate leading 0xC0 on reception. This module
 * provides framing helpers and command builders for the common flash flow.
 */
import { ESP_ROM } from './constants.js';

/** Apply SLIP escaping to a raw payload. */
export function slipEncode(data: Uint8Array): Uint8Array {
  const out: number[] = [];
  for (const b of data) {
    if (b === ESP_ROM.SLIP_END) {
      out.push(ESP_ROM.SLIP_ESC, ESP_ROM.SLIP_ESC_END);
    } else if (b === ESP_ROM.SLIP_ESC) {
      out.push(ESP_ROM.SLIP_ESC, ESP_ROM.SLIP_ESC_ESC);
    } else {
      out.push(b);
    }
  }
  return new Uint8Array(out);
}

/** Wrap a command payload in SLIP framing (with trailing 0xC0). */
export function slipFrame(data: Uint8Array): Uint8Array {
  const encoded = slipEncode(data);
  const out = new Uint8Array(1 + encoded.length + 1);
  out[0] = ESP_ROM.SLIP_END;
  out.set(encoded, 1);
  out[1 + encoded.length] = ESP_ROM.SLIP_END;
  return out;
}

/** Remove SLIP escaping from a received payload block. */
export function slipDecode(data: Uint8Array): Uint8Array {
  const out: number[] = [];
  let i = 0;
  // Skip leading 0xC0 and any duplicate framing bytes.
  while (i < data.length && data[i] === ESP_ROM.SLIP_END) i++;
  let escaped = false;
  for (; i < data.length; i++) {
    const b = data[i];
    if (escaped) {
      if (b === ESP_ROM.SLIP_ESC_END) out.push(ESP_ROM.SLIP_END);
      else if (b === ESP_ROM.SLIP_ESC_ESC) out.push(ESP_ROM.SLIP_ESC);
      else out.push(b);
      escaped = false;
    } else if (b === ESP_ROM.SLIP_ESC) {
      escaped = true;
    } else if (b === ESP_ROM.SLIP_END) {
      break; // end of frame
    } else {
      out.push(b);
    }
  }
  return new Uint8Array(out);
}

function le32(v: number): Uint8Array {
  v = v >>> 0;
  return new Uint8Array([v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]);
}

/** Build the 36-byte SYNC command (0x07 0x07 0x07 0x07 + 32x 0x55 + checksum). */
export function cmdSync(): Uint8Array {
  const data = new Uint8Array(36);
  data[0] = 0x07;
  data[1] = 0x07;
  data[2] = 0x07;
  data[3] = 0x07;
  for (let i = 4; i < 36; i++) data[i] = 0x55;
  return frameCommand(ESP_ROM.CMD_SYNC, 0, 36, data);
}

/** Build the ESP command header (8 bytes) + variable data + 2-byte checksum. */
export function frameCommand(
  cmd: number,
  checksum: number,
  dataLen: number,
  data: Uint8Array,
): Uint8Array {
  const header = new Uint8Array(8);
  header[0] = 0x00; // direction: request
  header[1] = cmd & 0xff;
  header.set(le32(dataLen), 2);
  header.set(le32(checksum), 6);
  const out = new Uint8Array(8 + data.length);
  out.set(header, 0);
  out.set(data, 8);
  return out;
}

/** ESP checksum is a CRC-ish running XOR-ish over data bytes (esptool uses a specific algo). */
export function espChecksum(data: Uint8Array): number {
  let magic = 0xef;
  let crc = magic;
  for (const b of data) crc ^= b;
  // esptool's real algorithm is a CRC32; this is a placeholder-safe lightweight
  // checksum. For the actual firmware flow the native transport reuses the
  // battle-tested esptool checksum — see notes in picoboot.ts validation.
  return crc >>> 0;
}

/** Build a FLASH_BEGIN command. */
export function cmdFlashBegin(totalSize: number, offset: number, numPackets: number): Uint8Array {
  const data = new Uint8Array(16);
  data.set(le32(totalSize), 0);
  data.set(le32(numPackets), 4);
  data.set(le32(0), 8); // packet size (filled by transport)
  data.set(le32(offset), 12);
  return frameCommand(ESP_ROM.CMD_FLASH_BEGIN, 0, 16, data);
}

/**
 * Build a FLASH_DATA command for one data block.
 * Data layout per esptool: [size(4) | seq(4) | data(N) | padding].
 */
export function cmdFlashData(block: Uint8Array, seq: number, padTo = 0): Uint8Array {
  const pad = padTo > block.length ? padTo - block.length : 0;
  const data = new Uint8Array(8 + block.length + pad);
  data.set(le32(block.length), 0);
  data.set(le32(seq), 4);
  data.set(block, 8);
  // pad with 0xff
  for (let i = 0; i < pad; i++) data[8 + block.length + i] = 0xff;
  return frameCommand(ESP_ROM.CMD_FLASH_DATA, espChecksum(block), data.length, data);
}

/** Build a FLASH_END (reboot) command. */
export function cmdFlashEnd(reboot = true): Uint8Array {
  const data = new Uint8Array(4);
  data.set(le32(reboot ? 1 : 0), 0);
  return frameCommand(ESP_ROM.CMD_FLASH_END, 0, 4, data);
}
