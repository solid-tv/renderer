import { describe, expect, it } from 'vitest';
import { LinearGradient } from './LinearGradient.js';
import { normalizeCanvasColor } from '../../lib/colorCache.js';

/**
 * Invoke the canvas LinearGradient `update()` with a minimal fake shader node
 * and return the computed CSS color strings.
 */
function computeColors(colors: number[]): string[] {
  const ctx = {
    props: { colors, stops: [0, 1], angle: 0 },
    computed: undefined as unknown,
    toColorString: (value: number) => normalizeCanvasColor(value, true),
  };
  // Colors are RGBA encoded (alpha in the low byte) — see parseToRgbaString.
  LinearGradient.update!.call(ctx as never, { w: 100, h: 100 } as never);
  return (ctx.computed as { colors: string[] }).colors;
}

describe('canvas LinearGradient color mapping', () => {
  it('preserves per-stop alpha (no opaque fallback)', () => {
    // 0x00ff0080 is a half-transparent green stop. The previous
    // "nearest opaque RGB" workaround mis-read the high byte as alpha
    // (it is actually red in RGBA) and overwrote the low byte, turning
    // transparent stops solid. The faithful mapping must keep alpha ~0.5.
    const [opaqueRed, halfGreen] = computeColors([0xff0000ff, 0x00ff0080]);

    expect(opaqueRed).toBe('rgba(255,0,0,1)');
    expect(halfGreen).toBe(`rgba(0,255,0,${0x80 / 255})`);
  });

  it('keeps fully transparent stops transparent', () => {
    const [, transparent] = computeColors([0x000000ff, 0x00000000]);
    expect(transparent).toBe('rgba(0,0,0,0)');
  });

  it('maps every stop straight through toColorString', () => {
    const colors = [0xff0000ff, 0x00ff00ff, 0x0000ffff];
    expect(computeColors(colors)).toEqual([
      'rgba(255,0,0,1)',
      'rgba(0,255,0,1)',
      'rgba(0,0,255,1)',
    ]);
  });
});
