import type { CoreNode } from '../../CoreNode.js';
import { SubTexture } from '../../textures/SubTexture.js';
import { TextureType, type Texture } from '../../textures/Texture.js';
import type { CoreContextTexture } from '../CoreContextTexture.js';
import { CoreRenderer, type CoreRendererOptions } from '../CoreRenderer.js';
import { CanvasTexture } from './CanvasTexture.js';
import { parseColor } from '../../lib/colorParser.js';
import { CanvasShaderNode, type CanvasShaderType } from './CanvasShaderNode.js';
import { normalizeCanvasColor } from '../../lib/colorCache.js';

export class CanvasRenderer extends CoreRenderer {
  private context: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private pixelRatio: number;
  private clearColor: string;
  public renderToTextureActive = false;
  activeRttNode: CoreNode | null = null;

  constructor(options: CoreRendererOptions) {
    super(options);

    this.mode = 'canvas';
    const { canvas } = options;
    this.canvas = canvas as HTMLCanvasElement;
    this.context = canvas.getContext('2d') as CanvasRenderingContext2D;
    this.pixelRatio = this.stage.pixelRatio;
    this.clearColor = normalizeCanvasColor(this.stage.clearColor);
  }

  reset(): void {
    this.canvas.width = this.canvas.width; // quick reset canvas

    const ctx = this.context;

    if (this.clearColor) {
      ctx.fillStyle = this.clearColor;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    ctx.scale(this.pixelRatio, this.pixelRatio);
  }

  render(): void {
    // noop
  }

  addQuad(node: CoreNode): void {
    const ctx = this.context;
    const { tx, ty, ta, tb, tc, td } = node.globalTransform!;
    const clippingRect = node.clippingRect;
    let texture = (node.props.texture || this.stage.defaultTexture) as Texture;
    // The Canvas2D renderer only supports image textures, no textures are used for color blocks
    if (texture !== null) {
      const textureType = texture.type;
      if (
        textureType !== TextureType.image &&
        textureType !== TextureType.subTexture &&
        textureType !== TextureType.color &&
        textureType !== TextureType.noise
      ) {
        return;
      }
    }

    const hasTransform = ta !== 1;
    const hasClipping = clippingRect.w !== 0 && clippingRect.h !== 0;
    const shader = node.props.shader;
    const hasShader = shader !== null;

    let saveAndRestore = hasTransform === true || hasClipping === true;
    if (hasShader === true) {
      saveAndRestore = saveAndRestore || (shader as CanvasShaderNode).applySNR;
    }

    if (saveAndRestore) {
      ctx.save();
    }

    if (hasClipping === true) {
      const path = new Path2D();
      const { x, y, w, h } = clippingRect;
      path.rect(x, y, w, h);
      ctx.clip(path);
    }

    if (hasTransform === true) {
      // Quad transform:
      // | ta tb tx |
      // | tc td ty |
      // | 0  0  1  |
      // C2D transform:
      // | a  c  e  |
      // | b  d  f  |
      // | 0  0  1  |
      const scale = this.pixelRatio;
      ctx.setTransform(ta, tc, tb, td, tx * scale, ty * scale);
      ctx.scale(scale, scale);
      ctx.translate(-tx, -ty);
    }

    if (hasShader === true) {
      let renderContext: (() => void) | null = () => {
        this.renderContext(node, texture);
      };

      (shader as CanvasShaderNode).render(ctx, node, renderContext);
      renderContext = null;
    } else {
      this.renderContext(node, texture);
    }

    if (saveAndRestore) {
      ctx.restore();
    }
  }

  renderContext(node: CoreNode, texture: Texture) {
    const color = node.premultipliedColorTl;
    const textureType = texture.type;
    const tx = node.globalTransform!.tx;
    const ty = node.globalTransform!.ty;
    const width = node.props.w;
    const height = node.props.h;

    if (textureType !== TextureType.color) {
      const tintColor = parseColor(color);
      if (textureType !== TextureType.subTexture) {
        const image = (texture.ctxTexture as CanvasTexture).getImage(tintColor);
        this.context.globalAlpha = tintColor.a ?? node.worldAlpha;
        this.context.drawImage(image, tx, ty, width, height);
        this.context.globalAlpha = 1;
        return;
      }
      const image = (
        (texture as SubTexture).parentTexture.ctxTexture as CanvasTexture
      ).getImage(tintColor);
      const props = (texture as SubTexture).props;

      this.context.globalAlpha = tintColor.a ?? node.worldAlpha;
      this.context.drawImage(
        image,
        props.x,
        props.y,
        props.w,
        props.h,
        tx,
        ty,
        width,
        height,
      );
      this.context.globalAlpha = 1;
      return;
    }
    const hasGradient =
      node.premultipliedColorTl !== node.premultipliedColorTr ||
      node.premultipliedColorTl !== node.premultipliedColorBr;
    if (hasGradient === true) {
      let endX: number = tx;
      let endY: number = ty;
      let endColor: number;
      if (node.premultipliedColorTl === node.premultipliedColorTr) {
        // vertical
        endX = tx;
        endY = ty + height;
        endColor = node.premultipliedColorBr;
      } else {
        // horizontal
        endX = tx + width;
        endY = ty;
        endColor = node.premultipliedColorTr;
      }

      let startColor = color;
      const startAlpha = (startColor >>> 24) & 0xff;
      const endAlpha = (endColor >>> 24) & 0xff;

      // if one of the colors has 0 alpha, we want to match the RGB channels
      // to the other color to prevent white bleed during zero alpha interpolation.
      if (startAlpha === 0 && endAlpha > 0) {
        startColor =
          ((startColor & 0xff000000) | (endColor & 0x00ffffff)) >>> 0;
      } else if (endAlpha === 0 && startAlpha > 0) {
        endColor = ((endColor & 0xff000000) | (startColor & 0x00ffffff)) >>> 0;
      }

      const gradient = this.context.createLinearGradient(tx, ty, endX, endY);
      gradient.addColorStop(0, normalizeCanvasColor(startColor));
      gradient.addColorStop(1, normalizeCanvasColor(endColor));
      this.context.fillStyle = gradient;
      this.context.fillRect(tx, ty, width, height);
    } else {
      this.context.fillStyle = normalizeCanvasColor(color);
      this.context.fillRect(tx, ty, width, height);
    }
  }

  createShaderNode(
    shaderKey: string,
    shaderType: Readonly<CanvasShaderType>,
    props?: Record<string, any>,
  ) {
    return new CanvasShaderNode(shaderKey, shaderType, this.stage, props);
  }

  createShaderProgram(shaderConfig) {
    return null;
  }

  override supportsShaderType(shaderType: Readonly<CanvasShaderType>): boolean {
    return shaderType.render !== undefined;
  }

  createCtxTexture(textureSource: Texture): CoreContextTexture {
    return new CanvasTexture(this.stage.txMemManager, textureSource);
  }

  renderRTTNodes(): void {
    // noop
  }

  removeRTTNode(node: CoreNode): void {
    // noop
  }

  renderToTexture(node: CoreNode): void {
    // noop
  }
  getBufferInfo(): null {
    return null;
  }

  getQuadCount(): null {
    return null;
  }

  getRenderOpCount(): null {
    return null;
  }

  /**
   * Updates the clear color of the canvas renderer.
   *
   * @param color - The color to set as the clear color.
   */
  updateClearColor(color: number) {
    this.clearColor = normalizeCanvasColor(color);
  }

  override updateViewport(): void {
    // noop
  }

  getDefaultShaderNode() {
    return null;
  }
}
