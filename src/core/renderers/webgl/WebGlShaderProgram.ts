import type { WebGlContextWrapper } from '../../lib/WebGlContextWrapper.js';
import { USE_RTT } from '../../../utils.js';
import { Default } from '../../shaders/webgl/Default.js';
import type { CoreShaderProgram } from '../CoreShaderProgram.js';
import type { WebGlCtxTexture } from './WebGlCtxTexture.js';
import type { WebGlRenderer, WebGlRenderOp } from './WebGlRenderer.js';
import type { WebGlShaderType } from './WebGlShaderNode.js';
import { WebGlShaderNode } from './WebGlShaderNode.js';
import type { BufferCollection } from './internal/BufferCollection.js';
import {
  createProgram,
  createShader,
  type UniformSet1Param,
  type UniformSet2Params,
  type UniformSet3Params,
  type UniformSet4Params,
} from './internal/ShaderUtils.js';
import { CoreNode } from '../../CoreNode.js';

export class WebGlShaderProgram implements CoreShaderProgram {
  protected program: WebGLProgram | null;
  protected renderer: WebGlRenderer;
  protected glw: WebGlContextWrapper;
  protected attributeLocations: string[];
  protected uniformLocations: Record<string, WebGLUniformLocation> | null;
  protected lifecycle: Pick<WebGlShaderType, 'update' | 'canBatch'>;
  protected useSystemAlpha = false;
  protected useSystemDimensions = false;
  protected useTimeValue = false;
  public isDestroyed = false;
  supportsIndexedTextures = false;

  /**
   * Shadow copies of this program's GL uniform state, used by
   * {@link bindRenderOp} to skip redundant gl.uniform* calls.
   *
   * @remarks
   * GL uniform values are state on the program object and persist across
   * useProgram switches, and bindRenderOp is the only writer of these
   * uniforms, so the shadows always mirror GL truth — even when ops using
   * other programs are interleaved between two ops of this program.
   *
   * `lastBoundUniforms` tracks the shader node's uniform collection by
   * identity: collections are created once, filled once, and shared by
   * reference across shader nodes with the same value key (see
   * WebGlShaderNode.update), so reference equality implies value equality.
   * The failure direction is safe — a new collection holding identical
   * values just causes a redundant upload, never a wrong skip.
   *
   * Sentinels: -1 never collides with real pixel ratios, resolutions,
   * alphas, dimensions, or time values (all >= 0).
   */
  protected lastBoundUniforms: unknown = null;
  protected lastPixelRatio = -1;
  protected lastResolutionW = -1;
  protected lastResolutionH = -1;
  protected lastAlpha = -1;
  protected lastDimensionsW = -1;
  protected lastDimensionsH = -1;
  protected lastTime = -1;

  /**
   * Cached Vertex Array Objects, keyed by the buffer collection they capture.
   *
   * @remarks
   * A VAO records this program's attribute layout (enabled arrays, pointers and
   * their source buffers) plus the shared element index buffer, so a draw only
   * needs a single `bindVertexArray` instead of re-pointing every attribute. In
   * practice a program only ever binds one collection, but keying by collection
   * keeps it correct if that ever changes. Empty / unused when the context has
   * no VAO support (see {@link WebGlContextWrapper.canUseVertexArrayObject}).
   */
  protected vaos = new Map<BufferCollection, WebGLVertexArrayObject | null>();

