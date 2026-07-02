import type { CoreNode } from '../../CoreNode.js';
import { getNormalizedRgbaComponents } from '../../lib/utils.js';
import {
  RadialGradientTemplate,
  type RadialGradientProps,
} from '../templates/RadialGradientTemplate.js';
import type { WebGlShaderType } from '../../renderers/webgl/WebGlShaderNode.js';
import type { WebGlRenderer } from '../../renderers/webgl/WebGlRenderer.js';
import { genGradientColors } from '../../renderers/webgl/internal/ShaderUtils.js';

export const RadialGradient: WebGlShaderType<RadialGradientProps> = {
  props: RadialGradientTemplate.props,
  update(node: CoreNode) {
    const props = this.props!;
    this.uniform2f(
      'u_projection',
      props.pivot[0] * node.w,
      props.pivot[1] * node.h,
    );
    this.uniform2f('u_size', props.w, props.h);
    this.uniform1fv('u_stops', new Float32Array(props.stops));
    const colors: number[] = [];
    for (let i = 0; i < props.colors.length; i++) {
      const norm = getNormalizedRgbaComponents(props.colors[i]!);
      colors.push(norm[0], norm[1], norm[2], norm[3]);
    }
    this.uniform4fv('u_colors', new Float32Array(colors));
  },
  getCacheMarkers(props: RadialGradientProps) {
    return `colors:${props.colors.length}`;
  },
  fragment(renderer: WebGlRenderer, props: RadialGradientProps) {
    return `
      # ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
      # else
      precision mediump float;
      # endif

      #define MAX_STOPS ${props.colors.length}

      uniform float u_alpha;
      uniform vec2 u_dimensions;

      uniform sampler2D u_texture;

      uniform vec2 u_projection;
      uniform vec2 u_size;

      uniform float u_stops[MAX_STOPS];
      uniform vec4 u_colors[MAX_STOPS];

      varying vec4 v_color;
      varying vec2 v_textureCoords;
      varying vec2 v_nodeCoords;

      vec4 getGradientColor(float dist) {
        dist = clamp(dist, 0.0, 1.0);
        ${genGradientColors(props.colors.length)}
        return colorOut;
      }

      void main() {
        vec4 color = texture2D(u_texture, v_textureCoords) * v_color;
        vec2 point = v_nodeCoords.xy * u_dimensions;
        float dist = length((point - u_projection) / u_size);

        vec4 colorOut = getGradientColor(dist);
        color = mix(color, colorOut, clamp(colorOut.a, 0.0, 1.0));
        gl_FragColor = color * u_alpha;
      }
    `;
  },
};
