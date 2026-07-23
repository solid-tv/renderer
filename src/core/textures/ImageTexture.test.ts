import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImageTexture } from './ImageTexture.js';
import type { CoreTextureManager } from '../CoreTextureManager.js';

const makeTxManager = (
  imageBitmapSupported: {
    basic: boolean;
    options: boolean;
    full: boolean;
    premultiplyHonored: boolean | null;
  },
  createImageBitmapMock: () => Promise<unknown>,
) =>
  ({
    imageBitmapSupported,
    platform: {
      createImageBitmap: createImageBitmapMock,
    },
  } as unknown as CoreTextureManager);

describe('ImageTexture.createImageBitmap', () => {
  beforeEach(() => {
    vi.stubGlobal('ImageBitmap', class {});
  });

  it('requests a premultiplied bitmap when options are supported and the option is honored', async () => {
    const createImageBitmapMock = vi.fn(() =>
      Promise.resolve({ close: () => {} }),
    );
    const txManager = makeTxManager(
      { basic: true, options: true, full: true, premultiplyHonored: true },
      createImageBitmapMock,
    );

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

    expect(createImageBitmapMock).toHaveBeenCalledWith(blob, {
      premultiplyAlpha: 'premultiply',
      colorSpaceConversion: 'none',
      imageOrientation: 'none',
    });

    // The bitmap is already premultiplied; WebGL must not premultiply again
    expect(result.premultiplyAlpha).toBe(false);
  });

  it('requests a straight bitmap and defers premultiply to WebGL when the option is not honored', async () => {
    const createImageBitmapMock = vi.fn(() =>
      Promise.resolve({ close: () => {} }),
    );
    const txManager = makeTxManager(
      { basic: true, options: true, full: true, premultiplyHonored: false },
      createImageBitmapMock,
    );

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

    expect(createImageBitmapMock).toHaveBeenCalledWith(blob, {
      premultiplyAlpha: 'none',
      colorSpaceConversion: 'none',
      imageOrientation: 'none',
    });

    // Since premultiplyHonored is false, WebGL premultiplies on upload
    expect(result.premultiplyAlpha).toBe(true);
  });

  it('falls back to basic createImageBitmap when options are not supported', async () => {
    const createImageBitmapMock = vi.fn(() =>
      Promise.resolve({ close: () => {} }),
    );
    const txManager = makeTxManager(
      { basic: true, options: false, full: false, premultiplyHonored: null },
      createImageBitmapMock,
    );

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

    // The browser default is assumed to premultiply; WebGL must not premultiply again
    expect(result.premultiplyAlpha).toBe(false);
  });

  it('defers premultiply to WebGL on basic-only devices when premultiplyAlphaHonored is false', async () => {
    const createImageBitmapMock = vi.fn(() =>
      Promise.resolve({ close: () => {} }),
    );
    const txManager = makeTxManager(
      { basic: true, options: false, full: false, premultiplyHonored: false },
      createImageBitmapMock,
    );

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

    // Still the basic call — no options are supported on these devices
    expect(createImageBitmapMock).toHaveBeenCalledWith(blob);

    // Device default returns straight alpha; WebGL premultiplies on upload
    expect(result.premultiplyAlpha).toBe(true);
  });
});
