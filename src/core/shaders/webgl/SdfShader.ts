import type { WebGlShaderType } from '../../renderers/webgl/WebGlShaderNode.js';

/**
 * SdfShader supports multi-channel and single-channel signed distance field textures.
 *
 * @remarks
 * All per-glyph data (position, color, distance range) is provided via vertex
 * attributes so that multiple text nodes sharing the same font atlas can be
 * batched into a single draw call.
 *
 * This Shader is used by the {@link SdfTextRenderer}. Do not use this Shader
 * directly. Instead create a Text Node and assign a SDF font family to it.
 */
export const Sdf: WebGlShaderType = {
  vertex: `
    # ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    # else
    precision mediump float;
    # endif

    // Pre-transformed world-pixel position
    attribute vec2 a_position;
    attribute vec2 a_textureCoords;
    // Per-vertex color (RGBA, unsigned byte, normalized)
    attribute vec4 a_color;
    // Per-vertex SDF distance range
    attribute float a_distRange;

    uniform vec2 u_resolution;
    uniform float u_pixelRatio;

    varying vec2 v_texcoord;
    varying float v_scaledDistRange;
    varying vec4 v_color;

    void main() {
      // a_position is already in world pixel space (pre-transformed on CPU)
      vec2 screenSpace = (a_position * u_pixelRatio / u_resolution * 2.0 - 1.0) * vec2(1, -1);

      gl_Position = vec4(screenSpace, 0.0, 1.0);
      v_texcoord = a_textureCoords;
      v_scaledDistRange = a_distRange * u_pixelRatio;
      v_color = a_color;
    }
  `,
  fragment: `
    # ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    # else
    precision mediump float;
    # endif

    uniform sampler2D u_texture;

    varying vec2 v_texcoord;
    varying float v_scaledDistRange;
    varying vec4 v_color;

    float median(float r, float g, float b) {
        return clamp(b, min(r, g), max(r, g));
    }

    void main() {
        vec3 s = texture2D(u_texture, v_texcoord).rgb;
        float sigDist = v_scaledDistRange * (median(s.r, s.g, s.b) - 0.5);
        float opacity = clamp(sigDist + 0.5, 0.0, 1.0) * v_color.a;

        // Premultiply RGB by final opacity
        gl_FragColor = vec4(v_color.rgb * opacity, opacity);
    }
  `,
};
