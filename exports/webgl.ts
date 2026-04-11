/**
 * SDF Font renderer
 *
 * @remarks
 * This module exports the SDF Font renderer for the Lightning 3 Renderer.
 * The SDF Font renderer is used to render text using Single-Channel Signed
 * Distance Field (SSDF) fonts or Multi-Channel Signed Distance Field (MSDF)
 * fonts. The SDF font renderer is used to render text in a way that is
 * optimized for GPU rendering.
 *
 * You can import the exports from this module like so:
 * ```ts
 * import { SdfTextRenderer } from '@lightning/renderer';
 * ```
 *
 * @packageDocumentation
 */

export * from '../src/core/text-rendering/SdfTextRenderer.js';
export { WebGlRenderer } from '../src/core/renderers/webgl/WebGlRenderer.js';
export { WebGlCtxTexture } from '../src/core/renderers/webgl/WebGlCtxTexture.js';

export * from '../src/core/renderers/webgl/WebGlShaderNode.js';

/**
 * @deprecated Use WebGlRenderer.
 */
export { WebGlRenderer as WebGlCoreRenderer } from '../src/core/renderers/webgl/WebGlRenderer.js';
export { WebGlRenderer as WebGlCoreCtxTexture } from '../src/core/renderers/webgl/WebGlRenderer.js';

export * as shaders from './webgl-shaders.js';

export { default as SdfTextRenderer } from '../src/core/text-rendering/SdfTextRenderer.js';
