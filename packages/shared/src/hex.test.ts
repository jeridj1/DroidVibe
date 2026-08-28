import { describe, it, expect } from 'vitest';
import { parseHex, toHex, parseHexRecords, HexParseError } from './hex.js';

describe('Intel HEX', () => {
  it('round-trips bytes through toHex/parseHex', () => {
    const src = new Uint8Array([0x00, 0x01, 0x02, 0xff, 0x80, 0x7f]);
    const text = toHex(src, 0x1000);
    const img = parseHex(text);
    expect(img.dataByteCount).toBe(6);
    expect(img.startAddress).toBe(0x1000);
    expect(Array.from(img.bytes)).toEqual(Array.from(src));
  });

  it('rejects a bad checksum', () => {
    const bad = ':0100000000FF'; // wrong checksum (00 is data, checksum should be ~0)
    expect(() => parseHexRecords(bad)).toThrow(HexParseError);
  });

  it('handles EOF and extended linear address records', () => {
    const text = [
      ':020000040001F9', // ext linear addr -> base 0x00010000
      ':040000000102030404', // data at 0x00010000, checksum corrected below
      ':00000001FF',
    ].join('\n');
    // compute correct checksums
    const r0 = ':020000040001F9';
    const r1 = ':0400000001020304' + checksumOf([0x04, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04]);
    const fixed = [r0, r1, ':00000001FF'].join('\n');
    const img = parseHex(fixed);
    expect(img.startAddress).toBe(0x00010000);
    expect(Array.from(img.bytes)).toEqual([1, 2, 3, 4]);
  });
});

function checksumOf(bytes: number[]): string {
  const sum = bytes.reduce((a, b) => a + b, 0);
  const c = (~sum + 1) & 0xff;
  return c.toString(16).padStart(2, '0').toUpperCase();
}
