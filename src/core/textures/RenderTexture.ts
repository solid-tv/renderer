import type { CoreTextureManager } from '../CoreTextureManager.js';
import { Texture, TextureType, type TextureData } from './Texture.js';

/**
 * Properties of the {@link RenderTexture}
 */
export interface RenderTextureProps {
  /**
   * WebGL Texture width
   * @default 256
   */
  w?: number;

  /**
   * WebGL Texture height
   * @default 256
   */
  h?: number;
}

export class RenderTexture extends Texture {
  props: Required<RenderTextureProps>;

  public override type: TextureType = TextureType.renderToTexture;

  constructor(
    txManager: CoreTextureManager,
    props: Required<RenderTextureProps>,
  ) {
    super(txManager);
    this.props = props;
  }

  get w() {
    return this.props.w;
  }

  set w(value: number) {
    this.props.w = value;
  }

  get h() {
    return this.props.h;
  }

  set h(value: number) {
    this.props.h = value;
  }

  override async getTextureSource(): Promise<TextureData> {
    // Render texture data ready - dimensions will be set during upload
    return {
      data: null,
      premultiplyAlpha: null,
    };
  }

  static override resolveDefaults(
    props: RenderTextureProps,
  ): Required<RenderTextureProps> {
    return {
      w: props.w || 256,
      h: props.h || 256,
    };
  }

  static z$__type__Props: RenderTextureProps;
}
