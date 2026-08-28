/**
 * AVR109 / Caterina protocol logic (Leonardo, Micro, Pro Micro, Flora).
 *
 * ASCII command based. Caterina re-enumerates after a 1200-baud touch on the
 * CDC-ACM port; the native transport handles the re-enumeration wait, then
 * uses these frames for programming.
 */
import { AVR109 } from './constants.js';

function str(s: string): Uint8Array {
  return new Uint8Array(Array.from(s).map((c) => c.charCodeAt(0)));
}

export function cmdEnterProgmode(): Uint8Array {
  return str(AVR109.CMD_ENTER_PROGMODE);
}
export function cmdLeaveProgmode(): Uint8Array {
  return str(AVR109.CMD_LEAVE_PROGMODE);
}
export function cmdChipErase(): Uint8Array {
  return str(AVR109.CMD_CHIP_ERASE);
}
export function cmdReadSign(): Uint8Array {
  return str(AVR109.CMD_READ_SIGN);
}
export function cmdReadVersion(): Uint8Array {
  return str(AVR109.CMD_READ_VERSION);
}
export function cmdReadPartcode(): Uint8Array {
  return str(AVR109.CMD_READ_PARTCODE);
}

/** Set the 16-bit word address for page operations. */
export function cmdSetAddress(wordAddress: number): Uint8Array {
  const a = wordAddress & 0xffff;
  return new Uint8Array([
    AVR109.CMD_SET_ADDRESS.charCodeAt(0),
    (a >>> 8) & 0xff,
    a & 0xff,
  ]);
}

/** Build a write-page command: 'B' + sizeHi + sizeLo + 'F' + data. */
export function cmdWritePage(data: Uint8Array, memType = AVR109.MEMTYPE_FLASH): Uint8Array {
  const len = data.length;
  const out = new Uint8Array(4 + len);
  out[0] = AVR109.CMD_WRITE_PAGE.charCodeAt(0);
  out[1] = (len >>> 8) & 0xff;
  out[2] = len & 0xff;
  out[3] = memType.charCodeAt(0);
  out.set(data, 4);
  return out;
}

/** Build a read-page command: 'g' + sizeHi + sizeLo + memType. */
export function cmdReadPage(len: number, memType = AVR109.MEMTYPE_FLASH): Uint8Array {
  return new Uint8Array([
    AVR109.CMD_READ_PAGE.charCodeAt(0),
    (len >>> 8) & 0xff,
    len & 0xff,
    memType.charCodeAt(0),
  ]);
}

/** Check auto-incrementing address support (returns 'Y'/'N'). */
export function cmdCheckAutoaddress(): Uint8Array {
  return str(AVR109.CMD_CHECK_AUTOADDRESS);
}

/** AVR109 read-sign returns 3 bytes; convert to hex. */
export function parseSignature(buf: Uint8Array): string {
  return Array.from(buf.slice(0, 3))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Recognise the single-CR ack that most AVR109 commands return. */
export function isAck(buf: Uint8Array): boolean {
  return buf.length > 0 && buf[0] === AVR109.RESP_OK;
}
