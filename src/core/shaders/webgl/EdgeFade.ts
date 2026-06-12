import type { WebGlShaderType } from '../../renderers/webgl/WebGlShaderNode.js';
import {
  EdgeFadeTemplate,
  type EdgeFadeProps,
} from '../templates/EdgeFadeTemplate.js';

/**
 * Multiplies the node's alpha by a linear ramp inward from each edge with a
 * non-zero fade distance, revealing whatever is rendered behind the node.
 * Unlike {@link LinearGradient} this masks the texture's own alpha instead of
 * blending a gradient color over its RGB.
 */
export const EdgeFade: WebGlShaderType<EdgeFadeProps> = {
  props: EdgeFadeTemplate.props,
  update() {
    const props = this.props!;
    // Reciprocals are uploaded so the fragment shader needs no division and
    // no zero-guard branch: 1e6 saturates clamp(px * recip) to 1.0 within a
    // fraction of a pixel, which is exactly "no fade on this edge".
    this.uniform4f(
      'u_fadeRecip',
      props.left > 0 ? 1 / props.left : 1e6,
      props.top > 0 ? 1 / props.top : 1e6,
      props.right > 0 ? 1 / props.right : 1e6,
      props.bottom > 0 ? 1 / props.bottom : 1e6,
    );
  },
  vertex: `
    # ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    # else
    precision mediump float;
    # endif

    attribute vec2 a_position;
    attribute vec2 a_textureCoords;
    attribute vec4 a_color;
    attribute vec2 a_nodeCoords;

    uniform vec2 u_resolution;
    uniform float u_pixelRatio;

    varying vec4 v_color;
    varying vec2 v_textureCoords;
    varying vec2 v_nodeCoords;

    void main() {
      vec2 normalized = a_position * u_pixelRatio / u_resolution;
      vec2 zero_two = normalized * 2.0;
      vec2 clip_space = zero_two - 1.0;

      v_color = a_color;
      v_textureCoords = a_textureCoords;
      v_nodeCoords = a_nodeCoords;

      gl_Position = vec4(clip_space * vec2(1.0, -1.0), 0, 1);
    }
  `,
  fragment: `
    # ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    # else
    precision mediump float;
    # endif

    uniform vec2 u_dimensions;
    uniform sampler2D u_texture;
    uniform vec4 u_fadeRecip;

    varying vec4 v_color;
    varying vec2 v_textureCoords;
    varying vec2 v_nodeCoords;

    void main() {
      vec4 color = v_color * texture2D(u_texture, v_textureCoords);
      vec2 px = v_nodeCoords * u_dimensions;
      float fade = clamp(px.x * u_fadeRecip.x, 0.0, 1.0)
        * clamp(px.y * u_fadeRecip.y, 0.0, 1.0)
        * clamp((u_dimensions.x - px.x) * u_fadeRecip.z, 0.0, 1.0)
        * clamp((u_dimensions.y - px.y) * u_fadeRecip.w, 0.0, 1.0);
      gl_FragColor = color * fade;
    }
  `,
};
