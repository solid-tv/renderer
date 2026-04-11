import type { WebGlShaderType } from '../../renderers/webgl/WebGlShaderNode.js';
import {
  ShadowTemplate,
  type ShadowProps,
} from '../templates/ShadowTemplate.js';

export const Shadow: WebGlShaderType<ShadowProps> = {
  props: ShadowTemplate.props,
  update() {
    this.uniformRGBA('u_color', this.props!.color);
    this.uniform4fa('u_shadow', this.props!.projection);
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
    uniform vec2 u_dimensions;

    uniform vec4 u_shadow;

    varying vec4 v_color;
    varying vec2 v_textureCoords;

    varying vec2 v_boxUv;
    varying vec2 v_boxSize;
    varying vec2 v_boxSmooth;
    varying vec2 v_shadowBox;
    varying vec2 v_shadowSize;
    varying float v_shadowRadius;
    varying vec2 v_shadowSmooth;

    void main() {
      vec2 screenSpace = vec2(2.0 / u_resolution.x,  -2.0 / u_resolution.y);
      vec2 outerEdge = clamp(a_nodeCoords * 2.0 - vec2(1.0), -1.0, 1.0);

      vec2 padding = vec2(max(0.0, u_shadow.w) + u_shadow.z);
      vec2 offsetShift = mix(min(vec2(0.0), u_shadow.xy), max(vec2(0.0), u_shadow.xy), (outerEdge + 1.0) * 0.5);
      vec2 shadowEdge = outerEdge * padding + offsetShift;

      vec2 vertexPos = (a_position + outerEdge + shadowEdge) * u_pixelRatio;
      gl_Position = vec4(vertexPos.x * screenSpace.x - 1.0, -sign(screenSpace.y) * (vertexPos.y * -abs(screenSpace.y)) + 1.0, 0.0, 1.0);

      v_color = a_color;
      v_textureCoords = a_textureCoords + (screenSpace + shadowEdge) / (u_dimensions);

      float edgeWidth = 1.0 / u_pixelRatio;
      vec2 halfDimensions = u_dimensions * 0.5;

      v_boxUv = (a_nodeCoords + (screenSpace + shadowEdge) / (u_dimensions)) * u_dimensions - halfDimensions;
      v_boxSize = halfDimensions - edgeWidth;
      v_boxSmooth = vec2(0.0, edgeWidth);

      v_shadowBox = v_boxUv - u_shadow.xy;
      v_shadowSize = halfDimensions + u_shadow.w - edgeWidth;
      v_shadowRadius = max(0.0, u_shadow.w);
      v_shadowSmooth = vec2(-u_shadow.z, u_shadow.z + 0.001);
    }
  `,
  fragment: `
    # ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    # else
    precision mediump float;
    # endif

    uniform float u_alpha;
    uniform sampler2D u_texture;

    uniform vec4 u_color;

    varying vec4 v_color;
    varying vec2 v_textureCoords;

    varying vec2 v_boxUv;
    varying vec2 v_boxSize;
    varying vec2 v_boxSmooth;
    varying vec2 v_shadowBox;
    varying vec2 v_shadowSize;
    varying float v_shadowRadius;
    varying vec2 v_shadowSmooth;

    float box(vec2 p, vec2 s) {
      vec2 q = abs(p) - s;
      return (min(max(q.x, q.y), 0.0) + length(max(q, 0.0))) + 2.0;
    }

    float shadowBox(vec2 p, vec2 s, float r) {
      vec2 q = abs(p) - s + r;
      float dist = min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
      return 1.0 - smoothstep(v_shadowSmooth.x, v_shadowSmooth.y, dist);
    }

    void main() {
      vec4 color = texture2D(u_texture, v_textureCoords) * v_color;

      float boxDist = box(v_boxUv, v_boxSize);
      float boxAlpha = 1.0 - smoothstep(v_boxSmooth.x, v_boxSmooth.y, boxDist);

      vec4 resColor = vec4(0.0);
      if (u_color.a > 0.0) {
        float shadowDist = shadowBox(v_shadowBox, v_shadowSize, v_shadowRadius);
        resColor = u_color * shadowDist;
      }

      resColor = mix(resColor, color, min(color.a, boxAlpha));
      gl_FragColor = resColor * u_alpha;
    }
  `,
};
