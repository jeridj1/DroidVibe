/**
 * Intel HEX parser with checksum validation.
 *
 * Supports record types: 00 (data), 01 (EOF), 02 (extended segment address),
 * 04 (extended linear address). Decoded into a flat map of 16-bit address ->
 * byte value, and a contiguous byte array spanning the recorded range.
 */

export interface HexRecord {
  address: number;
  type: number;
  data: Uint8Array;
}

export interface HexImage {
  /** Lowest and highest recorded data address (extended linear). */
  startAddress: number;
  endAddress: number;
  /** Contiguous byte array covering [startAddress, endAddress]. */
  bytes: Uint8Array;
  /** Total data bytes parsed. */
  dataByteCount: number;
}

const HEX_RE = /^:([0-9A-Fa-f]+)$/

function parseByte(str: string, offset: number): number {
  return parseInt(str.slice(offset, offset + 2), 16);
}

export class HexParseError extends Error {}

/**
 * Parse a full Intel HEX string into records. Throws on malformed lines or
 * bad checksums.
 */
export function parseHexRecords(text: string): HexRecord[] {
  const lines = text.split(/\r?\n/);
  const records: HexRecord[] = [];
  let baseAddress = 0; // extended linear/segment address base

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length === 0) continue;
    const m = line.match(HEX_RE);
    if (!m) throw new HexParseError(`Malformed HEX line ${i + 1}: ${line}`);

    const body = m[1];
    const byteCount = parseByte(body, 0);
    // body layout: byteCount(2) addr(4) type(2) data(byteCount*2) checksum(2)
    const expectedLen = 2 + 4 + 2 + byteCount * 2 + 2;
    if (body.length !== expectedLen) {
      throw new HexParseError(`Length mismatch on HEX line ${i + 1}`);
    }

    const recordType = parseByte(body, 6);
    const addr = parseInt(body.slice(2, 6), 16);

    // checksum covers count, addr-high, addr-low, type, data bytes
    let sum = byteCount + (addr >> 8) + (addr & 0xff) + recordType;
    const data = new Uint8Array(byteCount);
    for (let b = 0; b < byteCount; b++) {
      const v = parseByte(body, 8 + b * 2);
      data[b] = v;
      sum += v;
    }
    const checksum = parseByte(body, 8 + byteCount * 2);
    const computed = (~sum + 1) & 0xff;
    if (computed !== checksum) {
      throw new HexParseError(
        `Checksum mismatch on HEX line ${i + 1}: expected ${computed.toString(16)}, got ${checksum.toString(16)}`,
      );
    }

    if (recordType === 0x00) {
      records.push({ address: baseAddress + addr, type: recordType, data });
    } else if (recordType === 0x01) {
      // EOF
      break;
    } else if (recordType === 0x02) {
      // extended segment address: data is 2 bytes big-endian, segment << 4
      baseAddress = ((data[0] << 8) | data[1]) << 4;
    } else if (recordType === 0x04) {
      // extended linear address: data is 2 bytes big-endian << 16
      baseAddress = ((data[0] << 8) | data[1]) << 16;
    } else if (recordType === 0x03 || recordType === 0x05) {
      // start address records — ignored for flashing
      continue;
    } else {
      throw new HexParseError(`Unsupported HEX record type ${recordType} on line ${i + 1}`);
    }
  }
  return records;
}

/** Parse an Intel HEX string into a contiguous byte image. */
export function parseHex(text: string): HexImage {
  const records = parseHexRecords(text);
  if (records.length === 0) {
    return { startAddress: 0, endAddress: 0, bytes: new Uint8Array(0), dataByteCount: 0 };
  }
  let min = Infinity;
  let max = -Infinity;
  let total = 0;
  for (const r of records) {
    min = Math.min(min, r.address);
    max = Math.max(max, r.address + r.data.length - 1);
    total += r.data.length;
  }
  const bytes = new Uint8Array(max - min + 1);
  for (const r of records) {
    bytes.set(r.data, r.address - min);
  }
  return { startAddress: min, endAddress: max, bytes, dataByteCount: total };
}

/** Convert a byte array into Intel HEX text (data records + EOF). */
export function toHex(bytes: Uint8Array, startAddress = 0, lineLen = 16): string {
  const out: string[] = [];
  const hex = (n: number, w: number) => n.toString(16).padStart(w, '0').toUpperCase();
  for (let off = 0; off < bytes.length; off += lineLen) {
    const chunk = bytes.slice(off, off + lineLen);
    const addr = (startAddress + off) & 0xffff;
    let sum = chunk.length + (addr >> 8) + (addr & 0xff) + 0x00;
    let data = '';
    for (const b of chunk) {
      sum += b;
      data += hex(b, 2);
    }
    const chk = (~sum + 1) & 0xff;
    out.push(':' + hex(chunk.length, 2) + hex(addr, 4) + '00' + data + hex(chk, 2));
  }
  out.push(':00000001FF');
  return out.join('\n');
}
