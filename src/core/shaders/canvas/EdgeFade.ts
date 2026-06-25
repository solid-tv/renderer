import type { CanvasShaderType } from '../../renderers/canvas/CanvasShaderNode.js';
import type { CanvasRenderer } from '../../renderers/canvas/CanvasRenderer.js';
import {
  EdgeFadeTemplate,
  type EdgeFadeProps,
} from '../templates/EdgeFadeTemplate.js';

// Shared scratch canvas, grown on demand and reused across all EdgeFade nodes.
// Rendering is single-threaded and non-reentrant so one scratch is enough.
let scratchCanvas: HTMLCanvasElement | null = null;
let scratchCtx: CanvasRenderingContext2D | null = null;

/**
 * Canvas2D implementation of {@link EdgeFade}: the node's content is drawn
 * into an offscreen canvas, the edge ramps are erased with destination-out
 * gradients, and the result is composited onto the main canvas. This keeps
 * the background behind the node intact, which a destination-out pass on the
 * main canvas could not.
 */
export const EdgeFade: CanvasShaderType<EdgeFadeProps> = {
  props: EdgeFadeTemplate.props,
  render(ctx, node, renderContext) {
    const props = this.props!;
    const left = props.left;
    const top = props.top;
    const right = props.right;
    const bottom = props.bottom;

    if (left <= 0 && top <= 0 && right <= 0 && bottom <= 0) {
      renderContext();
      return;
    }

    const w = node.props.w;
    const h = node.props.h;
    if (w <= 0 || h <= 0) {
      return;
    }

    const pr = this.stage.pixelRatio;
    const sw = w * pr;
    const sh = h * pr;

    if (scratchCanvas === null) {
      scratchCanvas = document.createElement('canvas');
      scratchCtx = scratchCanvas.getContext('2d') as CanvasRenderingContext2D;
    }
    const sctx = scratchCtx!;

    if (scratchCanvas.width < sw || scratchCanvas.height < sh) {
      // Growing the canvas implicitly clears it
      scratchCanvas.width = Math.ceil(sw);
      scratchCanvas.height = Math.ceil(sh);
    } else {
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.clearRect(0, 0, sw, sh);
    }

    // Draw the node's content at the scratch origin
    const tx = node.globalTransform!.tx;
    const ty = node.globalTransform!.ty;
    sctx.setTransform(pr, 0, 0, pr, -tx * pr, -ty * pr);
    (this.stage.renderer as CanvasRenderer).renderNodeContent(node, sctx);
    sctx.setTransform(1, 0, 0, 1, 0, 0);

    // Erase each edge with a linear ramp. Sequential destination-out passes
    // multiply: dst *= (1 - g), matching the WebGL ramp product.
    sctx.globalCompositeOperation = 'destination-out';
    if (left > 0) {
      const d = left * pr;
      const g = sctx.createLinearGradient(0, 0, d, 0);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      sctx.fillStyle = g;
      sctx.fillRect(0, 0, d, sh);
    }
    if (top > 0) {
      const d = top * pr;
      const g = sctx.createLinearGradient(0, 0, 0, d);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      sctx.fillStyle = g;
      sctx.fillRect(0, 0, sw, d);
    }
    if (right > 0) {
      const d = right * pr;
      const g = sctx.createLinearGradient(sw - d, 0, sw, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,1)');
      sctx.fillStyle = g;
      sctx.fillRect(sw - d, 0, d, sh);
    }
    if (bottom > 0) {
      const d = bottom * pr;
      const g = sctx.createLinearGradient(0, sh - d, 0, sh);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,1)');
      sctx.fillStyle = g;
      sctx.fillRect(0, sh - d, sw, d);
    }
    sctx.globalCompositeOperation = 'source-over';

    ctx.drawImage(scratchCanvas, 0, 0, sw, sh, tx, ty, w, h);
  },
};
