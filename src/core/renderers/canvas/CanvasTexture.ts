import type { Dimensions } from '../../../common/CommonTypes.js';
import { assertTruthy } from '../../../utils.js';
import { formatRgba, type IParsedColor } from '../../lib/colorParser.js';
import { CoreContextTexture } from '../CoreContextTexture.js';
import type { Texture } from '../../textures/Texture.js';

export class CanvasTexture extends CoreContextTexture {
  protected image:
    | ImageBitmap
    | HTMLCanvasElement
    | HTMLImageElement
    | undefined;
  protected tintCache:
    | {
        key: string;
        image: HTMLCanvasElement;
      }
    | undefined;

  async load(): Promise<void> {
    // Capture textureData synchronously before any await - a pending
    // freeTextureDataTask microtask could null textureSource.textureData
    // during the first async suspension, causing onLoadRequest to fail.
    const textureData = this.textureSource.textureData;
    assertTruthy(textureData?.data, 'Texture data is null before load');

    this.textureSource.setState('loading');

    try {
      const size = await this.onLoadRequest(textureData.data);

      // Guard against the texture being freed while the load was in flight
      if (this.textureSource.state === 'freed') {
        this.image = undefined;
        return;
      }

      this.textureSource.setState('loaded', size);
      this.textureSource.freeTextureData();
      this.updateMemSize();
    } catch (err) {
      this.textureSource.setState('failed', err as Error);
      this.textureSource.freeTextureData();
      throw err;
    }
  }

  release(): void {
    this.image = undefined;
    this.tintCache = undefined;
  }

  free(): void {
    this.release();
    this.textureSource.setState('freed');
    this.setTextureMemUse(0);
    this.textureSource.freeTextureData();
  }

  updateMemSize(): void {
    // Counting memory usage for:
    // - main image
    // - tinted image
    const mult = this.tintCache ? 8 : 4;
    if (this.textureSource.dimensions) {
      this.setTextureMemUse(
        this.textureSource.dimensions.w *
          this.textureSource.dimensions.h *
          mult,
      );
    }
  }

  hasImage(): boolean {
    return this.image !== undefined;
  }

  getImage(
    color: IParsedColor,
  ): ImageBitmap | HTMLCanvasElement | HTMLImageElement | null {
    const image = this.image;
    if (image === undefined) {
      return null;
    }

    if (color.isWhite) {
      if (this.tintCache) {
        this.tintCache = undefined;
        this.updateMemSize();
      }
      return image;
    }
    const key = formatRgba(color);
    if (this.tintCache?.key === key) {
      return this.tintCache.image;
    }

    const tintedImage = this.tintTexture(image, key);
    this.tintCache = {
      key,
      image: tintedImage,
    };
    this.updateMemSize();
    return tintedImage;
  }

  protected tintTexture(
    source: ImageBitmap | HTMLCanvasElement | HTMLImageElement,
    color: string,
  ) {
    const { width, height } = source;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // fill with target color
      ctx.fillStyle = color;
      ctx.globalCompositeOperation = 'copy';
      ctx.fillRect(0, 0, width, height);

      // multiply with image, resulting in non-transparent tinted image
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(source, 0, 0, width, height, 0, 0, width, height);

      // apply original image alpha
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(source, 0, 0, width, height, 0, 0, width, height);
    }
    return canvas;
  }

  private async onLoadRequest(
    data: NonNullable<Texture['textureData']>['data'],
  ): Promise<Dimensions> {
    if (data === null) {
      throw new Error('CanvasTexture: Texture data is null');
    }

    // CompressedData objects (KTX, PVR, ASTC) carry GPU-format mipmap buffers
    // that cannot be decoded by Canvas2D. Reject explicitly rather than falling
    // through silently and leaving this.image unassigned.
    if (typeof data === 'object' && 'mipmaps' in data) {
      throw new Error(
        'CanvasTexture: Compressed texture data is not supported in Canvas2D render mode',
      );
    }

    // TODO: canvas from text renderer should be able to provide the canvas directly
    // instead of having to re-draw it into a new canvas...
    if (data instanceof ImageData) {
      const canvas = document.createElement('canvas');
      canvas.width = data.width;
      canvas.height = data.height;
      const ctx = canvas.getContext('2d');
      if (ctx !== null) ctx.putImageData(data, 0, 0);
      this.image = canvas;
      return { w: data.width, h: data.height };
    } else if (
      (typeof ImageBitmap !== 'undefined' && data instanceof ImageBitmap) ||
      data instanceof HTMLImageElement
    ) {
      this.image = data;
      return { w: data.width, h: data.height };
    }

    return { w: 0, h: 0 };
  }
}
