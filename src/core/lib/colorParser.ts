export interface IParsedColor {
  isWhite: boolean;
  a: number;
  r: number;
  g: number;
  b: number;
}

const WHITE: IParsedColor = {
  isWhite: true,
  a: 1,
  r: 0xff,
  g: 0xff,
  b: 0xff,
};

const SCRATCH: IParsedColor = {
  isWhite: false,
  a: 1,
  r: 0,
  g: 0,
  b: 0,
};

/**
 * Extract color components.
 *
 * Returns a shared scratch object to avoid a per-call allocation in the
 * canvas frame loop — consume it synchronously, never retain it.
 */
export function parseColor(abgr: number): IParsedColor {
  if (abgr === 0xffffffff) {
    return WHITE;
  }
  SCRATCH.a = ((abgr >>> 24) & 0xff) / 255;
  SCRATCH.b = (abgr >>> 16) & 0xff;
  SCRATCH.g = (abgr >>> 8) & 0xff;
  SCRATCH.r = abgr & 0xff;
  return SCRATCH;
}

export function parseToAbgrString(abgr: number): string {
  const a = ((abgr >>> 24) & 0xff) / 255;
  const b = (abgr >>> 16) & 0xff & 0xff;
  const g = (abgr >>> 8) & 0xff & 0xff;
  const r = abgr & 0xff & 0xff;
  return `rgba(${r},${g},${b},${a})`;
}

export function parseToRgbaString(rgba: number): string {
  const r = (rgba >>> 24) & 0xff;
  const g = (rgba >>> 16) & 0xff & 0xff;
  const b = (rgba >>> 8) & 0xff & 0xff;
  const a = (rgba & 0xff & 0xff) / 255;
  return `rgba(${r},${g},${b},${a})`;
}

/**
 * Extract color components
 */
export function parseColorRgba(rgba: number): IParsedColor {
  if (rgba === 0xffffffff) {
    return WHITE;
  }
  const r = (rgba >>> 24) & 0xff;
  const g = (rgba >>> 16) & 0xff & 0xff;
  const b = (rgba >>> 8) & 0xff & 0xff;
  const a = (rgba & 0xff & 0xff) / 255;
  return { isWhite: false, r, g, b, a };
}

/**
 * Format a parsed color into a rgba CSS color
 */
export function formatRgba({ a, r, g, b }: IParsedColor): string {
  return `rgba(${r},${g},${b},${a})`;
}
