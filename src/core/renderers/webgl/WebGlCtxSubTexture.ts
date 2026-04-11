import type { Dimensions } from '../../../common/CommonTypes.js';
import { assertTruthy } from '../../../utils.js';
import type { TextureMemoryManager } from '../../TextureMemoryManager.js';
import type { WebGlContextWrapper } from '../../lib/WebGlContextWrapper.js';
import type { SubTexture } from '../../textures/SubTexture.js';
import type { SubTextureProps } from '../../textures/SubTexture.js';
import type { CompressedData } from '../../textures/Texture.js';
import { WebGlCtxTexture } from './WebGlCtxTexture.js';

export class WebGlCtxSubTexture extends WebGlCtxTexture {
  constructor(
    glw: WebGlContextWrapper,
    memManager: TextureMemoryManager,
    textureSource: SubTexture,
  ) {
    super(glw, memManager, textureSource);
  }

  override async onLoadRequest(): Promise<Dimensions> {
    const props = (this.textureSource as SubTexture).textureData;
    assertTruthy(props, 'SubTexture must have texture data');

    if (props.data instanceof Uint8Array) {
      // its a 1x1 Color Texture
      return { w: 1, h: 1 };
    }

    return this.extractDimensions(props.data);
  }

  /**
   * Efficiently extracts width/height from polymorphic texture data
   * Optimized for performance by using type guards and avoiding unnecessary property access
   */
  private extractDimensions(
    data:
      | ImageBitmap
      | ImageData
      | SubTextureProps
      | CompressedData
      | HTMLImageElement
      | null,
  ): Dimensions {
    if (data === null) {
      return { w: 0, h: 0 };
    }

    // Check for standard web API objects first (most common case)
    // These use width/height properties: ImageBitmap, ImageData, HTMLImageElement
    if (this.hasWidthHeight(data) === true) {
      return { w: data.width, h: data.height };
    }

    // Check for internal objects that use w/h properties: SubTextureProps, CompressedData
    if (this.hasWH(data) === true) {
      return { w: data.w, h: data.h };
    }

    // Fallback
    return { w: 0, h: 0 };
  }

  /**
   * Type guard for objects with width/height properties
   */
  private hasWidthHeight(data: any): data is { width: number; height: number } {
    return typeof data.width === 'number' && typeof data.height === 'number';
  }

  /**
   * Type guard for objects with w/h properties
   */
  private hasWH(data: any): data is { w: number; h: number } {
    return typeof data.w === 'number' && typeof data.h === 'number';
  }
}
