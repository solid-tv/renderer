import type { CoreTextureManager } from '../CoreTextureManager.js';
import { Texture, TextureType, type TextureData } from './Texture.js';

/**
 * Properties of the {@link NoiseTexture}
 */
export interface NoiseTextureProps {
  /**
   * Width of texture
   *
   * @default 128
   */
  w?: number;
  /**
   * Height of texture
   *
   * @default 128
   */
  h?: number;
  /**
   * A number value that can be varied to force new textures to be generated
   *
   * @default 0
   */
  cacheId?: number;
}

/**
 * Texture consisting of a random grid of greyscale pixels
 *
 * @remarks
 * The width and height of the NoiseTexture are defined by it's
 * {@link NoiseTextureProps.width} and {@link NoiseTextureProps.height}
 * properties. The {@link NoiseTextureProps.cacheId} prop can be varied in order
 * to bypass cache and get newly randomized texture data.
 */
export class NoiseTexture extends Texture {
  props: Required<NoiseTextureProps>;

  public override type: TextureType = TextureType.noise;

  constructor(
    txManager: CoreTextureManager,
    props: Required<NoiseTextureProps>,
  ) {
    super(txManager);
    this.props = props;
  }

  override async getTextureSource(): Promise<TextureData> {
    const { w, h } = this.props;
    const size = w * h * 4;
    const pixelData8 = new Uint8ClampedArray(size);
    for (let i = 0; i < size; i += 4) {
      const v = Math.floor(Math.random() * 256);
      pixelData8[i] = v;
      pixelData8[i + 1] = v;
      pixelData8[i + 2] = v;
      pixelData8[i + 3] = 255;
    }

    // Noise Texture data ready - dimensions will be set during upload
    return {
      data: new ImageData(pixelData8, w, h),
    };
  }

  static override makeCacheKey(props: NoiseTextureProps): string | false {
    if (props.cacheId === undefined) {
      return false;
    }
    const resolvedProps = NoiseTexture.resolveDefaults(props);
    return `NoiseTexture,${resolvedProps.w},${resolvedProps.h},${resolvedProps.cacheId}`;
  }

  static override resolveDefaults(
    props: NoiseTextureProps,
  ): Required<NoiseTextureProps> {
    return {
      w: props.w ?? 128,
      h: props.h ?? 128,
      cacheId: props.cacheId ?? 0,
    };
  }

  static z$__type__Props: NoiseTextureProps;
}
