import { describe, expect, it, vi } from 'vitest';
import { WebGlRenderer } from './WebGlRenderer.js';

/**
 * Tests for the SDF buffer write paths and the upload skip.
 *
 * A full renderer needs a live GL context, so methods are exercised on a
 * minimal fake `this` via the prototype, holding only the fields each method
 * touches.
 */

const FLOATS_PER_GLYPH = 24; // 4 vertices x 6 floats

/**
 * Build one glyph (4 vertices) of cached vertex data with a bit-pattern color.
 * Layout per vertex: [x, y, u, v, color(uint32), distRange].
 */
const makeCachedGlyph = (color: number): Float32Array => {
  const buf = new ArrayBuffer(FLOATS_PER_GLYPH * 4);
  const f = new Float32Array(buf);
  const u = new Uint32Array(buf);
  const corners = [
    [10, 20, 0.1, 0.2],
    [30, 20, 0.3, 0.2],
    [10, 40, 0.1, 0.4],
    [30, 40, 0.3, 0.4],
  ];
  for (let v = 0; v < 4; v++) {
    const i = v * 6;
    f[i] = corners[v]![0]!;
    f[i + 1] = corners[v]![1]!;
    f[i + 2] = corners[v]![2]!;
    f[i + 3] = corners[v]![3]!;
    u[i + 4] = color;
    f[i + 5] = 4; // distanceRange
  }
  return f;
};

type SdfWriterFake = {
  sdfBufferIdx: number;
  sdfQuadCount: number;
  sdfBuffer: ArrayBuffer;
  fSdfBuffer: Float32Array;
  uiSdfBuffer: Uint32Array;
  sdfBufferChanged: boolean;
  ensureSdfBufferCapacity: ReturnType<typeof vi.fn>;
  finalizeSdfBatch: ReturnType<typeof vi.fn>;
};

const makeWriterFake = (): SdfWriterFake => {
  const sdfBuffer = new ArrayBuffer(1024 * 4);
  return {
    sdfBufferIdx: 0,
    sdfQuadCount: 0,
    sdfBuffer,
    fSdfBuffer: new Float32Array(sdfBuffer),
    uiSdfBuffer: new Uint32Array(sdfBuffer),
    sdfBufferChanged: false,
    ensureSdfBufferCapacity: vi.fn(),
    finalizeSdfBatch: vi.fn(),
  };
};

const finalizeArgs = [
  {} as never, // atlasTexture
  { x: 0, y: 0, w: 0, h: 0, valid: false }, // clippingRect
  1, // worldAlpha
  100, // width
  50, // height
  false, // parentHasRenderTexture
  null, // framebufferDimensions
  {} as never, // sdfShader
] as const;

describe('WebGlRenderer.addSdfTranslatedQuads', () => {
  it('copies cached vertices with the position delta applied', () => {
    const fake = makeWriterFake();
    const cached = makeCachedGlyph(0x00ff00ff);

    WebGlRenderer.prototype.addSdfTranslatedQuads.call(
      fake as never,
      cached,
      1,
      5,
      -3,
      ...finalizeArgs,
    );

    const f = fake.fSdfBuffer;
    // Positions shifted by (5, -3)
    expect([f[0], f[1]]).toEqual([15, 17]);
    expect([f[6], f[7]]).toEqual([35, 17]);
    expect([f[12], f[13]]).toEqual([15, 37]);
    expect([f[18], f[19]]).toEqual([35, 37]);
    // UVs and distanceRange untouched
    expect([f[2], f[3], f[5]]).toEqual([Math.fround(0.1), Math.fround(0.2), 4]);
    expect(fake.sdfBufferIdx).toBe(FLOATS_PER_GLYPH);
    expect(fake.sdfQuadCount).toBe(1);
    expect(fake.sdfBufferChanged).toBe(true);
    expect(fake.finalizeSdfBatch.mock.calls.length).toBe(1);
    // startQuad 0, numGlyphs 1
    expect(fake.finalizeSdfBatch.mock.calls[0]![0]).toBe(0);
    expect(fake.finalizeSdfBatch.mock.calls[0]![1]).toBe(1);
    // Source cache untouched
    expect(cached[0]).toBe(10);
    expect(cached[1]).toBe(20);
  });

  it('preserves packed color bits exactly, including float32 NaN patterns', () => {
    const fake = makeWriterFake();
    // 0xFFFFFFFF (white, full alpha) is a float32 NaN bit pattern — an
    // element-wise float copy could canonicalize it. The memcpy must not.
    const cached = makeCachedGlyph(0xffffffff);

    WebGlRenderer.prototype.addSdfTranslatedQuads.call(
      fake as never,
      cached,
      1,
      100,
      200,
      ...finalizeArgs,
    );

    for (let v = 0; v < 4; v++) {
      expect(fake.uiSdfBuffer[v * 6 + 4]).toBe(0xffffffff);
    }
  });

  it('appends after existing content and is a no-op for zero glyphs', () => {
    const fake = makeWriterFake();
    fake.sdfBufferIdx = FLOATS_PER_GLYPH;
    fake.sdfQuadCount = 1;
    const cached = makeCachedGlyph(0x000000ff);

    WebGlRenderer.prototype.addSdfTranslatedQuads.call(
      fake as never,
      cached,
      0,
      5,
      5,
      ...finalizeArgs,
    );
    expect(fake.sdfBufferIdx).toBe(FLOATS_PER_GLYPH);
    expect(fake.sdfBufferChanged).toBe(false);
    expect(fake.finalizeSdfBatch.mock.calls.length).toBe(0);

    WebGlRenderer.prototype.addSdfTranslatedQuads.call(
      fake as never,
      cached,
      1,
      5,
      5,
      ...finalizeArgs,
    );
    expect(fake.sdfBufferIdx).toBe(FLOATS_PER_GLYPH * 2);
    expect(fake.fSdfBuffer[FLOATS_PER_GLYPH]).toBe(15);
    // startQuad continues from the existing quad count
    expect(fake.finalizeSdfBatch.mock.calls[0]![0]).toBe(1);
  });
});

