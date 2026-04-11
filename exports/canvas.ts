/**
 * Canvas Text Renderer
 *
 * @remarks
 * This module exports the Canvas Text Renderer for the Lightning 3 Renderer.
 * The Canvas Text Renderer is used to render text using the Canvas API,
 * this is slightly less performant than the SDF Text Renderer. However
 * the Canvas Text Renderer is more widely supported on older devices.
 *
 * You can import the exports from this module like so:
 * ```ts
 * import { CanvasTextRenderer } from '@lightning/renderer';
 * ```
 *
 * @module Canvas
 *
 * @packageDocumentation
 */

export { default as CanvasTextRenderer } from '../src/core/text-rendering/CanvasTextRenderer.js';
export { CanvasRenderer } from '../src/core/renderers/canvas/CanvasRenderer.js';
export { CanvasTexture } from '../src/core/renderers/canvas/CanvasTexture.js';
export * from '../src/core/renderers/canvas/CanvasShaderNode.js';
/**
 * @deprecated Use CanvasRenderer.
 */
export { CanvasRenderer as CanvasCoreRenderer } from '../src/core/renderers/canvas/CanvasRenderer.js';
