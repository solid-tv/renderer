import { describe, expect, it, vi } from 'vitest';
import { WebGlShaderProgram } from './WebGlShaderProgram.js';

/**
 * Tests for the redundant-uniform-upload skip in bindRenderOp.
 *
 * The program instance is created without running the constructor (which
 * compiles GLSL against a live GL context); the fields bindRenderOp touches
 * are populated manually, and bindTextures/bindBufferCollection are stubbed.
 */

type FakeGlw = {
  uniform1f: ReturnType<typeof vi.fn>;
  uniform2f: ReturnType<typeof vi.fn>;
  uniform4f: ReturnType<typeof vi.fn>;
  canvasW: number;
  canvasH: number;
};

const makeProgram = (): { program: WebGlShaderProgram; glw: FakeGlw } => {
  const glw: FakeGlw = {
    uniform1f: vi.fn(),
    uniform2f: vi.fn(),
    uniform4f: vi.fn(),
    canvasW: 1920,
    canvasH: 1080,
  };

  const program = Object.create(
    WebGlShaderProgram.prototype,
  ) as WebGlShaderProgram;
  const p = program as unknown as Record<string, unknown>;
  p['glw'] = glw;
  p['useSystemAlpha'] = true;
  p['useSystemDimensions'] = true;
  p['useTimeValue'] = false;
  p['lastBoundUniforms'] = null;
  p['lastPixelRatio'] = -1;
  p['lastResolutionW'] = -1;
  p['lastResolutionH'] = -1;
  p['lastAlpha'] = -1;
  p['lastDimensionsW'] = -1;
  p['lastDimensionsH'] = -1;
  p['lastTime'] = -1;
  // Stub the buffer/texture binding done before the uniform pass
  p['bindTextures'] = vi.fn();
  p['bindBufferCollection'] = vi.fn();
  return { program, glw };
};

const makeUniforms = () => ({
  single: {
    u_borderGap: { method: 'uniform1f', value: 0 },
  },
  vec2: {},
  vec3: {},
  vec4: {
    u_radius: { method: 'uniform4f', value: [16, 16, 16, 16] },
  },
});

const makeOp = (
  uniforms: ReturnType<typeof makeUniforms>,
  overrides?: Record<string, unknown>,
) => ({
  isCoreNode: true,
  rtt: false,
  parentHasRenderTexture: false,
  parentFramebufferDimensions: null,
  framebufferDimensions: null,
  stage: { pixelRatio: 2 },
  time: 0,
  worldAlpha: 1,
  w: 200,
  h: 100,
  renderOpTextures: [],
  quadBufferCollection: {},
  shader: { props: {}, uniforms },
  ...overrides,
});

const totalCalls = (glw: FakeGlw): number =>
  glw.uniform1f.mock.calls.length +
  glw.uniform2f.mock.calls.length +
  glw.uniform4f.mock.calls.length;

