import type { TextureMemoryManager } from '../TextureMemoryManager.js';
import type { Texture } from '../textures/Texture.js';

export abstract class CoreContextTexture {
  readonly textureSource: Texture;
  private memManager: TextureMemoryManager;
  public state: 'freed' | 'loading' | 'loaded' | 'failed' = 'freed';

  constructor(memManager: TextureMemoryManager, textureSource: Texture) {
    this.memManager = memManager;
    this.textureSource = textureSource;
  }

  protected setTextureMemUse(byteSize: number): void {
    this.memManager.setTextureMemUse(this.textureSource, byteSize);
  }

  abstract load(): Promise<void>;
  abstract release(): void;
  abstract free(): void;

  get renderable(): boolean {
    return this.textureSource.renderable;
  }
}
