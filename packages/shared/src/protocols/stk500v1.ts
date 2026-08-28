/**
 * STK500v1 protocol logic (classic AVR bootloaders — Arduino Uno, Mega).
 *
 * Pure frame builders + a deterministic response parser. The actual byte I/O
 * (DTR/RTS reset, endpoint read/write) is performed by the native transport;
 * this module only constructs and validates protocol traffic.
 */
import { STK500 } from './constants.js';

/** Build a getSync (STK_GET_SYNC + CRC_EOP) command. */
export function cmdGetSync(): Uint8Array {
  return new Uint8Array([STK500.STK_GET_SYNC, STK500.SYNC_CRC_EOP]);
}

/** Build a read-signature command (STK_READ_SIGN + CRC_EOP). */
export function cmdReadSign(): Uint8Array {
  return new Uint8Array([STK500.STK_READ_SIGN, STK500.SYNC_CRC_EOP]);
}

/** Build an enter-progmode command. */
export function cmdEnterProgmode(): Uint8Array {
  return new Uint8Array([STK500.STK_ENTER_PROGMODE, STK500.SYNC_CRC_EOP]);
}

/** Build a leave-progmode command. */
export function cmdLeaveProgmode(): Uint8Array {
  return new Uint8Array([STK500.STK_LEAVE_PROGMODE, STK500.SYNC_CRC_EOP]);
}

/** Build a chip-erase command. */
export function cmdChipErase(): Uint8Array {
  return new Uint8Array([STK500.STK_CHIP_ERASE, STK500.SYNC_CRC_EOP]);
}

/** Build a set-parameter command. */
export function cmdSetParameter(param: number, value: number): Uint8Array {
  return new Uint8Array([STK500.STK_SET_PARAMETER, param, value, STK500.SYNC_CRC_EOP]);
}

/** Build a get-parameter command. */
export function cmdGetParameter(param: number): Uint8Array {
  return new Uint8Array([STK500.STK_GET_PARAMETER, param, STK500.SYNC_CRC_EOP]);
}

/** Build a load-address command. Address is a 16-bit word address (byte>>1). */
export function cmdLoadAddress(address: number): Uint8Array {
  const a = address & 0xffff;
  return new Uint8Array([
    STK500.STK_LOAD_ADDRESS,
    a & 0xff,
    (a >>> 8) & 0xff,
    STK500.SYNC_CRC_EOP,
  ]);
}

/** Build a program-page command: STK_PROG_PAGE + len_hi + len_lo + 'F' + data + CRC_EOP. */
export function cmdProgPage(data: Uint8Array, memType = 0x46 /* 'F' */): Uint8Array {
  const len = data.length;
  const out = new Uint8Array(4 + len + 1);
  out[0] = STK500.STK_PROG_PAGE;
  out[1] = (len >>> 8) & 0xff;
  out[2] = len & 0xff;
  out[3] = memType;
  out.set(data, 4);
  out[4 + len] = STK500.SYNC_CRC_EOP;
  return out;
}

/** Build a read-page command: STK_READ_PAGE + len_hi + len_lo + memType + CRC_EOP. */
export function cmdReadPage(len: number, memType = 0x46): Uint8Array {
  return new Uint8Array([
    STK500.STK_READ_PAGE,
    (len >>> 8) & 0xff,
    len & 0xff,
    memType,
    STK500.SYNC_CRC_EOP,
  ]);
}

export interface Stk500Response {
  inSync: boolean;
  ok: boolean;
  /** Payload bytes returned between INSYNC and OK (e.g. signature). */
  payload: Uint8Array;
  /** Bytes consumed from the input buffer to produce this response. */
  consumed: number;
}

/**
 * Parse a STK500v1 response. Returns null if not enough bytes are available
 * yet (caller should buffer more). Recognises INSYNC [payload] OK and the
 * NOSYNC/NODEVICE error responses.
 */
export function parseStk500Response(buffer: Uint8Array): Stk500Response | null {
  if (buffer.length === 0) return null;
  if (buffer[0] !== STK500.INSYNC) {
    // NOSYNC / NODEVICE style error response — single byte.
    return { inSync: false, ok: false, payload: new Uint8Array(0), consumed: 1 };
  }
  // Find the OK terminator.
  for (let i = 1; i < buffer.length; i++) {
    if (buffer[i] === STK500.OK) {
      const payload = buffer.slice(1, i);
      return { inSync: true, ok: true, payload, consumed: i + 1 };
    }
  }
  return null; // waiting for OK
}

/** Convert a 3-byte signature payload to a hex string like "1e9502". */
export function signatureToString(sig: Uint8Array): string {
  return Array.from(sig)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
