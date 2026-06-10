import type { CoreNode } from '../../CoreNode.js';
import { calcFactoredRadiusArray } from '../../lib/utils.js';
import type { Vec4 } from '../../renderers/webgl/internal/ShaderUtils.js';
import type { WebGlShaderType } from '../../renderers/webgl/WebGlShaderNode.js';
import {
  RoundedWithBorderTemplate,
  type RoundedWithBorderProps,
} from '../templates/RoundedWithBorderTemplate.js';

/**
 * Layout of the values written by {@link calcBorderShaderValues}:
 *
 * ```
 * [0]  outerSize.x        [1]  outerSize.y
 * [2]  innerSize.x        [3]  innerSize.y
 * [4]  outerBorderUv.x    [5]  outerBorderUv.y
 * [6]  innerBorderUv.x    [7]  innerBorderUv.y
 * [8..11]  outerBorderRadius (TL, TR, BR, BL)
 * [12..15] innerBorderRadius (TL, TR, BR, BL)
 * [16] edgeOffset.x       [17] edgeOffset.y
 * ```
 */
export const BORDER_VALUES_LENGTH = 18;

/**
 * CPU mirror of the border math that previously ran in the vertex shader.
 *
 * Every value here is constant across the quad (derived only from border
 * props, factored radius and node dimensions), so computing it once per
 * prop/dimension change and uploading uniforms is strictly cheaper than
 * interpolating 18 floats of varyings per fragment.
 *
 * `borderWidth` is [top, right, bottom, left]; `radius` is the already
 * factored corner radius array (TL, TR, BR, BL).
 */
export const calcBorderShaderValues = (
  borderWidth: Vec4,
  align: number,
  gap: number,
  radius: Vec4,
  w: number,
  h: number,
  out: Float32Array,
): void => {
  // adjustedBorderWidth = u_borderWidth - 1.0 + clamp(u_borderWidth, -1.0, 1.0)
  const bwT = borderWidth[0];
  const bwR = borderWidth[1];
  const bwB = borderWidth[2];
  const bwL = borderWidth[3];
  const top = bwT - 1 + (bwT < -1 ? -1 : bwT > 1 ? 1 : bwT);
  const right = bwR - 1 + (bwR < -1 ? -1 : bwR > 1 ? 1 : bwR);
  const bottom = bwB - 1 + (bwB < -1 ? -1 : bwB > 1 ? 1 : bwB);
  const left = bwL - 1 + (bwL < -1 ? -1 : bwL > 1 ? 1 : bwL);

  const borderSizeX = right + left;
  const borderSizeY = top + bottom;
  const extraX = borderSizeX * align;
  const extraY = borderSizeY * align;

  // gap* = step(0.001, border*) * u_borderGap
  const gapTop = top >= 0.001 ? gap : 0;
  const gapRight = right >= 0.001 ? gap : 0;
  const gapBottom = bottom >= 0.001 ? gap : 0;
  const gapLeft = left >= 0.001 ? gap : 0;
  const gapSizeX = gapLeft + gapRight;
  const gapSizeY = gapTop + gapBottom;

  const outerX = (w + gapSizeX + extraX) * 0.5;
  const outerY = (h + gapSizeY + extraY) * 0.5;
  out[0] = outerX;
  out[1] = outerY;
  out[2] = outerX - borderSizeX * 0.5;
  out[3] = outerY - borderSizeY * 0.5;

  let borderDiffX = right - left;
  let borderDiffY = bottom - top;
  const signDiffX = borderDiffX > 0 ? 1 : borderDiffX < 0 ? -1 : 0;
  const signDiffY = borderDiffY > 0 ? 1 : borderDiffY < 0 ? -1 : 0;
  borderDiffX = borderDiffX < 0 ? -borderDiffX : borderDiffX;
  borderDiffY = borderDiffY < 0 ? -borderDiffY : borderDiffY;

  let gapDiffX = gapRight - gapLeft;
  let gapDiffY = gapBottom - gapTop;
  const signGapDiffX = gapDiffX > 0 ? 1 : gapDiffX < 0 ? -1 : 0;
  const signGapDiffY = gapDiffY > 0 ? 1 : gapDiffY < 0 ? -1 : 0;
  gapDiffX = gapDiffX < 0 ? -gapDiffX : gapDiffX;
  gapDiffY = gapDiffY < 0 ? -gapDiffY : gapDiffY;

  const outerUvX =
    -signDiffX * borderDiffX * align * 0.5 - signGapDiffX * gapDiffX * 0.5;
  const outerUvY =
    -signDiffY * borderDiffY * align * 0.5 - signGapDiffY * gapDiffY * 0.5;
  out[4] = outerUvX;
  out[5] = outerUvY;
  out[6] = outerUvX + signDiffX * borderDiffX * 0.5;
  out[7] = outerUvY + signDiffY * borderDiffY * 0.5;

  const alignTop = top * align + gap;
  const alignRight = right * align + gap;
  const alignBottom = bottom * align + gap;
  const alignLeft = left * align + gap;

  const oTl = radius[0] + (alignTop > alignLeft ? alignTop : alignLeft);
  const oTr = radius[1] + (alignTop > alignRight ? alignTop : alignRight);
  const oBr = radius[2] + (alignBottom > alignRight ? alignBottom : alignRight);
  const oBl = radius[3] + (alignBottom > alignLeft ? alignBottom : alignLeft);
  out[8] = oTl < 0 ? 0 : oTl;
  out[9] = oTr < 0 ? 0 : oTr;
  out[10] = oBr < 0 ? 0 : oBr;
  out[11] = oBl < 0 ? 0 : oBl;

  const iTl = out[8]! - (top > left ? top : left);
  const iTr = out[9]! - (top > right ? top : right);
  const iBr = out[10]! - (bottom > right ? bottom : right);
  const iBl = out[11]! - (bottom > left ? bottom : left);
  out[12] = iTl < 0 ? 0 : iTl;
  out[13] = iTr < 0 ? 0 : iTr;
  out[14] = iBr < 0 ? 0 : iBr;
  out[15] = iBl < 0 ? 0 : iBl;

  // edgeOffset = step(u_dimensions * 0.5, outerSize) * (extraSize + u_borderGap)
  out[16] = outerX >= w * 0.5 ? extraX + gap : 0;
  out[17] = outerY >= h * 0.5 ? extraY + gap : 0;
};

