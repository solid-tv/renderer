import type { CanvasShaderType } from '../../renderers/canvas/CanvasShaderNode.js';
import type { Vec4 } from '../../renderers/webgl/internal/ShaderUtils.js';
import {
  ShadowTemplate,
  type ShadowProps,
} from '../templates/ShadowTemplate.js';
import { shadow } from './utils/render.js';

export interface ComputedShadowValues {
  shadowColor: string;
  shadowRadius: Vec4;
}

export const Shadow: CanvasShaderType<ShadowProps, ComputedShadowValues> = {
  props: ShadowTemplate.props,
  update() {
    this.computed.shadowColor = this.toColorString(this.props!['color']);
    const blur = this.props!['blur'];
    this.computed.shadowRadius = [blur, blur, blur, blur];
  },
  render(ctx, node, renderContext) {
    const { tx, ty } = node.globalTransform!;
    const { w, h } = node.props;
    shadow(
      ctx,
      tx,
      ty,
      w,
      h,
      this.computed.shadowColor!,
      this.props!['projection'],
      this.computed.shadowRadius!,
      this.stage.pixelRatio,
    );
    renderContext();
  },
};
