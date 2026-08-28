/**
 * UF2 (USB Flashing Format) parser/builder.
 *
 * UF2 is the mass-storage flashing format used by RP2040 and many MCU boards.
 * Each block is 512 bytes:
 *   magicStart0  (0x0A324655)  4 bytes
 *   payloadAddr                4 bytes  (where to write the 256-byte payload)
 *   payloadSize                4 bytes  (<= 256)
 *   blockNo                    4 bytes
 *   numBlocks                  4 bytes
 *   fileSize / familyId        4 bytes  (family id when flags bit 0x2000 set)
 *   data[476]                  256 bytes payload + padding
 *   magicEnd    (0x9AB510E5)    4 bytes
 *
 * Reference: https://github.com/microsoft/uf2
 */

export const UF2_MAGIC_START0 = 0x0a324655;
export const UF2_MAGIC_START1 = 0x9b5d2ad5; // alternate start, not always present
export const UF2_MAGIC_END = 0x9ab510e5;
export const UF2_BLOCK_SIZE = 512;
export const UF2_PAYLOAD_SIZE = 256;
export const UF2_FLAG_FAMILY_ID_PRESENT = 0x00002000;

/** RP2040 family ID (Pico). */
export const UF2_FAMILY_RP2040 = 0xe48bff56;

export interface Uf2Block {
  payloadAddr: number;
  payloadSize: number;
  blockNo: number;
  numBlocks: number;
  familyId: number;
  data: Uint8Array; // 476 bytes
}

export class Uf2ParseError extends Error {}

function readU32LE(buf: Uint8Array, off: number): number {
  return (buf[off] | (buf[off + 1] << 8) | (buf[off + 2] << 16) | (buf[off + 3] * 0x1000000)) >>> 0;
}

function writeU32LE(buf: Uint8Array, off: number, val: number): void {
  val = val >>> 0;
  buf[off] = val & 0xff;
  buf[off + 1] = (val >>> 8) & 0xff;
  buf[off + 2] = (val >>> 16) & 0xff;
  buf[off + 3] = (val >>> 24) & 0xff;
}

/** Parse a UF2 binary into blocks. Validates magic numbers. */
export function parseUf2(bytes: Uint8Array): Uf2Block[] {
  if (bytes.length % UF2_BLOCK_SIZE !== 0) {
    throw new Uf2ParseError(`UF2 size ${bytes.length} is not a multiple of ${UF2_BLOCK_SIZE}`);
  }
  const blocks: Uf2Block[] = [];
  const numBlocks = bytes.length / UF2_BLOCK_SIZE;
  for (let i = 0; i < numBlocks; i++) {
    const base = i * UF2_BLOCK_SIZE;
    const block = bytes.subarray(base, base + UF2_BLOCK_SIZE);
    const magicStart = readU32LE(block, 0);
    if (magicStart !== UF2_MAGIC_START0) {
      throw new Uf2ParseError(`Bad magic start 0x${magicStart.toString(16)} at block ${i}`);
    }
    const payloadAddr = readU32LE(block, 4);
    const payloadSize = readU32LE(block, 8);
    const blockNo = readU32LE(block, 12);
    const nb = readU32LE(block, 16);
    const familyOrSize = readU32LE(block, 20);
    const magicEnd = readU32LE(block, 508);
    if (magicEnd !== UF2_MAGIC_END) {
      throw new Uf2ParseError(`Bad magic end 0x${magicEnd.toString(16)} at block ${i}`);
    }
    if (nb !== numBlocks) {
      throw new Uf2ParseError(`numBlocks mismatch at block ${i}: ${nb} vs ${numBlocks}`);
    }
    if (blockNo !== i) {
      throw new Uf2ParseError(`blockNo out of order at block ${i}: ${blockNo}`);
    }
    if (payloadSize > UF2_PAYLOAD_SIZE) {
      throw new Uf2ParseError(`payloadSize ${payloadSize} exceeds ${UF2_PAYLOAD_SIZE} at block ${i}`);
    }
    const data = new Uint8Array(UF2_PAYLOAD_SIZE);
    data.set(block.subarray(32, 32 + UF2_PAYLOAD_SIZE));
    blocks.push({
      payloadAddr,
      payloadSize,
      blockNo,
      numBlocks: nb,
      familyId: familyOrSize,
      data,
    });
  }
  return blocks;
}

/** Flatten UF2 blocks into a {address -> byte} payload map ordered by address. */
export function flattenUf2(blocks: Uf2Block[]): { startAddress: number; bytes: Uint8Array } {
  if (blocks.length === 0) return { startAddress: 0, bytes: new Uint8Array(0) };
  let min = Infinity;
  let max = -Infinity;
  for (const b of blocks) {
    min = Math.min(min, b.payloadAddr);
    max = Math.max(max, b.payloadAddr + b.payloadSize - 1);
  }
  const out = new Uint8Array(max - min + 1);
  for (const b of blocks) {
    out.set(b.data.subarray(0, b.payloadSize), b.payloadAddr - min);
  }
  return { startAddress: min, bytes: out };
}

/** Build a UF2 binary from a flat byte array for a given flash start + family. */
export function buildUf2(
  bytes: Uint8Array,
  startAddress = 0,
  familyId = UF2_FAMILY_RP2040,
): Uint8Array {
  const numBlocks = Math.ceil(bytes.length / UF2_PAYLOAD_SIZE);
  const out = new Uint8Array(numBlocks * UF2_BLOCK_SIZE);
  for (let i = 0; i < numBlocks; i++) {
    const base = i * UF2_BLOCK_SIZE;
    writeU32LE(out, base + 0, UF2_MAGIC_START0);
    const off = i * UF2_PAYLOAD_SIZE;
    const chunk = bytes.subarray(off, off + UF2_PAYLOAD_SIZE);
    writeU32LE(out, base + 4, startAddress + off); // payloadAddr
    writeU32LE(out, base + 8, chunk.length); // payloadSize
    writeU32LE(out, base + 12, i); // blockNo
    writeU32LE(out, base + 16, numBlocks); // numBlocks
    writeU32LE(out, base + 20, familyId); // family id (flags 0x2000 implied by builder)
    out.set(chunk, base + 32);
    // pad remaining payload to 256 with zeros
    for (let p = chunk.length; p < UF2_PAYLOAD_SIZE; p++) out[base + 32 + p] = 0;
    writeU32LE(out, base + 508, UF2_MAGIC_END);
  }
  return out;
}
