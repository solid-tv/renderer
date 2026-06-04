import { describe, it, expect, vi } from 'vitest';
import { SubTexture } from './SubTexture.js';
import { ImageTexture } from './ImageTexture.js';
import type { CoreTextureManager } from '../CoreTextureManager.js';

const flushMicrotasks = () => Promise.resolve();

describe('SubTexture lifecycle', () => {
  it('detaches its parent-texture listeners on destroy', async () => {
    // 'initial' state means the constructor's microtask attaches listeners
    // without synchronously firing any of the state handlers.
    const parent = {
      state: 'initial',
      dimensions: null,
      error: null,
      on: vi.fn(),
      off: vi.fn(),
    };
    const txManager = {
      maxRetryCount: 0,
      platform: {},
      resolveParentTexture: () => parent,
    } as unknown as CoreTextureManager;

    const parentImage = new ImageTexture(txManager, {} as never);
    const sub = new SubTexture(txManager, {
      texture: parentImage,
      x: 0,
      y: 0,
      w: 10,
      h: 10,
    });

    // Listeners are attached in a microtask after construction.
    await flushMicrotasks();
    expect(parent.on).toHaveBeenCalledTimes(4);

    sub.destroy();

    const offEvents = (parent.off.mock.calls as Array<[string]>)
      .map((c) => c[0])
      .sort();
    expect(offEvents).toEqual(['failed', 'freed', 'loaded', 'loading']);
  });
});