// Scratch buffer for calcBorderShaderValues. Safe to share: the values are
// copied into the uniform collection by the uniform setters before the next
// update() call can run.
const borderValues = new Float32Array(BORDER_VALUES_LENGTH);

/**
 * Similar to the {@link DefaultShader} but cuts out 4 rounded rectangle corners
 * as defined by the specified corner {@link RoundedProps.radius} and renders a
 * border as defined by {@link RoundedWithBorderProps}.
 *
 * All border geometry is precomputed on the CPU (cached per prop/dimension
 * change via the shader value-key cache) and uploaded as uniforms, so the
 * fragment shader carries the same 3 varyings as the plain Rounded shader.
 * With a zero-width border the per-pixel cost is identical to Rounded.
 */
export const RoundedWithBorder: WebGlShaderType<RoundedWithBorderProps> = {
  props: RoundedWithBorderTemplate.props,
  update(node: CoreNode) {
    this.uniformRGBA('u_borderColor', this.props!['border-color']);
    this.uniformRGBA('u_fillColor', this.props!['border-fill']);
    const gap = this.props!['border-gap'] as number;
    this.uniform1f('u_borderGap', gap);

    const radius = calcFactoredRadiusArray(
      this.props!.radius as Vec4,
      node.w,
      node.h,
    );
    this.uniform4fa('u_radius', radius);

    const borderWidth = this.props!['border-w'] as Vec4;

    // borderZero = 1.0 - step(0.001, dot(abs(u_borderWidth), vec4(1.0)))
    const sumAbs =
      (borderWidth[0] < 0 ? -borderWidth[0] : borderWidth[0]) +
      (borderWidth[1] < 0 ? -borderWidth[1] : borderWidth[1]) +
      (borderWidth[2] < 0 ? -borderWidth[2] : borderWidth[2]) +
      (borderWidth[3] < 0 ? -borderWidth[3] : borderWidth[3]);
    const borderZero = sumAbs >= 0.001 ? 0 : 1;
    this.uniform1f('u_borderZero', borderZero);

    // With no border, both shader stages early-out before reading any of the
    // border uniforms, so skip computing and uploading them entirely.
    if (borderZero === 1) {
      return;
    }

    const v = borderValues;
    calcBorderShaderValues(
      borderWidth,
      this.props!['border-align'] as number,
      gap,
      radius,
      node.w,
      node.h,
      v,
    );

    this.uniform2f('u_outerSize', v[0]!, v[1]!);
    this.uniform2f('u_innerSize', v[2]!, v[3]!);
    this.uniform2f('u_outerBorderUv', v[4]!, v[5]!);
    this.uniform2f('u_innerBorderUv', v[6]!, v[7]!);
    this.uniform4f('u_outerBorderRadius', v[8]!, v[9]!, v[10]!, v[11]!);
    this.uniform4f('u_innerBorderRadius', v[12]!, v[13]!, v[14]!, v[15]!);
    this.uniform2f('u_edgeOffset', v[16]!, v[17]!);
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

    uniform float u_borderZero;
    uniform vec2 u_edgeOffset;

    varying vec4 v_color;
    varying vec2 v_textureCoords;
    varying vec2 v_nodeCoords;

    void main() {
      vec2 screenSpace = vec2(2.0 / u_resolution.x, -2.0 / u_resolution.y);
      vec2 edge = clamp(a_nodeCoords * 2.0 - vec2(1.0), -1.0, 1.0);

      // With a border the quad is expanded by 1px plus the precomputed
      // outside-growth; u_borderZero zeroes both terms when borderless.
      float hasBorder = 1.0 - u_borderZero;
      vec2 edgeOffset = edge * u_edgeOffset * hasBorder;
      vec2 vertexPos = (a_position + edge * hasBorder + edgeOffset) * u_pixelRatio;

      gl_Position = vec4(vertexPos.x * screenSpace.x - 1.0, -sign(screenSpace.y) * (vertexPos.y * -abs(screenSpace.y)) + 1.0, 0.0, 1.0);

      v_color = a_color;
      v_nodeCoords = a_nodeCoords + (screenSpace + edgeOffset) / (u_dimensions);
      v_textureCoords = a_textureCoords + (screenSpace + edgeOffset) / (u_dimensions);
    }
  `,
  fragment: `
    # ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    # else
    precision mediump float;
    # endif

    uniform float u_pixelRatio;
    uniform float u_alpha;
    uniform vec2 u_dimensions;
    uniform sampler2D u_texture;

    uniform vec4 u_radius;
    uniform vec4 u_borderColor;
    uniform vec4 u_fillColor;
    uniform float u_borderGap;
    uniform float u_borderZero;

    uniform vec2 u_innerSize;
    uniform vec2 u_outerSize;
    uniform vec2 u_outerBorderUv;
    uniform vec2 u_innerBorderUv;
    uniform vec4 u_innerBorderRadius;
    uniform vec4 u_outerBorderRadius;

    varying vec4 v_color;
    varying vec2 v_textureCoords;
    varying vec2 v_nodeCoords;

    float roundedBox(vec2 p, vec2 s, vec4 r) {
      r.xy = (p.x > 0.0) ? r.yz : r.xw;
      r.x = (p.y > 0.0) ? r.y : r.x;
      vec2 q = abs(p) - s + r.x;
      return (min(max(q.x, q.y), 0.0) + length(max(q, 0.0))) - r.x;
    }

    void main() {
      vec4 color = texture2D(u_texture, v_textureCoords) * v_color;
      vec4 resultColor = vec4(0.0);
      vec2 halfDimensions = u_dimensions * 0.5;
      vec2 boxUv = v_nodeCoords.xy * u_dimensions - halfDimensions;
      float edgeWidth = 1.0 / u_pixelRatio;

      float nodeDist;
      float nodeAlpha;

      if(u_borderZero == 1.0) {
        nodeDist = roundedBox(boxUv, halfDimensions - edgeWidth, u_radius);
        nodeAlpha = 1.0 - smoothstep(-0.5 * edgeWidth, 0.5 * edgeWidth, nodeDist);
        gl_FragColor = (color * nodeAlpha) * u_alpha;
        return;
      }

      float outerDist = roundedBox(boxUv + u_outerBorderUv, u_outerSize - edgeWidth, u_outerBorderRadius);
      float innerDist = roundedBox(boxUv + u_innerBorderUv, u_innerSize - edgeWidth, u_innerBorderRadius);

      if(u_borderGap == 0.0) {
        float outerAlpha = 1.0 - smoothstep(-0.5 * edgeWidth, 0.5 * edgeWidth, outerDist);
        float innerAlpha = 1.0 - smoothstep(-0.5 * edgeWidth, 0.5 * edgeWidth, innerDist);
        resultColor = mix(resultColor, u_borderColor, outerAlpha * u_borderColor.a);
        resultColor = mix(resultColor, color, innerAlpha);
        gl_FragColor = resultColor * u_alpha;
        return;
      }

      nodeDist = roundedBox(boxUv, halfDimensions - edgeWidth, u_radius);
      nodeAlpha = 1.0 - smoothstep(-0.5 * edgeWidth, 0.5 * edgeWidth, nodeDist);
      float innerAlpha = 1.0 - smoothstep(-0.5 * edgeWidth, 0.5 * edgeWidth, innerDist);
      float gapAlpha = max(0.0, innerAlpha - nodeAlpha);

      float borderDist = max(-innerDist, outerDist);
      float borderAlpha = 1.0 - smoothstep(-0.5 * edgeWidth, 0.5 * edgeWidth, borderDist);

      resultColor = (color * nodeAlpha) + (u_fillColor * gapAlpha);
      resultColor = mix(resultColor, u_borderColor, borderAlpha * u_borderColor.a);
      gl_FragColor = resultColor * u_alpha;
    }
  `,
};
