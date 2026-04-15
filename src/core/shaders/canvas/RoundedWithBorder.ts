import { calcFactoredRadiusArray, valuesAreEqual } from '../../lib/utils.js';
import type { CanvasShaderType } from '../../renderers/canvas/CanvasShaderNode.js';
import type { Vec4 } from '../../renderers/webgl/internal/ShaderUtils.js';
import {
  RoundedWithBorderTemplate,
  type RoundedWithBorderProps,
} from '../templates/RoundedWithBorderTemplate.js';
import type { ComputedBorderValues } from './Border.js';
import type { ComputedRoundedValues } from './Rounded.js';
import { roundedRectWithBorder } from './utils/render.js';

export type ComputedRoundedWithBorderValues = ComputedRoundedValues &
  ComputedBorderValues & {
    outerBorderRadius: Vec4;
    innerBorderRadius: Vec4;
  };

export const RoundedWithBorder: CanvasShaderType<
  RoundedWithBorderProps,
  ComputedRoundedWithBorderValues
> = {
  props: RoundedWithBorderTemplate.props,
  saveAndRestore: true,
  update(node) {
    const props = this.props!;
    const radius = calcFactoredRadiusArray(
      props.radius as Vec4,
      node.w,
      node.h,
    );
    this.computed.radius = radius;
    this.computed.borderColor = this.toColorString(props['border-color']);
    this.computed.borderAsym = !valuesAreEqual(props['border-w'] as number[]);
    const borderAlign = this.props!['border-align'] as number;
    const borderGap = this.props!['border-gap'] as number;

    // Calculate outer and inner rectangle dimensions
    const [t, r, b, l] = this.props!['border-w'] as Vec4;

    const outerX = (this.computed.outerX = -l * borderAlign - borderGap);
    const outerY = (this.computed.outerY = -t * borderAlign - borderGap);
    let outerW = 0;
    let outerH = 0;

    if (r > 0) {
      outerW += r * borderAlign + borderGap;
    }
    if (l > 0) {
      outerW += l * borderAlign + borderGap;
    }

    if (b > 0) {
      outerH += b * borderAlign + borderGap;
    }
    if (t > 0) {
      outerH += t * borderAlign + borderGap;
    }

    this.computed.outerW = outerW;
    this.computed.outerH = outerH;

    this.computed.innerX = outerX + l;
    this.computed.innerY = outerY + t;
    this.computed.innerW = outerW - l - r;
    this.computed.innerH = outerH - t - b;

    this.computed.outerBorderRadius = [
      Math.max(0.0, radius[0] + (Math.max(l, r) * borderAlign + borderGap)),
      Math.max(0.0, radius[1] + (Math.max(t, b) * borderAlign + borderGap)),
      Math.max(0.0, radius[2] + (Math.max(b, t) * borderAlign + borderGap)),
      Math.max(0.0, radius[3] + (Math.max(l, r) * borderAlign + borderGap)),
    ];

    this.computed.innerBorderRadius = [
      Math.max(0.0, this.computed.outerBorderRadius[0] - Math.max(l, r)),
      Math.max(0.0, this.computed.outerBorderRadius[1] - Math.max(t, b)),
      Math.max(0.0, this.computed.outerBorderRadius[2] - Math.max(b, t)),
      Math.max(0.0, this.computed.outerBorderRadius[3] - Math.max(l, r)),
    ];
  },
  render(ctx, node, renderContext) {
    const computed = this.computed as ComputedRoundedWithBorderValues;
    roundedRectWithBorder(
      ctx,
      node.globalTransform!.tx,
      node.globalTransform!.ty,
      node.props.w,
      node.props.h,
      computed.radius,
      this.props!['border-gap'] as number,
      computed.outerX,
      computed.outerY,
      computed.outerW,
      computed.outerH,
      computed.outerBorderRadius,
      computed.innerX,
      computed.innerY,
      computed.innerW,
      computed.innerH,
      computed.innerBorderRadius,
      computed.borderColor,
      renderContext,
    );
  },
};
