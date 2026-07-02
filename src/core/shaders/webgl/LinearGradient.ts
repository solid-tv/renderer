import type { CoreNode } from '../../CoreNode.js';
import { getNormalizedRgbaComponents } from '../../lib/utils.js';
import {
  LinearGradientTemplate,
  type LinearGradientProps,
} from '../templates/LinearGradientTemplate.js';
import type { WebGlRenderer } from '../../renderers/webgl/WebGlRenderer.js';
import type { WebGlShaderType } from '../../renderers/webgl/WebGlShaderNode.js';
import { genGradientColors } from '../../renderers/webgl/internal/ShaderUtils.js';

export const LinearGradient: WebGlShaderType<LinearGradientProps> = {
  props: LinearGradientTemplate.props,
  update(node: CoreNode) {
    const props = this.props!;

    // The gradient distance is an affine function of the node-local texture
    // coordinates, so it reduces to `dist = dot(v_textureCoords, a) + b`.
    // `a`/`b` depend only on the angle and node dimensions (both are part of
    // the value-key), so we compute them once on the CPU here instead of
    // recomputing the trig per fragment on the GPU.
    const angle = props.angle - (Math.PI / 180) * 90;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const w = node.w;
    const h = node.h;

    const lineDist = Math.abs(w * c) + Math.abs(h * s);
    // Gradient axis (from -> to), gradVec = -lineDist * (c, s)
    const gx = -lineDist * c;
    const gy = -lineDist * s;
    const gg = gx * gx + gy * gy;
    const invGG = gg > 0 ? 1 / gg : 0;
    // Gradient origin: f = lineDist * 0.5 * (c, s) + dimensions * 0.5
    const fx = lineDist * 0.5 * c + w * 0.5;
    const fy = lineDist * 0.5 * s + h * 0.5;

    this.uniform2f('u_grad_a', w * gx * invGG, h * gy * invGG);
    this.uniform1f('u_grad_b', -(fx * gx + fy * gy) * invGG);

    this.uniform1fv('u_stops', new Float32Array(props.stops));
    const colors: number[] = [];
    for (let i = 0; i < props.colors.length; i++) {
      const norm = getNormalizedRgbaComponents(props.colors[i]!);
      colors.push(norm[0], norm[1], norm[2], norm[3]);
    }
    this.uniform4fv('u_colors', new Float32Array(colors));
  },
  getCacheMarkers(props: LinearGradientProps) {
    return `colors:${props.colors.length}`;
  },
  fragment(renderer: WebGlRenderer, props: LinearGradientProps) {
    return `
    # ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    # else
    precision mediump float;
    # endif

    #define MAX_STOPS ${props.colors.length}

    uniform float u_alpha;

    uniform sampler2D u_texture;

    uniform vec2 u_grad_a;
    uniform float u_grad_b;
    uniform float u_stops[MAX_STOPS];
    uniform vec4 u_colors[MAX_STOPS];

    varying vec4 v_color;
    varying vec2 v_textureCoords;

    vec4 getGradientColor(float dist) {
      dist = clamp(dist, 0.0, 1.0);
      ${genGradientColors(props.colors.length)}
      return colorOut;
    }

    void main() {
      vec4 color = texture2D(u_texture, v_textureCoords) * v_color;
      float dist = dot(v_textureCoords, u_grad_a) + u_grad_b;
      vec4 colorOut = getGradientColor(dist);
      color = mix(color, colorOut, clamp(colorOut.a, 0.0, 1.0));
      gl_FragColor = color * u_alpha;
    }
  `;
  },
};