  constructor(
    renderer: WebGlRenderer,
    config: WebGlShaderType,
    resolvedProps: Record<string, any>,
  ) {
    this.renderer = renderer;
    const glw = (this.glw = renderer.glw);

    this.supportsIndexedTextures =
      config.supportsIndexedTextures || this.supportsIndexedTextures;

    // Check that required extensions are supported
    const requiredExtensions = config.webgl1Extensions || [];
    requiredExtensions.forEach((extensionName) => {
      if (!glw.getExtension(extensionName)) {
        throw new Error(
          `Shader "${this.constructor.name}" requires extension "${extensionName}" for WebGL 1.0 but wasn't found`,
        );
      }
    });

    let vertexSource =
      config.vertex instanceof Function
        ? config.vertex(renderer, resolvedProps)
        : config.vertex;

    if (vertexSource === undefined) {
      vertexSource = Default.vertex as string;
    }

    const fragmentSource =
      config.fragment instanceof Function
        ? config.fragment(renderer, resolvedProps)
        : config.fragment;

    const vertexShader = createShader(glw, glw.VERTEX_SHADER, vertexSource);
    if (!vertexShader) {
      throw new Error('Vertex shader creation failed');
    }

    const fragmentShader = createShader(
      glw,
      glw.FRAGMENT_SHADER,
      fragmentSource,
    );

    if (!fragmentShader) {
      throw new Error('fragment shader creation failed');
    }

    const program = createProgram(glw, vertexShader, fragmentShader);
    this.program = program;
    this.attributeLocations = glw.getAttributeLocations(program);

    const uniLocs = (this.uniformLocations = glw.getUniformLocations(program));

    this.useSystemAlpha = uniLocs['u_alpha'] !== undefined;
    this.useSystemDimensions = uniLocs['u_dimensions'] !== undefined;

    this.useTimeValue =
      this.glw.getUniformLocation(program, 'u_dimensions') !== null &&
      config.time !== undefined;

    this.lifecycle = {
      update: config.update,
      canBatch: config.canBatch,
    };
  }

  disableAttribute(location: number) {
    this.glw.disableVertexAttribArray(location);
  }

  disableAttributes() {
    const glw = this.glw;
    const attribLen = this.attributeLocations.length;
    for (let i = 0; i < attribLen; i++) {
      glw.disableVertexAttribArray(i);
    }
  }

  reuseRenderOp(node: CoreNode, currentRenderOp: WebGlRenderOp): boolean {
    if (this.lifecycle.canBatch !== undefined) {
      return this.lifecycle.canBatch(node, currentRenderOp);
    }

    // Read node getters only for the system uniforms this program actually
    // uses — node.time in particular is a getter that runs per call.
    if (this.useTimeValue === true) {
      if (node.time !== currentRenderOp.time) {
        return false;
      }
    }

    if (this.useSystemAlpha === true) {
      if (node.worldAlpha !== currentRenderOp.worldAlpha) {
        return false;
      }
    }

    if (this.useSystemDimensions === true) {
      if (node.w !== currentRenderOp.w || node.h !== currentRenderOp.h) {
        return false;
      }
    }

    const shader = node.props.shader as WebGlShaderNode | null;
    const opShader = currentRenderOp.shader as WebGlShaderNode | null;

    // Same shader node — same resolved props by definition.
    if (shader === opShader) {
      return true;
    }

    if (shader === null || opShader === null) {
      return false;
    }

    // Shader nodes with equal value keys share their uniform collection by
    // reference (see WebGlShaderNode.update); reference equality implies the
    // resolved prop values match without a key-by-key compare.
    if (shader.uniforms === opShader.uniforms) {
      return true;
    }

    const shaderPropsA = shader.resolvedProps as
      | Record<string, unknown>
      | undefined;
    const shaderPropsB = opShader.resolvedProps as
      | Record<string, unknown>
      | undefined;

    if (
      (shaderPropsA === undefined && shaderPropsB !== undefined) ||
      (shaderPropsA !== undefined && shaderPropsB === undefined)
    ) {
      return false;
    }

    if (shaderPropsA !== undefined && shaderPropsB !== undefined) {
      for (const key in shaderPropsA) {
        if (shaderPropsA[key] !== shaderPropsB[key]) {
          return false;
        }
      }
    }

    return true;
  }

