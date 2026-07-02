import { describe, expect, it } from 'vitest';
import { LinearGradient } from './LinearGradient.js';

interface GradUniforms {
  a: [number, number];
  b: number;
}

/**
 * Invoke the WebGL LinearGradient `update()` with a fake shader node that
 * captures the gradient uniforms (`u_grad_a` / `u_grad_b`). The fragment
 * shader computes `dist = dot(v_textureCoords, u_grad_a) + u_grad_b`, so these
 * uniforms fully define the gradient ramp.
 */
function computeGrad(angle: number, w: number, h: number): GradUniforms {
  const out: GradUniforms = { a: [0, 0], b: 0 };
  const ctx = {
    props: { colors: [0x000000ff, 0xffffffff], stops: [0, 1], angle },
    uniform2f: (name: string, v0: number, v1: number) => {
      if (name === 'u_grad_a') out.a = [v0, v1];
    },
    uniform1f: (name: string, v: number) => {
      if (name === 'u_grad_b') out.b = v;
    },
    uniform1fv: () => undefined,
    uniform4fv: () => undefined,
  };
  LinearGradient.update!.call(ctx as never, { w, h } as never);
  return out;
}

const distAt = (g: GradUniforms, tx: number, ty: number) =>
  tx * g.a[0] + ty * g.a[1] + g.b;

describe('webgl LinearGradient gradient uniforms', () => {
  it('angle 0 ramps top -> bottom across the node-local box', () => {
    const g = computeGrad(0, 200, 100);
    expect(g.a[0]).toBeCloseTo(0, 5);
    expect(g.a[1]).toBeCloseTo(1, 5);
    expect(g.b).toBeCloseTo(0, 5);
    // dist runs 0 (top) -> 1 (bottom)
    expect(distAt(g, 0.5, 0)).toBeCloseTo(0, 5);
    expect(distAt(g, 0.5, 1)).toBeCloseTo(1, 5);
  });

  it('angle 90deg ramps horizontally', () => {
    const g = computeGrad(Math.PI / 2, 200, 100);
    expect(g.a[0]).toBeCloseTo(-1, 5);
    expect(g.a[1]).toBeCloseTo(0, 5);
    expect(distAt(g, 0, 0.5)).toBeCloseTo(1, 5);
    expect(distAt(g, 1, 0.5)).toBeCloseTo(0, 5);
  });

  it('endpoints stay within [0,1] for an arbitrary angle', () => {
    const g = computeGrad(Math.PI / 4, 640, 360);
    // Box corners must map into the clampable [0,1] ramp range.
    const corners = [
      distAt(g, 0, 0),
      distAt(g, 1, 0),
      distAt(g, 0, 1),
      distAt(g, 1, 1),
    ];
    for (let i = 0; i < corners.length; i++) {
      expect(corners[i]).toBeGreaterThanOrEqual(-1e-6);
      expect(corners[i]).toBeLessThanOrEqual(1 + 1e-6);
    }
    // The gradient axis is symmetric about the box center -> dist = 0.5 there.
    expect(distAt(g, 0.5, 0.5)).toBeCloseTo(0.5, 5);
  });
});
