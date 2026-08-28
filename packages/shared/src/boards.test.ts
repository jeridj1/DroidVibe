import { describe, it, expect } from 'vitest';
import { identifyBoard, guessProtocol } from './boards.js';

describe('board identification', () => {
  it('identifies Arduino Uno R3', () => {
    const b = identifyBoard('2341', '0043');
    expect(b?.name).toBe('Arduino Uno R3');
    expect(b?.protocol).toBe('stk500v1');
  });

  it('identifies RP2040 Pico in BOOTSEL', () => {
    const b = identifyBoard('2e8a', '0003');
    expect(b?.protocol).toBe('picoboot');
  });

  it('returns null for unknown VID/PID', () => {
    expect(identifyBoard('abcd', '1234')).toBeNull();
  });

  it('guesses a default protocol for unknown devices', () => {
    expect(guessProtocol('abcd', '1234')).toBe('stk500v1');
  });

  it('normalises hex with 0x prefix', () => {
    expect(identifyBoard('0x2E8A', '0x0003')?.protocol).toBe('picoboot');
  });
});