  bindRenderOp(renderOp: WebGlRenderOp) {
    const isCoreNode = renderOp.isCoreNode;

    this.bindTextures(renderOp.renderOpTextures);
    this.bindBufferCollection(renderOp.quadBufferCollection);

    const parentHasRenderTexture = renderOp.parentHasRenderTexture;
    const framebufferDimensions =
      isCoreNode && renderOp.parentHasRenderTexture
        ? renderOp.parentFramebufferDimensions
        : renderOp.framebufferDimensions;

    // Skip if the parent and current operation both have render textures
    if (USE_RTT && renderOp.rtt === true && parentHasRenderTexture === true) {
      return;
    }

    // Resolve target pixel ratio / resolution, then compare-and-set against
    // the program's shadow state. Each gl.uniform* call below crosses into
    // the GPU-process command buffer, so skipping value-identical re-uploads
    // is a real per-op CPU saving on embedded targets.
    let pixelRatio: number;
    let resolutionW: number;
    let resolutionH: number;
    if (USE_RTT && parentHasRenderTexture === true && framebufferDimensions) {
      // Force pixel ratio to 1.0 for render textures since they are always 1:1
      // the final render texture will be rendered to the screen with the correct pixel ratio
      pixelRatio = 1.0;
      // Set resolution to the framebuffer dimensions
      resolutionW = framebufferDimensions.w;
      resolutionH = framebufferDimensions.h;
    } else {
      pixelRatio = renderOp.stage.pixelRatio;
      resolutionW = this.glw.canvasW;
      resolutionH = this.glw.canvasH;
    }

    if (pixelRatio !== this.lastPixelRatio) {
      this.glw.uniform1f('u_pixelRatio', pixelRatio);
      this.lastPixelRatio = pixelRatio;
    }

    if (
      resolutionW !== this.lastResolutionW ||
      resolutionH !== this.lastResolutionH
    ) {
      this.glw.uniform2f('u_resolution', resolutionW, resolutionH);
      this.lastResolutionW = resolutionW;
      this.lastResolutionH = resolutionH;
    }

    if (this.useTimeValue === true && renderOp.time !== this.lastTime) {
      this.glw.uniform1f('u_time', renderOp.time);
      this.lastTime = renderOp.time;
    }

    if (
      this.useSystemAlpha === true &&
      renderOp.worldAlpha !== this.lastAlpha
    ) {
      this.glw.uniform1f('u_alpha', renderOp.worldAlpha);
      this.lastAlpha = renderOp.worldAlpha;
    }

    if (
      this.useSystemDimensions === true &&
      (renderOp.w !== this.lastDimensionsW ||
        renderOp.h !== this.lastDimensionsH)
    ) {
      this.glw.uniform2f('u_dimensions', renderOp.w, renderOp.h);
      this.lastDimensionsW = renderOp.w;
      this.lastDimensionsH = renderOp.h;
    }

    const shader = renderOp.shader as WebGlShaderNode;
    if (shader.props !== undefined) {
      /**
       * loop over all precalculated uniform types
       *
       * Collections are immutable after being filled and shared by reference
       * across shader nodes with equal value keys, so when the same object is
       * already bound the GL program still holds exactly these values and the
       * whole pass (loops + gl calls) can be skipped.
       */
      const uniforms = shader.uniforms;
      if ((uniforms as unknown) === this.lastBoundUniforms) {
        return;
      }
      this.lastBoundUniforms = uniforms;

      for (const key in uniforms.single) {
        const { method, value } = uniforms.single[key]!;
        this.glw[method as keyof UniformSet1Param](key, value as never);
      }

      for (const key in uniforms.vec2) {
        const { method, value } = uniforms.vec2[key]!;
        this.glw[method as keyof UniformSet2Params](key, value[0], value[1]);
      }

      for (const key in uniforms.vec3) {
        const { method, value } = uniforms.vec3[key]!;
        this.glw[method as keyof UniformSet3Params](
          key,
          value[0],
          value[1],
          value[2],
        );
      }

      for (const key in uniforms.vec4) {
        const { method, value } = uniforms.vec4[key]!;
        this.glw[method as keyof UniformSet4Params](
          key,
          value[0],
          value[1],
          value[2],
          value[3],
        );
      }
    }
  }

