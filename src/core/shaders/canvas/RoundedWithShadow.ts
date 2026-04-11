import { calcFactoredRadiusArray } from '../../lib/utils.js';
import type { CanvasShaderType } from '../../renderers/canvas/CanvasShaderNode.js';
import type { Vec4 } from '../../renderers/webgl/internal/ShaderUtils.js';
import {
  RoundedWithShadowTemplate,
  type RoundedWithShadowProps,
} from '../templates/RoundedWithShadowTemplate.js';
import type { ComputedRoundedValues } from './Rounded.js';
import type { ComputedShadowValues } from './Shadow.js';
import * as render from './utils/render.js';

type ComputedValues = ComputedRoundedValues & ComputedShadowValues;

export const RoundedWithShadow: CanvasShaderType<
  RoundedWithShadowProps,
  ComputedValues
> = {
  props: RoundedWithShadowTemplate.props,
  saveAndRestore: true,
  update(node) {
    const props = this.props!;
    const radius = calcFactoredRadiusArray(
      props.radius as Vec4,
      node.w,
      node.h,
    );
    this.computed.radius = radius;
    this.computed.shadowColor = this.toColorString(props['shadow-color']);
    this.computed.shadowRadius = radius.map(
      (value) => value + props['shadow-blur'],
    ) as Vec4;
  },
  render(ctx, quad, renderContext) {
    const { tx, ty, width, height } = quad;
    const computed = this.computed as ComputedValues;

    if (this.props!['shadow-color'] !== 0) {
      render.shadow(
        ctx,
        tx,
        ty,
        width,
        height,
        computed.shadowColor,
        this.props!['shadow-projection'],
        computed.shadowRadius,
        this.stage.pixelRatio,
      );
    }

    const path = new Path2D();
    render.roundRect(path, tx, ty, width, height, computed.radius);
    ctx.clip(path);
    renderContext();
  },
};
