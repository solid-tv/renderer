import { describe, expect, it } from 'vitest';
import {
  BORDER_VALUES_LENGTH,
  calcBorderShaderValues,
} from './RoundedWithBorder.js';
import type { Vec4 } from '../../renderers/webgl/internal/ShaderUtils.js';

const calc = (
  borderWidth: Vec4,
  align: number,
  gap: number,
  radius: Vec4,
  w: number,
  h: number,
): Float32Array => {
  const out = new Float32Array(BORDER_VALUES_LENGTH);
  calcBorderShaderValues(borderWidth, align, gap, radius, w, h, out);
  return out;
};

describe('calcBorderShaderValues', () => {
  it('should compute uniform border, align outside, no gap', () => {
    // border 4 on all sides, align=1 (outside), gap=0, radius 16, 200x100 node
    // adjustedBorderWidth = 4 - 1 + clamp(4, -1, 1) = 4
    const v = calc([4, 4, 4, 4], 1, 0, [16, 16, 16, 16], 200, 100);

    // outerSize = (dimensions + gapSize + borderSize * align) * 0.5
    expect(v[0]).toBe(104);
    expect(v[1]).toBe(54);
    // innerSize = outerSize - borderSize * 0.5
    expect(v[2]).toBe(100);
    expect(v[3]).toBe(50);
    // symmetric border -> zero UV offsets (-0 from sign() * 0 is fine)
    expect(v[4]).toBeCloseTo(0);
    expect(v[5]).toBeCloseTo(0);
    expect(v[6]).toBeCloseTo(0);
    expect(v[7]).toBeCloseTo(0);
    // outerBorderRadius = radius + max(top*align+gap, side*align+gap) = 16 + 4
    expect(v[8]).toBe(20);
    expect(v[9]).toBe(20);
    expect(v[10]).toBe(20);
    expect(v[11]).toBe(20);
    // innerBorderRadius = outer - max(top, side) = 20 - 4
    expect(v[12]).toBe(16);
    expect(v[13]).toBe(16);
    expect(v[14]).toBe(16);
    expect(v[15]).toBe(16);
    // outerSize exceeds half dimensions -> edgeOffset = extraSize + gap
    expect(v[16]).toBe(8);
    expect(v[17]).toBe(8);
  });

  it('should compute asymmetric border with gap and center align', () => {
    // borderWidth [top, right, bottom, left] = [2, 4, 6, 8], align=0.5, gap=2
    // adjusted widths equal inputs since all > 1
    const v = calc([2, 4, 6, 8], 0.5, 2, [10, 10, 10, 10], 100, 80);

    // borderSize = (right+left, top+bottom) = (12, 8); extra = (6, 4)
    // all sides have width -> gapSize = (4, 4)
    // outerSize = ((100+4+6)/2, (80+4+4)/2)
    expect(v[0]).toBe(55);
    expect(v[1]).toBe(44);
    // innerSize = outer - (6, 4)
    expect(v[2]).toBe(49);
    expect(v[3]).toBe(40);
    // borderDiff = (right-left, bottom-top) = (-4, 4); gapDiff = (0, 0)
    // outerUv = (-sign*abs*align*0.5, ...) = (1, -1)
    expect(v[4]).toBe(1);
    expect(v[5]).toBe(-1);
    // innerUv = outerUv + sign*abs*0.5 = (-1, 1)
    expect(v[6]).toBe(-1);
    expect(v[7]).toBe(1);
    // outer radius per corner: 10 + max(adjacent side*0.5 + 2)
    expect(v[8]).toBe(16); // TL: 10 + max(2*0.5+2, 8*0.5+2) = 10 + 6
    expect(v[9]).toBe(14); // TR: 10 + max(3, 4)
    expect(v[10]).toBe(15); // BR: 10 + max(5, 4)
    expect(v[11]).toBe(16); // BL: 10 + max(5, 6)
    // inner radius: outer - max(adjacent widths)
    expect(v[12]).toBe(8); // 16 - max(2, 8)
    expect(v[13]).toBe(10); // 14 - max(2, 4)
    expect(v[14]).toBe(9); // 15 - max(6, 4)
    expect(v[15]).toBe(8); // 16 - max(6, 8)
    // edgeOffset = extraSize + gap
    expect(v[16]).toBe(8);
    expect(v[17]).toBe(6);
  });

  it('should collapse sub-pixel widths like the GLSL adjustment', () => {
    // adjusted = 0.5 - 1 + clamp(0.5) = 0 -> behaves as zero-width sides
    const v = calc([0.5, 0.5, 0.5, 0.5], 1, 2, [10, 10, 10, 10], 100, 100);

    // borderSize = (0, 0); gap only applies to sides >= 0.001 -> none
    expect(v[0]).toBe(50);
    expect(v[1]).toBe(50);
    expect(v[2]).toBe(50);
    expect(v[3]).toBe(50);
    // edgeOffset: outerSize >= halfDimensions -> extra(0) + gap(2)
    expect(v[16]).toBe(2);
    expect(v[17]).toBe(2);
  });

  it('should align inside without growing beyond node bounds', () => {
    // align=0 (inside), border 4, no gap: outerSize = halfDimensions
    const v = calc([4, 4, 4, 4], 0, 0, [10, 10, 10, 10], 100, 100);

    expect(v[0]).toBe(50);
    expect(v[1]).toBe(50);
    expect(v[2]).toBe(46);
    expect(v[3]).toBe(46);
    // outer radius unchanged at align=0, gap=0
    expect(v[8]).toBe(10);
    // inner radius = 10 - 4
    expect(v[12]).toBe(6);
    // outerSize == halfDimensions -> step passes, but extra+gap is 0
    expect(v[16]).toBe(0);
    expect(v[17]).toBe(0);
  });

  it('should clamp negative inner radius to zero', () => {
    // border wider than radius: inner radius would go negative
    const v = calc([12, 12, 12, 12], 1, 0, [4, 4, 4, 4], 200, 200);

    // outer = 4 + 12, inner = 16 - 12 = 4; with radius 0 corners:
    expect(v[8]).toBe(16);
    expect(v[12]).toBe(4);

    const sharp = calc([12, 12, 12, 12], 1, 0, [0, 0, 0, 0], 200, 200);
    expect(sharp[8]).toBe(12);
    expect(sharp[12]).toBe(0);
  });
});
