import { describe, it, expect } from 'vitest';
import { createWebGLContext } from './utils.js';
import { ContextSpy } from './core/lib/ContextSpy.js';

describe('createWebGLContext context spy', () => {
  // Build a minimal fake GL context whose getExtension returns a fake
  // OES_vertex_array_object so we can assert the spy counts calls on it.
  function makeContext(spy: ContextSpy) {
    let vaoCounter = 0;
    const ext = {
      createVertexArrayOES: () => ({ id: ++vaoCounter }),
      bindVertexArrayOES: (_vao: unknown) => undefined,
      deleteVertexArrayOES: (_vao: unknown) => undefined,
    };
    const gl = {
      getExtension: (name: string) =>
        name === 'OES_vertex_array_object' ? ext : null,
      viewport: () => undefined,
    };
    const canvas = {
      getContext: () => gl,
    } as unknown as HTMLCanvasElement;
    return createWebGLContext(canvas, false, spy);
  }

  it('counts methods on extension objects returned by getExtension', () => {
    const spy = new ContextSpy();
    const gl = makeContext(spy);

    // WebGL1 VAO calls route through the extension object.
    const ext = gl.getExtension('OES_vertex_array_object') as unknown as {
      createVertexArrayOES: () => unknown;
      bindVertexArrayOES: (vao: unknown) => void;
    };
    const vao = ext.createVertexArrayOES();
    ext.bindVertexArrayOES(vao);
    ext.bindVertexArrayOES(null);

    const data = spy.getData();
    expect(data['getExtension']).toBeGreaterThan(0);
    expect(data['createVertexArrayOES']).toBe(1);
    expect(data['bindVertexArrayOES']).toBe(2);
  });

  it('passes through a null extension without throwing', () => {
    const spy = new ContextSpy();
    const gl = makeContext(spy);
    expect(gl.getExtension('NOPE' as 'OES_vertex_array_object')).toBe(null);
  });

  it('still counts direct context calls', () => {
    const spy = new ContextSpy();
    const gl = makeContext(spy);
    gl.viewport(0, 0, 1, 1);
    expect(spy.getData()['viewport']).toBe(1);
  });
});
