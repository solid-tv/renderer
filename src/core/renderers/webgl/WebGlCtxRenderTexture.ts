import type { Dimensions } from '../../../common/CommonTypes.js';
import type { TextureMemoryManager } from '../../TextureMemoryManager.js';
import type { WebGlContextWrapper } from '../../lib/WebGlContextWrapper.js';
import type { Bound } from '../../lib/utils.js';
import type { RenderTexture } from '../../textures/RenderTexture.js';
import { WebGlCtxTexture } from './WebGlCtxTexture.js';

export class WebGlCtxRenderTexture extends WebGlCtxTexture {
  declare textureSource: RenderTexture;

  public framebuffer: WebGLFramebuffer | null = null;

  override txCoords: Bound = {
    x1: 0,
    y1: 1,
    x2: 1,
    y2: 0,
  };

  constructor(
    glw: WebGlContextWrapper,
    memManager: TextureMemoryManager,
    textureSource: RenderTexture,
  ) {
    super(glw, memManager, textureSource);
  }

  override async onLoadRequest(): Promise<Dimensions> {
    const { glw } = this;
    const nativeTexture = (this._nativeCtxTexture =
      this.createNativeCtxTexture());

    if (!nativeTexture) {
      throw new Error('Failed to create native texture for RenderTexture');
    }

    const { w, h } = this.textureSource;

    // Create Framebuffer object
    this.framebuffer = glw.createFramebuffer();

    // Set the dimensions of the render texture
    glw.texImage2D(0, glw.RGBA, w, h, 0, glw.RGBA, glw.UNSIGNED_BYTE, null);

    // Update the texture memory manager
    this.setTextureMemUse(w * h * 4);

    // Bind the framebuffer
    glw.bindFramebuffer(this.framebuffer);

    // Attach the texture to the framebuffer
    glw.framebufferTexture2D(glw.COLOR_ATTACHMENT0, nativeTexture, 0);

    // Unbind the framebuffer
    glw.bindFramebuffer(null);

    return {
      w,
      h,
    };
  }

  override free(): void {
    super.free();

    // Delete the framebuffer
    this.glw.deleteFramebuffer(this.framebuffer);
    this.framebuffer = null;
  }
}