type UploadFake = {
  sdfBufferIdx: number;
  sdfBufferChanged: boolean;
  lastUploadedSdfSize: number;
  sdfBuffer: ArrayBuffer;
  sdfQuadBufferCollection: { getBuffer: ReturnType<typeof vi.fn> };
  glw: { arrayBufferData: ReturnType<typeof vi.fn>; DYNAMIC_DRAW: number };
};

const makeUploadFake = (): UploadFake => ({
  sdfBufferIdx: 0,
  sdfBufferChanged: true,
  lastUploadedSdfSize: 0,
  sdfBuffer: new ArrayBuffer(1024),
  sdfQuadBufferCollection: { getBuffer: vi.fn(() => ({})) },
  glw: { arrayBufferData: vi.fn(), DYNAMIC_DRAW: 35048 },
});

const upload = (fake: UploadFake) =>
  (
    WebGlRenderer.prototype as unknown as {
      uploadSdfBuffer: (this: unknown) => void;
    }
  ).uploadSdfBuffer.call(fake);

describe('WebGlRenderer.uploadSdfBuffer skip', () => {
  it('does nothing when no SDF glyphs were written', () => {
    const fake = makeUploadFake();

    upload(fake);

    expect(fake.glw.arrayBufferData.mock.calls.length).toBe(0);
    // Flag is kept so a later frame with content still uploads
    expect(fake.sdfBufferChanged).toBe(true);
  });

  it('uploads when changed, then skips identical follow-up frames', () => {
    const fake = makeUploadFake();
    fake.sdfBufferIdx = 48;

    upload(fake);
    expect(fake.glw.arrayBufferData.mock.calls.length).toBe(1);
    expect(fake.sdfBufferChanged).toBe(false);
    expect(fake.lastUploadedSdfSize).toBe(48);

    // Next frame: exact cache hits rewrote identical bytes, same size
    upload(fake);
    expect(fake.glw.arrayBufferData.mock.calls.length).toBe(1);
  });

  it('uploads again when the changed flag is raised', () => {
    const fake = makeUploadFake();
    fake.sdfBufferIdx = 48;
    upload(fake);

    fake.sdfBufferChanged = true;
    upload(fake);

    expect(fake.glw.arrayBufferData.mock.calls.length).toBe(2);
  });

  it('uploads when the size differs even if the flag is clear', () => {
    const fake = makeUploadFake();
    fake.sdfBufferIdx = 48;
    upload(fake);

    fake.sdfBufferIdx = 24;
    upload(fake);

    expect(fake.glw.arrayBufferData.mock.calls.length).toBe(2);
    expect(fake.lastUploadedSdfSize).toBe(24);
  });
});

describe('sdfBufferChanged raisers', () => {
  it('addSdfQuads marks the buffer changed', () => {
    const fake = makeWriterFake();
    // One glyph record: [x, y, w, h, u, v, uw, vh]
    const glyphs = new Float32Array([0, 0, 10, 10, 0, 0, 0.1, 0.1]);
    const transform = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);

    WebGlRenderer.prototype.addSdfQuads.call(
      fake as never,
      glyphs,
      1, // glyphCount
      1, // fontScale
      transform,
      0xffffffff, // color
      1, // worldAlpha
      4, // distanceRange
      {} as never, // atlasTexture
      { x: 0, y: 0, w: 0, h: 0, valid: false }, // clippingRect
      100, // width
      50, // height
      false, // parentHasRenderTexture
      null, // framebufferDimensions
      {} as never, // sdfShader
    );

    expect(fake.sdfBufferChanged).toBe(true);
    expect(fake.sdfBufferIdx).toBe(FLOATS_PER_GLYPH);
  });

  it('invalidateQuadBuffer marks the buffer changed (render-list rebuild)', () => {
    const fake = {
      sdfBufferChanged: false,
      curBufferIdx: 99,
      lastUploadedBufferSize: 99,
      needsFullUpload: false,
      stage: { renderList: [] },
    };

    WebGlRenderer.prototype.invalidateQuadBuffer.call(fake as never);

    expect(fake.sdfBufferChanged).toBe(true);
  });

  it('ensureSdfBufferCapacity marks the buffer changed on growth only', () => {
    const sdfBuffer = new ArrayBuffer(FLOATS_PER_GLYPH * 4);
    const fake = {
      sdfBuffer,
      fSdfBuffer: new Float32Array(sdfBuffer),
      uiSdfBuffer: new Uint32Array(sdfBuffer),
      sdfBufferChanged: false,
    };
    const ensure = (size: number) =>
      (
        WebGlRenderer.prototype as unknown as {
          ensureSdfBufferCapacity: (this: unknown, n: number) => void;
        }
      ).ensureSdfBufferCapacity.call(fake, size);

    ensure(FLOATS_PER_GLYPH); // fits — no realloc
    expect(fake.sdfBufferChanged).toBe(false);

    ensure(FLOATS_PER_GLYPH * 8); // grows
    expect(fake.sdfBufferChanged).toBe(true);
    expect(fake.fSdfBuffer.length).toBeGreaterThanOrEqual(FLOATS_PER_GLYPH * 8);
  });
});
