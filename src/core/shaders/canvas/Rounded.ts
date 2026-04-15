import { calcFactoredRadiusArray } from '../../lib/utils.js';
import type { CanvasShaderType } from '../../renderers/canvas/CanvasShaderNode.js';
import type { Vec4 } from '../../renderers/webgl/internal/ShaderUtils.js';
import {
  RoundedTemplate,
  type RoundedProps,
} from '../templates/RoundedTemplate.js';
import { roundRect } from './utils/render.js';

export interface ComputedRoundedValues {
  radius: Vec4;
}

export const Rounded: CanvasShaderType<RoundedProps, ComputedRoundedValues> = {
  props: RoundedTemplate.props,
  saveAndRestore: true,
  update(node) {
    this.computed.radius = calcFactoredRadiusArray(
      this.props!.radius as Vec4,
      node.w,
      node.h,
    );
  },
  render(ctx, node, renderContext) {
    const path = new Path2D();
    roundRect(
      path,
      node.globalTransform!.tx,
      node.globalTransform!.ty,
      node.props.w,
      node.props.h,
      this.computed.radius!,
    );
    ctx.clip(path);

    renderContext();
  },
};
