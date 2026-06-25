import type { Platform } from '../platforms/Platform.js';

export interface CreateImageBitmapSupport {
  basic: boolean; // Supports createImageBitmap(image)
  options: boolean; // Supports createImageBitmap(image, options)
  full: boolean; // Supports createImageBitmap(image, sx, sy, sw, sh, options)
  // Whether `premultiplyAlpha: 'premultiply'` is actually HONORED (not just
  // accepted without throwing). null = could not determine. Older Safari/WebKit
  // accepts the option but ignores it, returning straight alpha — the source of
  // the edge-ghosting bug on those devices.
  premultiplyHonored: boolean | null;
}

export async function validateCreateImageBitmap(
  platform: Platform,
): Promise<CreateImageBitmapSupport> {
  // Test if createImageBitmap is supported using a simple 1x1 PNG image
  // prettier-ignore
  const pngBinaryData = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47,
      0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
      0x00, 0x00, 0x00, 0x0d, // IHDR chunk length
      0x49, 0x48, 0x44, 0x52, // "IHDR" chunk type
      0x00, 0x00, 0x00, 0x01, // Width: 1
      0x00, 0x00, 0x00, 0x01, // Height: 1
      0x01,                   // Bit depth: 1
      0x03,                   // Color type: Indexed
      0x00,                   // Compression method: Deflate
      0x00,                   // Filter method: None
      0x00,                   // Interlace method: None
      0x25, 0xdb, 0x56, 0xca, // CRC for IHDR
      0x00, 0x00, 0x00, 0x03, // PLTE chunk length
      0x50, 0x4c, 0x54, 0x45, // "PLTE" chunk type
      0x00, 0x00, 0x00,       // Palette entry: Black
      0xa7, 0x7a, 0x3d, 0xda, // CRC for PLTE
      0x00, 0x00, 0x00, 0x01, // tRNS chunk length
      0x74, 0x52, 0x4e, 0x53, // "tRNS" chunk type
      0x00,                   // Transparency for black: Fully transparent
      0x40, 0xe6, 0xd8, 0x66, // CRC for tRNS
      0x00, 0x00, 0x00, 0x0a, // IDAT chunk length
      0x49, 0x44, 0x41, 0x54, // "IDAT" chunk type
      0x08, 0xd7,             // Deflate header
      0x63, 0x60, 0x00, 0x00,
      0x00, 0x02, 0x00, 0x01, // Zlib-compressed data
      0xe2, 0x21, 0xbc, 0x33, // CRC for IDAT
      0x00, 0x00, 0x00, 0x00, // IEND chunk length
      0x49, 0x45, 0x4e, 0x44, // "IEND" chunk type
      0xae, 0x42, 0x60, 0x82, // CRC for IEND
    ]);

  const support: CreateImageBitmapSupport = {
    basic: false,
    options: false,
    full: false,
    premultiplyHonored: null,
  };

  // Test basic createImageBitmap support
  const blob = new Blob([pngBinaryData], { type: 'image/png' });
  const bitmap = await platform.createImageBitmap(blob);
  bitmap.close?.();
  support.basic = true;

  // Test createImageBitmap with options support
  try {
    const options = { premultiplyAlpha: 'none' as const };
    const bitmapWithOptions = await platform.createImageBitmap(blob, options);
    bitmapWithOptions.close?.();
    support.options = true;
  } catch (e) {
    /* ignore */
  }

  // Test createImageBitmap with full options support
  try {
    const bitmapWithFullOptions = await platform.createImageBitmap(
      blob,
      0,
      0,
      1,
      1,
      {
        premultiplyAlpha: 'none',
      },
    );
    bitmapWithFullOptions.close?.();
    support.full = true;
  } catch (e) {
    /* ignore */
  }

  // premultiplyHonored is resolved separately by the caller (it may be a
  // forced override or an explicit opt-in to the probe), so it is left as its
  // default (null) here.
  return support;
}

/**
 * Determine whether `createImageBitmap(..., { premultiplyAlpha: 'premultiply' })`
 * is actually honored by this browser.
 *
 * Strategy: feed a known straight-alpha pixel (255, 0, 0, 128) through
 * createImageBitmap with 'premultiply', upload it to a WebGL texture with
 * GL-side premultiply DISABLED (so we observe the bitmap's own state), then
 * read the raw texel back via a framebuffer.
 *
 *  - honored   -> red comes back premultiplied (~128)
 *  - ignored   -> red comes back straight (~255)  [older Safari/WebKit]
 *
 * @returns true if honored, false if ignored, null if it couldn't be measured
 * (no WebGL, createImageBitmap from ImageData unsupported, framebuffer
 * incomplete, etc.) — caller should treat null as "unknown".
 */
export async function detectPremultiplyAlphaHonored(
  platform: Platform,
): Promise<boolean | null> {
  let bitmap: ImageBitmap;
  try {
    // Straight (un-premultiplied) RGBA. ImageData is straight-alpha by spec.
    const imageData = new ImageData(
      new Uint8ClampedArray([255, 0, 0, 128]),
      1,
      1,
    );
    bitmap = await platform.createImageBitmap(imageData, {
      premultiplyAlpha: 'premultiply',
      colorSpaceConversion: 'none',
      imageOrientation: 'none',
    });
  } catch (e) {
    return null;
  }

  const canvas = platform.createCanvas();
  canvas.width = 1;
  canvas.height = 1;
  const gl = (canvas.getContext('webgl') ||
    canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
  if (gl === null) {
    bitmap.close?.();
    return null;
  }

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  // Critical: do NOT let GL premultiply. We want to observe whatever state the
  // bitmap itself is in.
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);

  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    tex,
    0,
  );

  let result: boolean | null = null;
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE) {
    const px = new Uint8Array(4);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    // Straight red reads ~255; premultiplied red reads ~128. Split at the
    // midpoint to tolerate rounding/colorspace drift.
    result = px[0]! < 192;
  }

  gl.deleteFramebuffer(fb);
  gl.deleteTexture(tex);
  bitmap.close?.();

  // Release this throwaway context immediately. Embedded TV browsers cap the
  // number of live WebGL contexts very low; since this probe runs AFTER the
  // main render context is created, a leaked context here is the newest one
  // and its lingering presence can push the page over the limit, evicting the
  // OLDEST context (the live render context) — which then fails every
  // createTexture. Don't wait for GC to reclaim the canvas; drop it now.
  gl.getExtension('WEBGL_lose_context')?.loseContext();

  return result;
}
