import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImageTexture } from './ImageTexture.js';
import type { CoreTextureManager } from '../CoreTextureManager.js';

describe('ImageTexture.createImageBitmap', () => {
  beforeEach(() => {
    vi.stubGlobal('ImageBitmap', class {});
  });

  it('passes options to createImageBitmap when no crop is requested and options/full are supported', async () => {
    const createImageBitmapMock = vi.fn(() =>
      Promise.resolve({ close: () => {} }),
    );
    const txManager = {
      imageBitmapSupported: {
        // basic: false so this exercises the options branch (current code
        // takes the basic branch whenever `basic` is true, regardless of
        // `options`/`full` — see PR #107, not yet reapplied on this branch).
        basic: false,
        options: true,
        full: true,
      },
      platform: {
        createImageBitmap: createImageBitmapMock,
      },
    } as unknown as CoreTextureManager;

    const props = ImageTexture.resolveDefaults({
      src: 'test.png',
      premultiplyAlpha: true,
    });
    const texture = new ImageTexture(txManager, props);

    const blob = new Blob([], { type: 'image/png' });
    const result = await texture.createImageBitmap(
      blob,
      true,
      null,
      null,
      null,
      null,
    );

    // It should have called createImageBitmap with the options object
    expect(createImageBitmapMock).toHaveBeenCalledWith(blob, {
      premultiplyAlpha: 'premultiply',
      colorSpaceConversion: 'none',
      imageOrientation: 'none',
    });

    expect(result.premultiplyAlpha).toBe(true);
  });

  it('falls back to basic createImageBitmap when options are not supported', async () => {
    const createImageBitmapMock = vi.fn(() =>
      Promise.resolve({ close: () => {} }),
    );
    const txManager = {
      imageBitmapSupported: {
        basic: true,
        options: false,
        full: false,
      },
      platform: {
        createImageBitmap: createImageBitmapMock,
      },
    } as unknown as CoreTextureManager;

    const props = ImageTexture.resolveDefaults({
      src: 'test.png',
      premultiplyAlpha: true,
    });
    const texture = new ImageTexture(txManager, props);

    const blob = new Blob([], { type: 'image/png' });
    const result = await texture.createImageBitmap(
      blob,
      true,
      null,
      null,
      null,
      null,
    );

    // It should have called basic createImageBitmap without options
    expect(createImageBitmapMock).toHaveBeenCalledWith(blob);

    // premultiplyAlpha reflects hasAlphaChannel, unaffected by bitmap options support
    expect(result.premultiplyAlpha).toBe(true);
  });
});
