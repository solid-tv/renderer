import { describe, expect, it, vi } from 'vitest';
import { WebGlShaderProgram } from './WebGlShaderProgram.js';

/**
 * Tests for the batch test in WebGlShaderProgram.reuseRenderOp.
 *
 * The program instance is created without running the constructor (which
 * compiles GLSL against a live GL context); only the fields reuseRenderOp
 * touches are populated manually.
 */

type ProgramFlags = {
  useSystemAlpha?: boolean;
  useSystemDimensions?: boolean;
  useTimeValue?: boolean;
  canBatch?: (node: unknown, op: unknown) => boolean;
};

const makeProgram = (flags: ProgramFlags = {}): WebGlShaderProgram => {
  const program = Object.create(
    WebGlShaderProgram.prototype,
  ) as WebGlShaderProgram;
  const p = program as unknown as Record<string, unknown>;
  p['useSystemAlpha'] = flags.useSystemAlpha === true;
  p['useSystemDimensions'] = flags.useSystemDimensions === true;
  p['useTimeValue'] = flags.useTimeValue === true;
  p['lifecycle'] = { canBatch: flags.canBatch, update: undefined };
  return program;
};

type FakeShaderNode = {
  uniforms: object;
  resolvedProps: Record<string, unknown> | undefined;
};

const makeShaderNode = (
  uniforms: object,
  resolvedProps?: Record<string, unknown>,
): FakeShaderNode => ({ uniforms, resolvedProps });

const makeNode = (
  shader: FakeShaderNode,
  overrides?: Record<string, unknown>,
) => ({
  worldAlpha: 1,
  w: 200,
  h: 100,
  props: { shader },
  ...overrides,
});

const makeOp = (shader: FakeShaderNode, overrides?: Record<string, unknown>) =>
  ({
    time: 0,
    worldAlpha: 1,
    w: 200,
    h: 100,
    shader,
    ...overrides,
  } as never);

describe('WebGlShaderProgram.reuseRenderOp', () => {
  it('batches the same shader node without comparing props', () => {
    const program = makeProgram();
    const shader = makeShaderNode({}, { radius: 16 });

    expect(
      program.reuseRenderOp(makeNode(shader) as never, makeOp(shader)),
    ).toBe(true);
  });

  it('batches distinct shader nodes that share a uniform collection', () => {
    const program = makeProgram();
    const uniforms = {};
    // Distinct resolvedProps objects — reference-inequal props must not matter
    // when the value-key cache handed both nodes the same collection.
    const shaderA = makeShaderNode(uniforms, { radius: [16, 16, 16, 16] });
    const shaderB = makeShaderNode(uniforms, { radius: [16, 16, 16, 16] });

    expect(
      program.reuseRenderOp(makeNode(shaderA) as never, makeOp(shaderB)),
    ).toBe(true);
  });

  it('falls back to a prop-value compare for distinct collections', () => {
    const program = makeProgram();
    const shaderA = makeShaderNode({}, { radius: 16, gap: 2 });
    const shaderB = makeShaderNode({}, { radius: 16, gap: 2 });
    const shaderC = makeShaderNode({}, { radius: 16, gap: 4 });

    expect(
      program.reuseRenderOp(makeNode(shaderA) as never, makeOp(shaderB)),
    ).toBe(true);
    expect(
      program.reuseRenderOp(makeNode(shaderA) as never, makeOp(shaderC)),
    ).toBe(false);
  });

  it('rejects on system alpha mismatch before any shader compare', () => {
    const program = makeProgram({ useSystemAlpha: true });
    const shader = makeShaderNode({});

    expect(
      program.reuseRenderOp(
        makeNode(shader, { worldAlpha: 0.5 }) as never,
        makeOp(shader),
      ),
    ).toBe(false);
  });

  it('rejects on dimension mismatch when the program uses u_dimensions', () => {
    const program = makeProgram({ useSystemDimensions: true });
    const shader = makeShaderNode({});

    expect(
      program.reuseRenderOp(
        makeNode(shader, { w: 300 }) as never,
        makeOp(shader),
      ),
    ).toBe(false);
  });

  it('does not read node.time when the program has no time uniform', () => {
    const program = makeProgram();
    const shader = makeShaderNode({});
    const node = makeNode(shader);
    let timeReads = 0;
    Object.defineProperty(node, 'time', {
      get: () => {
        timeReads++;
        return 0;
      },
    });

    program.reuseRenderOp(node as never, makeOp(shader));

    expect(timeReads).toBe(0);
  });

  it('delegates to the shader type canBatch hook when defined', () => {
    const canBatch = vi.fn(() => false);
    const program = makeProgram({ canBatch });
    const shader = makeShaderNode({});

    expect(
      program.reuseRenderOp(makeNode(shader) as never, makeOp(shader)),
    ).toBe(false);
    expect(canBatch.mock.calls.length).toBe(1);
  });
});
