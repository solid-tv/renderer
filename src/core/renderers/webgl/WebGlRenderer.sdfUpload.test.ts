import { describe, expect, it } from 'vitest';
import { WebGlRenderer } from './WebGlRenderer.js';

/**
 * Tests for the static-SDF-buffer upload skip.
 *
 * The renderer instance is created without running the constructor (which
 * requires a live WebGL context); only the fields the tested methods touch
 * are populated.
 */
const makeRenderer = (): WebGlRenderer => {
  const renderer = Object.create(
    WebGlRenderer.prototype,
  ) as unknown as WebGlRenderer;
  renderer.sdfBufferChanged = true;
  renderer.lastSdfUploadSize = -1;
  renderer.sdfBufferIdx = 0;
  return renderer;
};

describe('shouldUploadSdfBuffer', () => {
  it('should upload on the first frame', () => {
    const renderer = makeRenderer();
    renderer.sdfBufferIdx = 240;

    expect(renderer.shouldUploadSdfBuffer()).toBe(true);
  });

  it('should skip when content is unchanged and size matches last upload', () => {
    const renderer = makeRenderer();
    renderer.sdfBufferChanged = false;
    renderer.sdfBufferIdx = 240;
    renderer.lastSdfUploadSize = 240;

    expect(renderer.shouldUploadSdfBuffer()).toBe(false);
  });

  it('should upload when a cache-miss write occurred even at matching size', () => {
    const renderer = makeRenderer();
    renderer.sdfBufferChanged = true;
    renderer.sdfBufferIdx = 240;
    renderer.lastSdfUploadSize = 240;

    expect(renderer.shouldUploadSdfBuffer()).toBe(true);
  });

  it('should upload when the used size differs from the last upload', () => {
    const renderer = makeRenderer();
    renderer.sdfBufferChanged = false;
    renderer.sdfBufferIdx = 120;
    renderer.lastSdfUploadSize = 240;

    expect(renderer.shouldUploadSdfBuffer()).toBe(true);
  });
});

describe('sdfBufferChanged invalidation hooks', () => {
  it('should be set by SDF buffer growth and preserved data', () => {
    const renderer = makeRenderer();
    const initial = new ArrayBuffer(8 * Float32Array.BYTES_PER_ELEMENT);
    renderer.sdfBuffer = initial;
    renderer.fSdfBuffer = new Float32Array(initial);
    renderer.uiSdfBuffer = new Uint32Array(initial);
    renderer.fSdfBuffer[0] = 42;
    renderer.sdfBufferChanged = false;

    // Within capacity: no growth, no flag
    (renderer as never as Record<string, (n: number) => void>)[
      'ensureSdfBufferCapacity'
    ]!(8);
    expect(renderer.sdfBufferChanged).toBe(false);
    expect(renderer.fSdfBuffer.length).toBe(8);

    // Beyond capacity: growth sets the flag and copies data
    (renderer as never as Record<string, (n: number) => void>)[
      'ensureSdfBufferCapacity'
    ]!(16);
    expect(renderer.sdfBufferChanged).toBe(true);
    expect(renderer.fSdfBuffer.length >= 16).toBe(true);
    expect(renderer.fSdfBuffer[0]).toBe(42);
  });

  it('should be set by invalidateQuadBuffer (render list rebuild)', () => {
    const renderer = makeRenderer();
    renderer.sdfBufferChanged = false;
    (renderer as never as { stage: { renderList: never[] } }).stage = {
      renderList: [],
    };
    renderer.curBufferIdx = 0;

    renderer.invalidateQuadBuffer();

    expect(renderer.sdfBufferChanged).toBe(true);
  });
});
