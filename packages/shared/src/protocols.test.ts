import { describe, it, expect } from 'vitest';
import * as stk500 from './protocols/stk500v1.js';
import * as avr109 from './protocols/avr109.js';
import * as esp from './protocols/esp-rom.js';
import * as picoboot from './protocols/picoboot.js';

describe('STK500v1 frames', () => {
  it('getSync frame', () => {
    expect(Array.from(stk500.cmdGetSync())).toEqual([0x30, 0x20]);
  });
  it('loadAddress encodes little-endian', () => {
    expect(Array.from(stk500.cmdLoadAddress(0x1234))).toEqual([0x55, 0x34, 0x12, 0x20]);
  });
  it('parseStk500Response reads signature', () => {
    const resp = new Uint8Array([0x14, 0x1e, 0x95, 0x0f, 0x10]);
    const r = stk500.parseStk500Response(resp);
    expect(r?.inSync).toBe(true);
    expect(stk500.signatureToString(r!.payload)).toBe('1e950f');
  });
});

describe('AVR109 frames', () => {
  it('setAddress frame', () => {
    expect(Array.from(avr109.cmdSetAddress(0x0100))).toEqual([0x41, 0x01, 0x00]);
  });
  it('writePage wraps data with size + memtype', () => {
    const f = avr109.cmdWritePage(new Uint8Array([1, 2, 3]));
    expect(f[0]).toBe(0x42); // 'B'
    expect(f[1]).toBe(0);
    expect(f[2]).toBe(3);
    expect(f[3]).toBe(0x46); // 'F'
  });
});

describe('ESP SLIP framing', () => {
  it('escapes 0xC0 and 0xDB', () => {
    const enc = esp.slipEncode(new Uint8Array([0xc0, 0xdb, 0x01]));
    expect(Array.from(enc)).toEqual([0xdb, 0xdc, 0xdb, 0xdd, 0x01]);
  });
  it('round-trips through encode/decode', () => {
    const payload = new Uint8Array([0xc0, 0x10, 0xdb, 0xff, 0xc0]);
    const framed = esp.slipFrame(payload);
    const decoded = esp.slipDecode(framed);
    expect(Array.from(decoded)).toEqual(Array.from(payload));
  });
});

describe('PICOBOOT planning', () => {
  it('plans 256-byte write pages', () => {
    const plan = picoboot.planWrites(new Uint8Array(300), 0x10000000);
    expect(plan.length).toBe(2);
    expect(plan[0].addr).toBe(0x10000000);
    expect(plan[1].addr).toBe(0x10000100);
  });
  it('plans sector-aligned erases', () => {
    const erases = picoboot.planErases(0x10001000, 0x2000);
    expect(erases[0].addr).toBe(0x10001000);
    expect(erases[0].size).toBe(0x2000);
  });
  it('rejects unaligned erase address', () => {
    expect(() => picoboot.cmdFlashErase(0x1080, 0x1000)).toThrow();
  });
});
