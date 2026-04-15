import { calcFactoredRadiusArray } from '../../lib/utils.js';
import type { CanvasShaderType } from '../../renderers/canvas/CanvasShaderNode.js';
import type { Vec4 } from '../../renderers/webgl/internal/ShaderUtils.js';
import {
  HolePunchTemplate,
  type HolePunchProps,
} from '../templates/HolePunchTemplate.js';
import { roundRect } from './utils/render.js';

export interface ComputedHolePunchValues {
  radius: Vec4;
}

export const HolePunch: CanvasShaderType<
  HolePunchProps,
  ComputedHolePunchValues
> = {
  props: HolePunchTemplate.props,
  update() {
    this.computed.radius = calcFactoredRadiusArray(
      this.props!.radius as Vec4,
      this.props!.w,
      this.props!.h,
    );
  },
  render(ctx, quad, renderContext) {
    ctx.save();
    renderContext();
    const { x, y, w, h } = this.props!;
    const gt = quad.globalTransform!;
    ctx.beginPath();
    roundRect(ctx, gt.tx + x, gt.ty + y, w, h, this.computed.radius!);
    ctx.closePath();
    ctx.fillStyle = 'black';
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fill();
    ctx.restore();
  },
};
