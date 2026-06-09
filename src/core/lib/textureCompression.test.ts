import { describe, it, expect, vi } from 'vitest';
import { uploadCompressedTexture } from './textureCompression.js';
import type { WebGlContextWrapper } from './WebGlContextWrapper.js';
import type { CompressedData } from '../textures/Texture.js';

/**
 * A compressed format enum is only valid in compressedTexImage2D after its
 * owning extension has been enabled via getExtension; otherwise the driver
 * rejects it with GL_INVALID_ENUM (1280). These tests pin that every upload
 * path enables its extension *before* uploading, and fails loudly when the
 * device exposes none of the candidates.
 */

interface MockGlw {
  glw: WebGlContextWrapper;
  order: string[];
  getExtension: ReturnType<typeof vi.fn>;
  compressedTexImage2D: ReturnType<typeof vi.fn>;
}

function makeGlw(supported: Set<string>): MockGlw {
  const order: string[] = [];
  const getExtension = vi.fn((name: string) => {
    order.push(`getExtension:${name}`);
    return supported.has(name) === true ? {} : null;
  });
  const compressedTexImage2D = vi.fn(() => {
    order.push('compressedTexImage2D');
  });
  const glw = {
    getExtension,
    compressedTexImage2D,
    bindTexture: vi.fn(),
    texParameteri: vi.fn(),
    TEXTURE_WRAP_S: 0,
    TEXTURE_WRAP_T: 0,
    TEXTURE_MAG_FILTER: 0,
    TEXTURE_MIN_FILTER: 0,
    CLAMP_TO_EDGE: 0,
    LINEAR: 0,
    LINEAR_MIPMAP_LINEAR: 0,
  } as unknown as WebGlContextWrapper;
  return { glw, order, getExtension, compressedTexImage2D };
}

function makeData(
  type: 'ktx' | 'pvr' | 'astc',
  glInternalFormat: number,
): CompressedData {
  return {
    type,
    glInternalFormat,
    w: 4,
    h: 4,
    mipmaps: [new ArrayBuffer(16)],
    blockInfo: { width: 4, height: 4, bytes: 16 },
  };
}

const texture = {} as WebGLTexture;

// COMPRESSED_RGBA_S3TC_DXT5_EXT
const S3TC_DXT5 = 0x83f3;
// COMPRESSED_RGB_PVRTC_4BPPV1_IMG
const PVRTC_4BPP = 0x8c00;
// COMPRESSED_RGB_ETC1_WEBGL
const ETC1 = 0x8d64;
// COMPRESSED_RGBA_ASTC_4x4_KHR
const ASTC_4x4 = 0x93b0;

describe('compressed texture extension guards', () => {
  it('KTX enables the s3tc extension before uploading', () => {
    const m = makeGlw(new Set(['WEBGL_compressed_texture_s3tc']));
    uploadCompressedTexture.ktx!(m.glw, texture, makeData('ktx', S3TC_DXT5));

    expect(m.getExtension).toHaveBeenCalledWith(
      'WEBGL_compressed_texture_s3tc',
    );
    expect(m.compressedTexImage2D).toHaveBeenCalled();
    // getExtension must precede the first compressedTexImage2D call
    expect(m.order.indexOf('getExtension:WEBGL_compressed_texture_s3tc')).toBe(
      0,
    );
    expect(
      m.order.indexOf('getExtension:WEBGL_compressed_texture_s3tc') <
        m.order.indexOf('compressedTexImage2D'),
    ).toBe(true);
  });

  it('KTX throws (no silent 1280) when the s3tc extension is unavailable', () => {
    const m = makeGlw(new Set());
    expect(() =>
      uploadCompressedTexture.ktx!(m.glw, texture, makeData('ktx', S3TC_DXT5)),
    ).toThrow(/not supported/);
    expect(m.compressedTexImage2D).not.toHaveBeenCalled();
  });

  it('KTX enables the etc1 extension for ETC1 formats', () => {
    const m = makeGlw(new Set(['WEBGL_compressed_texture_etc1']));
    uploadCompressedTexture.ktx!(m.glw, texture, makeData('ktx', ETC1));
    expect(m.getExtension).toHaveBeenCalledWith(
      'WEBGL_compressed_texture_etc1',
    );
    expect(m.compressedTexImage2D).toHaveBeenCalled();
  });

  it('PVR enables the pvrtc extension before uploading', () => {
    const m = makeGlw(new Set(['WEBGL_compressed_texture_pvrtc']));
    uploadCompressedTexture.pvr!(m.glw, texture, makeData('pvr', PVRTC_4BPP));
    expect(m.getExtension).toHaveBeenCalledWith(
      'WEBGL_compressed_texture_pvrtc',
    );
    expect(
      m.order.indexOf('getExtension:WEBGL_compressed_texture_pvrtc') <
        m.order.indexOf('compressedTexImage2D'),
    ).toBe(true);
  });

  it('PVR falls back to the WebKit-prefixed pvrtc extension', () => {
    const m = makeGlw(new Set(['WEBKIT_WEBGL_compressed_texture_pvrtc']));
    uploadCompressedTexture.pvr!(m.glw, texture, makeData('pvr', PVRTC_4BPP));
    expect(m.getExtension).toHaveBeenCalledWith(
      'WEBGL_compressed_texture_pvrtc',
    );
    expect(m.getExtension).toHaveBeenCalledWith(
      'WEBKIT_WEBGL_compressed_texture_pvrtc',
    );
    expect(m.compressedTexImage2D).toHaveBeenCalled();
  });

  it('PVR throws when neither pvrtc extension is available', () => {
    const m = makeGlw(new Set());
    expect(() =>
      uploadCompressedTexture.pvr!(m.glw, texture, makeData('pvr', PVRTC_4BPP)),
    ).toThrow(/not supported/);
    expect(m.compressedTexImage2D).not.toHaveBeenCalled();
  });

  it('ASTC enables the astc extension before uploading', () => {
    const m = makeGlw(new Set(['WEBGL_compressed_texture_astc']));
    uploadCompressedTexture.astc!(m.glw, texture, makeData('astc', ASTC_4x4));
    expect(m.getExtension).toHaveBeenCalledWith(
      'WEBGL_compressed_texture_astc',
    );
    expect(
      m.order.indexOf('getExtension:WEBGL_compressed_texture_astc') <
        m.order.indexOf('compressedTexImage2D'),
    ).toBe(true);
  });

  it('ASTC throws when the astc extension is unavailable', () => {
    const m = makeGlw(new Set());
    expect(() =>
      uploadCompressedTexture.astc!(m.glw, texture, makeData('astc', ASTC_4x4)),
    ).toThrow(/not supported/);
    expect(m.compressedTexImage2D).not.toHaveBeenCalled();
  });
});
