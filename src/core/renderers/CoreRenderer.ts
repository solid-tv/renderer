import type { CoreNode } from '../CoreNode.js';
import type { Stage } from '../Stage.js';
import type { ContextSpy } from '../lib/ContextSpy.js';
import type { CoreShaderProgram } from './CoreShaderProgram.js';
import type { Texture, TextureCoords } from '../textures/Texture.js';
import { CoreContextTexture } from './CoreContextTexture.js';
import type { CoreShaderType, CoreShaderNode } from './CoreShaderNode.js';

export interface CoreRendererOptions {
  stage: Stage;
  canvas: HTMLCanvasElement | OffscreenCanvas;
  contextSpy: ContextSpy | null;
  forceWebGL2: boolean;
}

export interface BufferInfo {
  totalUsed: number;
  totalAvailable: number;
}

export abstract class CoreRenderer {
  public options: CoreRendererOptions;
  public mode: 'webgl' | 'canvas' | undefined;
  defaultTextureCoords: TextureCoords | undefined = undefined;
  readonly stage: Stage;

  //// Core Managers
  rttNodes: CoreNode[] = [];

  constructor(options: CoreRendererOptions) {
    this.options = options;
    this.stage = options.stage;
  }

  abstract reset(): void;
  abstract render(surface?: 'screen' | CoreContextTexture): void;
  abstract addQuad(node: CoreNode): void;
  abstract createCtxTexture(textureSource: Texture): CoreContextTexture;
  abstract createShaderProgram(
    shaderConfig: Readonly<CoreShaderType>,
    props?: Record<string, unknown>,
  ): CoreShaderProgram | null;
  abstract createShaderNode(
    shaderKey: string,
    shaderType: Readonly<CoreShaderType>,
    props?: Record<string, unknown>,
    program?: CoreShaderProgram,
  ): CoreShaderNode;
  abstract supportsShaderType(shaderType: Readonly<CoreShaderType>): boolean;
  abstract getDefaultShaderNode(): CoreShaderNode | null;
  abstract get renderToTextureActive(): boolean;
  abstract get activeRttNode(): CoreNode | null;
  abstract renderRTTNodes(): void;
  abstract removeRTTNode(node: CoreNode): void;
  abstract renderToTexture(node: CoreNode): void;
  abstract getBufferInfo(): BufferInfo | null;
  abstract getQuadCount(): number | null;
  abstract getRenderOpCount(): number | null;
  abstract updateViewport(): void;
  abstract updateClearColor(color: number): void;
  getTextureCoords?(node: CoreNode): TextureCoords | undefined;

  /**
   * Optional hook called when the render list changes structurally
   * (node added / removed / reordered). Implementations may use this to
   * invalidate any cached GPU buffer layouts and force a full re-upload
   * on the next render call.
   */
  invalidateQuadBuffer?(): void;
}
