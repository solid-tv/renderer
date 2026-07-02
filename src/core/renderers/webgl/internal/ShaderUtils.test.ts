import { describe, expect, it } from 'vitest';
import { genGradientColors } from './ShaderUtils.js';

type Vec4 = [number, number, number, number];

const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
};

const mix = (a: Vec4, b: Vec4, t: number): Vec4 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
  a[3] + (b[3] - a[3]) * t,
];

/**
 * Evaluate the generated GLSL statements as JS. The generated code only uses
 * `mix`, `smoothstep`, `u_colors[i]`, `u_stops[i]` and `dist`, so shimming
 * those makes the string directly executable.
 */
function evalGradient(stops: number[], colors: Vec4[], dist: number): Vec4 {
  const src = genGradientColors(stops.length).replace(
    'vec4 colorOut =',
    'let colorOut =',
  );
  const fn = new Function(
    'mix',
    'smoothstep',
    'u_stops',
    'u_colors',
    'dist',
    `${src}; return colorOut;`,
  );
  return fn(mix, smoothstep, stops, colors, dist) as Vec4;
}

/**
 * Reference implementation: the original branchy segment select
 * (below first stop / above last stop / smoothstep within the segment).
 */
function referenceGradient(
  stops: number[],
  colors: Vec4[],
  dist: number,
): Vec4 {
  dist = Math.min(Math.max(dist, 0), 1);
  if (dist <= stops[0]!) return colors[0]!;
  const last = stops.length - 1;
  if (dist >= stops[last]!) return colors[last]!;
  for (let i = 0; i < last; i++) {
    if (dist >= stops[i]! && dist <= stops[i + 1]!) {
      return mix(
        colors[i]!,
        colors[i + 1]!,
        smoothstep(stops[i]!, stops[i + 1]!, dist),
      );
    }
  }
  return colors[last]!;
}

const RED: Vec4 = [1, 0, 0, 1];
const GREEN: Vec4 = [0, 1, 0, 1];
const BLUE: Vec4 = [0, 0, 1, 0.5];
const WHITE: Vec4 = [1, 1, 1, 1];

describe('genGradientColors', () => {
  it('emits no branches (no if / ternary / return)', () => {
    const src = genGradientColors(4);
    expect(src.includes('if')).toBe(false);
    expect(src.includes('?')).toBe(false);
    expect(src.includes('return')).toBe(false);
  });

  it('with a single stop resolves to the first color', () => {
    const out = evalGradient([0], [RED], 0.7);
    expect(out).toEqual(RED);
  });

  it('clamps to the first color below the first stop', () => {
    const out = evalGradient([0.25, 0.75], [RED, GREEN], 0.1);
    expect(out).toEqual(RED);
  });

  it('clamps to the last color above the last stop', () => {
    const out = evalGradient([0.25, 0.75], [RED, GREEN], 0.9);
    expect(out).toEqual(GREEN);
  });

  it('interpolates with smoothstep inside a segment', () => {
    const dist = 0.5;
    const out = evalGradient([0.25, 0.75], [RED, GREEN], dist);
    const expected = mix(RED, GREEN, smoothstep(0.25, 0.75, dist));
    for (let i = 0; i < 4; i++) {
      expect(out[i]).toBeCloseTo(expected[i]!, 6);
    }
  });

  it('matches the reference segment select across a multi-stop ramp', () => {
    const stops = [0, 0.3, 0.6, 1];
    const colors = [RED, GREEN, BLUE, WHITE];
    for (let d = 0; d <= 100; d++) {
      const dist = d / 100;
      const out = evalGradient(stops, colors, dist);
      const ref = referenceGradient(stops, colors, dist);
      for (let i = 0; i < 4; i++) {
        expect(out[i]).toBeCloseTo(ref[i]!, 6);
      }
    }
  });

  it('is exact at stop boundaries', () => {
    const stops = [0, 0.5, 1];
    const colors = [RED, GREEN, BLUE];
    expect(evalGradient(stops, colors, 0)).toEqual(RED);
    const mid = evalGradient(stops, colors, 0.5);
    for (let i = 0; i < 4; i++) {
      expect(mid[i]).toBeCloseTo(GREEN[i]!, 6);
    }
    expect(evalGradient(stops, colors, 1)).toEqual(BLUE);
  });
});
