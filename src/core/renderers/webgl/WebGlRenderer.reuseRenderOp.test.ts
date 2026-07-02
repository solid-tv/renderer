import { describe, expect, it, vi } from 'vitest';
import { WebGlRenderer } from './WebGlRenderer.js';

/**
 * Tests for the shader-node batching gate in WebGlRenderer.reuseRenderOp.
 *
 * A full renderer needs a live GL context, so the method is exercised on a
 * minimal fake `this` holding only curRenderOp. Nodes and shader nodes are
 * plain objects with the fields reuseRenderOp reads.
 */

const clippingRect = { x: 0, y: 0, w: 0, h: 0, valid: false };

type FakeShaderNode = {
  shaderKey: string;
  program: { reuseRenderOp: ReturnType<typeof vi.fn> };
  uniforms: object;
  resolvedProps: Record<string, unknown>;
};

const makeShaderNode = (
  program: FakeShaderNode['program'],
  uniforms: object,
  shaderKey = 'Rounded',
): FakeShaderNode => ({
  shaderKey,
  program,
  uniforms,
  resolvedProps: { radius: [16, 16, 16, 16] },
});

const makeProgram = (batches = true) => ({
  reuseRenderOp: vi.fn(() => batches),
});

// Node shape shared by the op anchor and the incoming quad
const makeNode = (shader: FakeShaderNode) => ({
  isCoreNode: true,
  parentHasRenderTexture: false,
  parentFramebufferDimensions: null,
  rtt: false,
  clippingRect,
  props: { rtt: false, shader },
  shader,
});

const reuse = (curRenderOp: unknown, node: unknown): boolean =>
  WebGlRenderer.prototype.reuseRenderOp.call(
    { curRenderOp } as WebGlRenderer,
    node as never,
  );

describe('WebGlRenderer.reuseRenderOp shader batching', () => {
  it('rejects when there is no current render op', () => {
    const shader = makeShaderNode(makeProgram(), {});
    expect(reuse(null, makeNode(shader))).toBe(false);
  });

  it('batches two quads using the same shader node', () => {
    const shader = makeShaderNode(makeProgram(), {});

    expect(reuse(makeNode(shader), makeNode(shader))).toBe(true);
    expect(shader.program.reuseRenderOp.mock.calls.length).toBe(1);
  });

  it('batches distinct shader nodes sharing program and uniform collection', () => {
    const program = makeProgram();
    const uniforms = {};
    const shaderA = makeShaderNode(program, uniforms);
    const shaderB = makeShaderNode(program, uniforms);

    expect(reuse(makeNode(shaderA), makeNode(shaderB))).toBe(true);
  });

  it('rejects distinct shader nodes with different uniform collections', () => {
    const program = makeProgram();
    const shaderA = makeShaderNode(program, {});
    const shaderB = makeShaderNode(program, {});

    expect(reuse(makeNode(shaderA), makeNode(shaderB))).toBe(false);
    // Gate rejects before the program-level prop compare runs
    expect(program.reuseRenderOp.mock.calls.length).toBe(0);
  });

  it('rejects equal uniform collections from different programs', () => {
    // The shader value key does not include the shader type, so a collection
    // shared across programs (key collision) must never merge draw calls.
    const uniforms = {};
    const shaderA = makeShaderNode(makeProgram(), uniforms, 'TypeA');
    const shaderB = makeShaderNode(makeProgram(), uniforms, 'TypeB');

    expect(reuse(makeNode(shaderA), makeNode(shaderB))).toBe(false);
  });

  it('batches default-shader quads without consulting the program', () => {
    const shaderA = makeShaderNode(makeProgram(), {}, 'default');
    const shaderB = makeShaderNode(makeProgram(), {}, 'default');

    expect(reuse(makeNode(shaderA), makeNode(shaderB))).toBe(true);
    expect(shaderA.program.reuseRenderOp.mock.calls.length).toBe(0);
  });

  it('rejects when clipping rects differ', () => {
    const shader = makeShaderNode(makeProgram(), {});
    const node = makeNode(shader);
    node.clippingRect = { x: 0, y: 0, w: 100, h: 100, valid: true };

    expect(reuse(makeNode(shader), node)).toBe(false);
  });

  it('defers to the program-level check for batched shader nodes', () => {
    const program = makeProgram(false);
    const uniforms = {};
    const shaderA = makeShaderNode(program, uniforms);
    const shaderB = makeShaderNode(program, uniforms);

    // Same program + shared collection passes the gate, but the program can
    // still veto (e.g. worldAlpha mismatch on a u_alpha shader).
    expect(reuse(makeNode(shaderA), makeNode(shaderB))).toBe(false);
    expect(program.reuseRenderOp.mock.calls.length).toBe(1);
  });
});
