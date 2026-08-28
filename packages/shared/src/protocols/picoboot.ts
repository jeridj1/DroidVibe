/**
 * RP2040 PICOBOOT protocol logic.
 *
 * Builds the 24-byte (6 x uint32 LE) command headers used by the RP2040
 * bootrom PICOBOOT vendor interface, and parses the single-byte ACK response.
 *
 * IMPORTANT — VALIDATION REQUIRED: The RP2040 PICOBOOT protocol must be
 * independently validated against the authoritative Raspberry Pi bootrom
 * implementation before production use. UF2 address handling, command
 * semantics, transfer sizes and reboot parameters must be tested on actual
 * RP2040 hardware (see docs/SECURITY.md). This module encodes the documented
 * command IDs and header layout; it must not be trusted as correct until
 * verified on real hardware.
 *
 * Reference layout (per pico-bootrom picoboot_cmd):
 *   word0 (dMagic)  = PICOBOOT_MAGIC (0x431fd83b)
 *   word1 (dCmd)    = command id
 *   word2 (dAddr)   = address
 *   word3 (dSize)   = transfer size (bytes)
 *   word4 (dParam)  = command-specific parameter
 *   word5 (dParam2) = command-specific parameter (reserved/0)
 *
 * Commands:
 *   PC_EXIT_XIP      = 0x4
 *   PC_ENTER_CMD_XIP = 0x5
 *   PC_REBOOT        = 0x7
 *   PC_READ          = 0x81  (0x01 | 0x80)
 *   PC_WRITE         = 0x82  (0x02 | 0x80)
 *   PC_FLASH_ERASE   = 0x83  (0x03 | 0x80)
 *
 * The device ACKs each command with one byte: 0x00 = OK, non-zero = error.
 * For PC_WRITE, data (up to a page, 256 bytes) is sent after the header; for
 * PC_READ, data is read back from the device after the ACK.
 */
import { PICOBOOT_MAGIC } from './constants.js';

export enum PicobootCmd {
  EXIT_XIP = 0x4,
  ENTER_CMD_XIP = 0x5,
  REBOOT = 0x7,
  READ = 0x81,
  WRITE = 0x82,
  FLASH_ERASE = 0x83,
}

/** RP2040 flash sector size for erase alignment. */
export const FLASH_SECTOR_SIZE = 0x1000; // 4096 bytes
/** Max single PICOBOOT transfer payload (page). */
export const PICOBOOT_PAGE = 256;

function le32(v: number): Uint8Array {
  v = v >>> 0;
  return new Uint8Array([v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]);
}

/** Build a 24-byte PICOBOOT command header. */
export function buildCmd(
  cmd: PicobootCmd,
  addr = 0,
  size = 0,
  param1 = 0,
  param2 = 0,
): Uint8Array {
  const out = new Uint8Array(24);
  out.set(le32(PICOBOOT_MAGIC), 0);
  out.set(le32(cmd), 4);
  out.set(le32(addr >>> 0), 8);
  out.set(le32(size >>> 0), 12);
  out.set(le32(param1 >>> 0), 16);
  out.set(le32(param2 >>> 0), 20);
  return out;
}

export function cmdExitXip(): Uint8Array {
  return buildCmd(PicobootCmd.EXIT_XIP);
}

export function cmdEnterCmdXip(): Uint8Array {
  return buildCmd(PicobootCmd.ENTER_CMD_XIP);
}

/** Erase flash sectors. addr must be 4K-aligned, size a multiple of 4K. */
export function cmdFlashErase(addr: number, size: number): Uint8Array {
  if ((addr & (FLASH_SECTOR_SIZE - 1)) !== 0) {
    throw new Error(`PICOBOOT erase address 0x${addr.toString(16)} not sector-aligned`);
  }
  if ((size & (FLASH_SECTOR_SIZE - 1)) !== 0) {
    throw new Error(`PICOBOOT erase size 0x${size.toString(16)} not a sector multiple`);
  }
  return buildCmd(PicobootCmd.FLASH_ERASE, addr, size);
}

/** Write up to 256 bytes to flash at addr. */
export function cmdWrite(addr: number, size: number): Uint8Array {
  if (size <= 0 || size > PICOBOOT_PAGE) {
    throw new Error(`PICOBOOT write size ${size} out of range (1..${PICOBOOT_PAGE})`);
  }
  return buildCmd(PicobootCmd.WRITE, addr, size);
}

/** Read up to 256 bytes from addr. */
export function cmdRead(addr: number, size: number): Uint8Array {
  if (size <= 0 || size > PICOBOOT_PAGE) {
    throw new Error(`PICOBOOT read size ${size} out of range (1..${PICOBOOT_PAGE})`);
  }
  return buildCmd(PicobootCmd.READ, addr, size);
}

/** Reboot the device. Reboot with 0/0/0 triggers a normal boot to FLASH. */
export function cmdReboot(
  pc = 0,
  sp = 0,
  delayMs = 0,
): Uint8Array {
  // The bootrom REBOOT command carries pc/sp/delay in the address/size/param
  // fields per the documented convention; 0/0/0 = boot to flash.
  return buildCmd(PicobootCmd.REBOOT, pc >>> 0, sp >>> 0, delayMs >>> 0);
}

/** Parse a 1-byte PICOBOOT ACK. 0 = OK. */
export function parseAck(byte: number): { ok: boolean; code: number } {
  return { ok: byte === 0, code: byte };
}

/**
 * Split a flat firmware byte array (at a given flash start address) into a
 * sequence of 256-byte write pages with addresses. Used by the transport to
 * drive a PICOBOOT write loop.
 */
export function planWrites(
  bytes: Uint8Array,
  startAddress = 0,
): { addr: number; data: Uint8Array }[] {
  const out: { addr: number; data: Uint8Array }[] = [];
  for (let off = 0; off < bytes.length; off += PICOBOOT_PAGE) {
    const chunk = bytes.slice(off, off + PICOBOOT_PAGE);
    out.push({ addr: startAddress + off, data: chunk });
  }
  return out;
}

/** Erase plan: aligned sector ranges covering [startAddress, startAddress+size). */
export function planErases(startAddress: number, size: number): { addr: number; size: number }[] {
  const alignedStart = Math.floor(startAddress / FLASH_SECTOR_SIZE) * FLASH_SECTOR_SIZE;
  const end = startAddress + size;
  const alignedEnd = Math.ceil(end / FLASH_SECTOR_SIZE) * FLASH_SECTOR_SIZE;
  return [{ addr: alignedStart, size: alignedEnd - alignedStart }];
}
