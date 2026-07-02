import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { detectPremultiplyAlphaHonored } from './validateImageBitmap.js';
import type { Platform } from '../platforms/Platform.js';

/**
 * Minimal stand-in for the WebGL constants/methods the probe touches. The probe
 * uploads a known straight pixel, reads it back, and infers whether
 * createImageBitmap premultiplied it. `readbackRed` is what readPixels returns
 * for the red channel: ~128 = premultiplied (honored), ~255 = straight (ignored).
 */
function createFakeGl(readbackRed: number, framebufferComplete = true) {
  return {
    TEXTURE_2D: 0x0de1,
    UNPACK_PREMULTIPLY_ALPHA_WEBGL: 0x9241,
    UNPACK_FLIP_Y_WEBGL: 0x9240,
    RGBA: 0x1908,
    UNSIGNED_BYTE: 0x1401,
    FRAMEBUFFER: 0x8d40,
    COLOR_ATTACHMENT0: 0x8ce0,
    FRAMEBUFFER_COMPLETE: 0x8cd5,
    createTexture: vi.fn(() => ({})),
    bindTexture: vi.fn(),
    pixelStorei: vi.fn(),
    texImage2D: vi.fn(),
    createFramebuffer: vi.fn(() => ({})),
    bindFramebuffer: vi.fn(),
    framebufferTexture2D: vi.fn(),
    checkFramebufferStatus: vi.fn(() => (framebufferComplete ? 0x8cd5 : 0)),
    readPixels: vi.fn(
      (
        _x: number,
        _y: number,
        _w: number,
        _h: number,
        _format: number,
        _type: number,
        px: Uint8Array,
      ) => {
        px[0] = readbackRed;
        px[1] = 0;
        px[2] = 0;
        px[3] = 128;
      },
    ),
    deleteFramebuffer: vi.fn(),
    deleteTexture: vi.fn(),
    // The probe releases its throwaway context via WEBGL_lose_context once done.
    getExtension: vi.fn((name: string) =>
      name === 'WEBGL_lose_context' ? { loseContext: vi.fn() } : null,
    ),
  };
}

function createPlatform(gl: object | null): Platform {
  const close = vi.fn();
  return {
    createImageBitmap: vi.fn(() => Promise.resolve({ close })),
    createCanvas: vi.fn(() => ({
      width: 0,
      height: 0,
      getContext: vi.fn((type: string) => (type === 'webgl' ? gl : null)),
    })),
  } as unknown as Platform;
}

describe('detectPremultiplyAlphaHonored', () => {
  beforeEach(() => {
    // node test env has no ImageData global; the probe constructs one.
    (globalThis as unknown as { ImageData: unknown }).ImageData = class {
      data: Uint8ClampedArray;
      width: number;
      height: number;
      constructor(data: Uint8ClampedArray, width: number, height: number) {
        this.data = data;
        this.width = width;
        this.height = height;
      }
    };
  });

  afterEach(() => {
    delete (globalThis as unknown as { ImageData?: unknown }).ImageData;
  });

  it('returns true when the bitmap reads back premultiplied (~128)', async () => {
    const platform = createPlatform(createFakeGl(128));
    expect(await detectPremultiplyAlphaHonored(platform)).toBe(true);
  });

  it('returns false when the bitmap reads back straight (~255)', async () => {
    const platform = createPlatform(createFakeGl(255));
    expect(await detectPremultiplyAlphaHonored(platform)).toBe(false);
  });

  it('returns null when createImageBitmap throws', async () => {
    const platform = {
      createImageBitmap: vi.fn(() => Promise.reject(new Error('unsupported'))),
      createCanvas: vi.fn(),
    } as unknown as Platform;
    expect(await detectPremultiplyAlphaHonored(platform)).toBe(null);
  });

  it('returns null when no WebGL context is available', async () => {
    const platform = createPlatform(null);
    expect(await detectPremultiplyAlphaHonored(platform)).toBe(null);
  });

  it('returns null when the framebuffer is incomplete', async () => {
    const platform = createPlatform(createFakeGl(128, false));
    expect(await detectPremultiplyAlphaHonored(platform)).toBe(null);
  });

  it('disables GL-side premultiply on the probe upload', async () => {
    const gl = createFakeGl(128);
    await detectPremultiplyAlphaHonored(createPlatform(gl));
    // The probe must observe the bitmap's own alpha state, so GL premultiply
    // has to be off during the readback upload.
    expect(gl.pixelStorei).toHaveBeenCalledWith(
      gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,
      false,
    );
  });

  it('releases the throwaway context so it does not leak a GL slot', async () => {
    const lose = { loseContext: vi.fn() };
    const gl = createFakeGl(128);
    gl.getExtension = vi.fn((name: string) =>
      name === 'WEBGL_lose_context' ? lose : null,
    );
    await detectPremultiplyAlphaHonored(createPlatform(gl));
    expect(gl.getExtension).toHaveBeenCalledWith('WEBGL_lose_context');
    expect(lose.loseContext).toHaveBeenCalledTimes(1);
  });
});
