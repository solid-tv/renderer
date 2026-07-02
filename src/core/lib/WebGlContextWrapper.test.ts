import { describe, it, expect } from 'vitest';
import { WebGlContextWrapper } from './WebGlContextWrapper.js';

// The wrapper reads `self.WebGL2RenderingContext` to detect WebGL2. The unit
// test environment is plain Node where `self` is undefined, so provide one.
// With no WebGL2RenderingContext on it, the mock context is treated as WebGL1.
const g = globalThis as unknown as { self?: unknown };
if (g.self === undefined) {
  g.self = globalThis;
}

// Minimal WebGL1-like context. A Proxy returns 0 for every GLenum constant the
// constructor copies; only the handful of methods/props it actually calls are
// implemented.
function mockWebGl1(hasVaoExtension: boolean): WebGLRenderingContext {
  const vaoExt = {
    createVertexArrayOES: () => ({}),
    bindVertexArrayOES: (_vao: unknown) => undefined,
    deleteVertexArrayOES: (_vao: unknown) => undefined,
  };
  const target: Record<string, unknown> = {
    canvas: { width: 1920, height: 1080 },
    drawingBufferWidth: 100,
    drawingBufferHeight: 100,
    getParameter: () => 8,
    getExtension: (name: string) =>
      name === 'OES_vertex_array_object' && hasVaoExtension ? vaoExt : null,
  };
  return new Proxy(target, {
    get(t, prop) {
      if (prop in t) {
        return t[prop as string];
      }
      // Every other access is a GLenum constant.
      return 0;
    },
  }) as unknown as WebGLRenderingContext;
}

describe('WebGlContextWrapper VAO support', () => {
  it('enables VAOs when the OES extension is present', () => {
    const glw = new WebGlContextWrapper(mockWebGl1(true));
    expect(glw.canUseVertexArrayObject).toBe(true);
    expect(glw.isWebGl2).toBe(false);
  });

  it('disables VAOs when the OES extension is absent', () => {
    const glw = new WebGlContextWrapper(mockWebGl1(false));
    expect(glw.canUseVertexArrayObject).toBe(false);
  });

  it('forces VAOs off when disableVertexArrayObject is true, even if supported', () => {
    const glw = new WebGlContextWrapper(mockWebGl1(true), true);
    expect(glw.canUseVertexArrayObject).toBe(false);
    // The flag gates VAO usage only; it does not change the detected context.
    expect(glw.isWebGl2).toBe(false);
  });
});

describe('WebGlContextWrapper canvas dimension cache', () => {
  it('seeds canvasW/canvasH from the canvas at construction', () => {
    const glw = new WebGlContextWrapper(mockWebGl1(true));
    expect(glw.canvasW).toBe(1920);
    expect(glw.canvasH).toBe(1080);
  });

  it('does not track canvas resizes until updateCanvasDimensions is called', () => {
    const glw = new WebGlContextWrapper(mockWebGl1(true));
    const canvas = glw.canvas as { width: number; height: number };

    canvas.width = 1280;
    canvas.height = 720;
    expect(glw.canvasW).toBe(1920);
    expect(glw.canvasH).toBe(1080);

    glw.updateCanvasDimensions();
    expect(glw.canvasW).toBe(1280);
    expect(glw.canvasH).toBe(720);
  });
});