  bindBufferCollection(buffer: BufferCollection) {
    const { glw } = this;

    if (glw.canUseVertexArrayObject === true) {
      let vao = this.vaos.get(buffer);
      if (vao === undefined) {
        // First draw with this collection: try to capture the attribute layout
        // in a VAO. Cache the result — including a null on allocation failure,
        // so we don't retry createVertexArray every frame.
        vao = this.createVao(buffer);
        this.vaos.set(buffer, vao);
      }
      if (vao !== null) {
        // createVao leaves a freshly built VAO bound; re-binding is cheap and
        // keeps the build and reuse paths identical.
        glw.bindVertexArray(vao);
        return;
      }
      // VAO allocation failed (e.g. under GL OOM). Bind the default VAO so the
      // per-draw attribute setup below records into it rather than corrupting
      // another program's cached VAO, then fall through.
      glw.bindVertexArray(null);
    }

    // No (usable) VAO: re-point every attribute on each draw.
    this.bindAttributes(buffer);
  }

  /**
   * Point this program's vertex attributes at the given buffer collection.
   * When a VAO is bound this records into it; otherwise it mutates global state.
   */
  private bindAttributes(buffer: BufferCollection) {
    const { glw } = this;
    const attribs = this.attributeLocations;
    const attribLen = attribs.length;

    for (let i = 0; i < attribLen; i++) {
      const name = attribs[i]!;
      const resolvedBuffer = buffer.getBuffer(name);
      const resolvedInfo = buffer.getAttributeInfo(name);
      if (resolvedBuffer === undefined || resolvedInfo === undefined) {
        continue;
      }
      glw.enableVertexAttribArray(i);
      glw.vertexAttribPointer(
        resolvedBuffer,
        i,
        resolvedInfo.size,
        resolvedInfo.type,
        resolvedInfo.normalized,
        resolvedInfo.stride,
        resolvedInfo.offset,
      );
    }
  }

  /**
   * Create and populate a Vertex Array Object capturing this program's
   * attribute layout for the given buffer collection. The new VAO is left bound.
   * Returns null if the context reports VAO support but allocation fails (e.g.
   * under GL OOM), in which case the caller falls back to per-draw binding.
   */
  private createVao(buffer: BufferCollection): WebGLVertexArrayObject | null {
    const { glw } = this;
    const vao = glw.createVertexArray();
    if (vao === null) {
      return null;
    }
    glw.bindVertexArray(vao);

    this.bindAttributes(buffer);

    // The element-array binding is part of VAO state and starts out null on a
    // fresh VAO, so record the shared index buffer into it or indexed
    // drawElements would read from no buffer.
    glw.bindElementArrayBuffer(this.renderer.indexBuffer);

    return vao;
  }

  bindTextures(textures: WebGlCtxTexture[]) {
    const t = textures[0];
    if (t === undefined) {
      return;
    }
    this.glw.activeTexture(0);
    this.glw.bindTexture(t.ctxTexture);
  }

  attach(): void {
    if (this.isDestroyed === true) {
      return;
    }
    this.glw.useProgram(this.program, this.uniformLocations!);
  }

  detach(): void {
    // With VAOs the enabled-attribute state lives in each per-collection VAO,
    // not in global context state. Disabling here would mutate whichever VAO is
    // currently bound and corrupt it for the next draw, so there's nothing to
    // do on a program switch.
    if (this.glw.canUseVertexArrayObject === true) {
      return;
    }
    this.disableAttributes();
  }

  destroy() {
    if (this.isDestroyed === true) {
      return;
    }
    const glw = this.glw;

    this.detach();

    for (const vao of this.vaos.values()) {
      if (vao !== null) {
        glw.deleteVertexArray(vao);
      }
    }
    this.vaos.clear();

    glw.deleteProgram(this.program!);
    this.program = null;
    this.uniformLocations = null;

    const attribs = this.attributeLocations;
    const attribLen = this.attributeLocations.length;
    for (let i = 0; i < attribLen; i++) {
      this.glw.deleteBuffer(attribs[i]!);
    }
  }
}
