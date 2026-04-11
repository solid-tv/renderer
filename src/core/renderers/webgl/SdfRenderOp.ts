import { CoreRenderOp } from '../CoreRenderOp.js';
import { USE_RTT } from '../../../utils.js';
import type { WebGlCtxTexture } from './WebGlCtxTexture.js';
import type { WebGlRenderer } from './WebGlRenderer.js';
import type { BufferCollection } from './internal/BufferCollection.js';
import type { WebGlShaderNode } from './WebGlShaderNode.js';
import type { RectWithValid } from '../../lib/utils.js';
import type { Dimensions } from '../../../common/CommonTypes.js';
import type { Stage } from '../../Stage.js';

/**
 * A batched SDF text render operation.
 *
 * Rather than owning its own WebGL buffer, this op references a range
 * inside the renderer's shared SDF vertex buffer. Multiple text nodes
 * that share the same atlas texture and clipping state are merged into
 * a single SdfRenderOp, producing one draw call for many strings.
 */
export class SdfRenderOp extends CoreRenderOp {
  public numQuads = 0;
  public readonly isCoreNode = false as const;
  public renderOpTextures: WebGlCtxTexture[] = [];
  public time: number = 0;
  readonly stage: Stage;

  /**
   * Index of the first quad in the shared SDF buffer.
   * Used to compute the byte offset into the element index buffer.
   */
  public startQuad = 0;

  constructor(
    readonly renderer: WebGlRenderer,
    readonly shader: WebGlShaderNode,
    readonly quadBufferCollection: BufferCollection,
    public worldAlpha: number,
    public clippingRect: RectWithValid,
    readonly width: number,
    readonly height: number,
    readonly rtt: boolean,
    public parentHasRenderTexture: boolean,
    public framebufferDimensions: Dimensions | null,
  ) {
    super();
    this.stage = renderer.stage;
  }

  addTexture(texture: WebGlCtxTexture): number {
    const { renderOpTextures } = this;
    const length = renderOpTextures.length;

    for (let i = 0; i < length; i++) {
      if (renderOpTextures[i] === texture) {
        return i;
      }
    }

    renderOpTextures.push(texture);
    return length;
  }

  draw() {
    const { glw, options, stage } = this.renderer;

    stage.shManager.useShader(this.shader.program);
    this.shader.program.bindRenderOp(this);

    // Clipping
    if (this.clippingRect.valid === true) {
      const pixelRatio =
        USE_RTT && this.parentHasRenderTexture ? 1 : stage.pixelRatio;
      const clipX = Math.round(this.clippingRect.x * pixelRatio);
      const clipWidth = Math.round(this.clippingRect.width * pixelRatio);
      const clipHeight = Math.round(this.clippingRect.height * pixelRatio);
      let clipY = Math.round(
        options.canvas.height - clipHeight - this.clippingRect.y * pixelRatio,
      );
      // if parent has render texture, we need to adjust the scissor rect
      // to be relative to the parent's framebuffer
      if (USE_RTT && this.parentHasRenderTexture) {
        clipY = this.framebufferDimensions
          ? this.framebufferDimensions.h - this.height
          : 0;
      }

      glw.setScissorTest(true);
      glw.scissor(clipX, clipY, clipWidth, clipHeight);
    } else {
      glw.setScissorTest(false);
    }

    // Draw the batch range from the shared SDF buffer using indexed rendering.
    // 4 vertices per glyph, 6 indices per glyph (2 triangles).
    // Byte offset into the shared Uint16 index buffer:
    const byteOffset = this.startQuad * 6 * 2;
    glw.drawElements(
      glw.TRIANGLES,
      6 * this.numQuads,
      glw.UNSIGNED_SHORT,
      byteOffset,
    );
  }
}
