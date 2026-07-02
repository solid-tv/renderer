import { describe, expect, it } from 'vitest';
import { parseColor } from './colorParser.js';

describe('parseColor', () => {
  it('returns the white singleton for opaque white', () => {
    const first = parseColor(0xffffffff);
    const second = parseColor(0xffffffff);

    expect(first).toBe(second);
    expect(first.isWhite).toBe(true);
    expect(first.a).toBe(1);
    expect(first.r).toBe(0xff);
    expect(first.g).toBe(0xff);
    expect(first.b).toBe(0xff);
  });

  it('extracts abgr components', () => {
    const color = parseColor(0x80102030);

    expect(color.isWhite).toBe(false);
    expect(color.a).toBe(0x80 / 255);
    expect(color.b).toBe(0x10);
    expect(color.g).toBe(0x20);
    expect(color.r).toBe(0x30);
  });

  it('reuses one scratch object across calls', () => {
    const first = parseColor(0x80102030);
    const second = parseColor(0xff405060);

    expect(second).toBe(first);
    expect(second.a).toBe(1);
    expect(second.b).toBe(0x40);
    expect(second.g).toBe(0x50);
    expect(second.r).toBe(0x60);
  });

  it('never returns the white singleton as the scratch object', () => {
    const white = parseColor(0xffffffff);
    const tinted = parseColor(0x80102030);

    expect(tinted).not.toBe(white);
    expect(white.isWhite).toBe(true);
    expect(white.r).toBe(0xff);
  });
});