describe('bindRenderOp uniform dedup', () => {
  it('should upload everything on the first bind', () => {
    const { program, glw } = makeProgram();
    const uniforms = makeUniforms();

    program.bindRenderOp(makeOp(uniforms) as never);

    // u_pixelRatio, u_alpha, u_borderGap (1f) + u_resolution, u_dimensions (2f) + u_radius (4f)
    expect(glw.uniform1f.mock.calls.length).toBe(3);
    expect(glw.uniform2f.mock.calls.length).toBe(2);
    expect(glw.uniform4f.mock.calls.length).toBe(1);
  });

  it('should issue zero uniform calls on an identical re-bind', () => {
    const { program, glw } = makeProgram();
    const uniforms = makeUniforms();

    program.bindRenderOp(makeOp(uniforms) as never);
    glw.uniform1f.mockClear();
    glw.uniform2f.mockClear();
    glw.uniform4f.mockClear();

    program.bindRenderOp(makeOp(uniforms) as never);

    expect(totalCalls(glw)).toBe(0);
  });

  it('should skip across interleaved ops (shared collection, different op objects)', () => {
    const { program, glw } = makeProgram();
    const uniforms = makeUniforms();

    // Two distinct ops (different cards) sharing the value-cached collection
    program.bindRenderOp(makeOp(uniforms) as never);
    glw.uniform1f.mockClear();
    glw.uniform2f.mockClear();
    glw.uniform4f.mockClear();

    // GL uniform state persists on the program across useProgram switches,
    // so an op of another program in between changes nothing here.
    program.bindRenderOp(makeOp(uniforms) as never);

    expect(totalCalls(glw)).toBe(0);
  });

  it('should re-upload only the changed system uniform', () => {
    const { program, glw } = makeProgram();
    const uniforms = makeUniforms();

    program.bindRenderOp(makeOp(uniforms) as never);
    glw.uniform1f.mockClear();
    glw.uniform2f.mockClear();
    glw.uniform4f.mockClear();

    program.bindRenderOp(makeOp(uniforms, { worldAlpha: 0.5 }) as never);

    expect(glw.uniform1f.mock.calls.length).toBe(1);
    expect(glw.uniform1f.mock.calls[0]![0]).toBe('u_alpha');
    expect(glw.uniform1f.mock.calls[0]![1]).toBe(0.5);
    expect(glw.uniform2f.mock.calls.length).toBe(0);
    expect(glw.uniform4f.mock.calls.length).toBe(0);
  });

  it('should re-upload dimensions when the op size differs', () => {
    const { program, glw } = makeProgram();
    const uniforms = makeUniforms();

    program.bindRenderOp(makeOp(uniforms) as never);
    glw.uniform2f.mockClear();

    program.bindRenderOp(makeOp(uniforms, { w: 300, h: 150 }) as never);

    expect(glw.uniform2f.mock.calls.length).toBe(1);
    expect(glw.uniform2f.mock.calls[0]![0]).toBe('u_dimensions');
  });

  it('should re-run the collection pass for a different collection object', () => {
    const { program, glw } = makeProgram();
    const uniformsA = makeUniforms();
    const uniformsB = makeUniforms(); // identical values, distinct identity

    program.bindRenderOp(makeOp(uniformsA) as never);
    glw.uniform1f.mockClear();
    glw.uniform4f.mockClear();

    program.bindRenderOp(makeOp(uniformsB) as never);

    // Conservative direction: new object => redundant upload, never a skip
    expect(glw.uniform1f.mock.calls.length).toBe(1); // u_borderGap
    expect(glw.uniform4f.mock.calls.length).toBe(1); // u_radius
  });

  it('should re-upload pixel ratio and resolution across an RTT flip', () => {
    const { program, glw } = makeProgram();
    const uniforms = makeUniforms();

    program.bindRenderOp(makeOp(uniforms) as never);
    glw.uniform1f.mockClear();
    glw.uniform2f.mockClear();

    // RTT op: pixelRatio forced to 1, resolution = framebuffer dimensions
    program.bindRenderOp(
      makeOp(uniforms, {
        isCoreNode: false,
        parentHasRenderTexture: true,
        framebufferDimensions: { w: 512, h: 256 },
      }) as never,
    );

    const calls1f = glw.uniform1f.mock.calls;
    const calls2f = glw.uniform2f.mock.calls;
    expect(calls1f.some((c) => c[0] === 'u_pixelRatio' && c[1] === 1)).toBe(
      true,
    );
    expect(calls2f.some((c) => c[0] === 'u_resolution' && c[1] === 512)).toBe(
      true,
    );

    glw.uniform1f.mockClear();
    glw.uniform2f.mockClear();

    // Back to screen: values flip back and must re-upload
    program.bindRenderOp(makeOp(uniforms) as never);
    expect(
      glw.uniform1f.mock.calls.some(
        (c) => c[0] === 'u_pixelRatio' && c[1] === 2,
      ),
    ).toBe(true);
    expect(
      glw.uniform2f.mock.calls.some(
        (c) => c[0] === 'u_resolution' && c[1] === 1920,
      ),
    ).toBe(true);
  });

  it('should skip the collection pass entirely for propless shaders', () => {
    const { program, glw } = makeProgram();

    program.bindRenderOp(
      makeOp(makeUniforms(), {
        shader: { props: undefined, uniforms: makeUniforms() },
      }) as never,
    );

    // Only system uniforms: pixelRatio + alpha (1f), resolution + dimensions (2f)
    expect(glw.uniform1f.mock.calls.length).toBe(2);
    expect(glw.uniform2f.mock.calls.length).toBe(2);
    expect(glw.uniform4f.mock.calls.length).toBe(0);
  });
});
