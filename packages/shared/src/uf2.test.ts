import { describe, it, expect } from 'vitest';
import { buildUf2, parseUf2, flattenUf2, UF2_FAMILY_RP2040 } from './uf2.js';

describe('UF2', () => {
  it('round-trips bytes through build/parse', () => {
    const src = new Uint8Array(512).map((_, i) => i & 0xff);
    const uf2 = buildUf2(src, 0x10000000, UF2_FAMILY_RP2040);
    expect(uf2.length % 512).toBe(0);
    const blocks = parseUf2(uf2);
    expect(blocks.length).toBe(2); // 512 bytes / 256 payload = 2 blocks
    const flat = flattenUf2(blocks);
    expect(flat.startAddress).toBe(0x10000000);
    expect(Array.from(flat.bytes)).toEqual(Array.from(src));
  });

  it('rejects a corrupted magic end', () => {
    const uf2 = buildUf2(new Uint8Array(10), 0x10000000);
    uf2[508] = 0x00; // corrupt magic end
    expect(() => parseUf2(uf2)).toThrow();
  });
});
