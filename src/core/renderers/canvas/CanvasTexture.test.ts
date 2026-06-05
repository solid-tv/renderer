import { describe, expect, it } from 'vitest';
import { CanvasTexture } from './CanvasTexture.js';

describe('CanvasTexture.load', () => {
  it('fails gracefully when textureData.data is null', async () => {
    const textureSource = {
      textureData: { data: null },
      state: 'initial',
      dimensions: null,
      setState(nextState: string) {
        this.state = nextState;
      },
      freeTextureData() {
        // no-op
      },
    } as any;

    const memManager = {
      setTextureMemUse() {
        // no-op
      },
    } as any;

    const ctxTexture = new CanvasTexture(memManager, textureSource);

    await expect(ctxTexture.load()).rejects.toThrow(
      'CanvasTexture: Texture data is null',
    );
    expect(textureSource.state).toBe('failed');
  });
});
