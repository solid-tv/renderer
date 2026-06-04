import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TextureMemoryManager,
  type TextureMemoryManagerSettings,
} from './TextureMemoryManager.js';
import type { Stage } from './Stage.js';
import type { Texture } from './textures/Texture.js';

function makeSettings(
  overrides: Partial<TextureMemoryManagerSettings> = {},
): TextureMemoryManagerSettings {
  return {
    criticalThreshold: 200e6,
    targetThresholdLevel: 0.5,
    cleanupInterval: 5000,
    debugLogging: false,
    baselineMemoryAllocation: 26e6,
    doNotExceedCriticalThreshold: false,
    ...overrides,
  };
}

// The only Stage method the OOM path touches is queueFrameEvent.
function makeStage(): {
  stage: Stage;
  queueFrameEvent: ReturnType<typeof vi.fn>;
} {
  const queueFrameEvent = vi.fn();
  const stage = { queueFrameEvent } as unknown as Stage;
  return { stage, queueFrameEvent };
}

function makeManager(overrides: Partial<TextureMemoryManagerSettings> = {}): {
  mgr: TextureMemoryManager;
  queueFrameEvent: ReturnType<typeof vi.fn>;
} {
  const { stage, queueFrameEvent } = makeStage();
  const mgr = new TextureMemoryManager(stage, makeSettings(overrides));
  return { mgr, queueFrameEvent };
}

// setTextureMemUse expects a Texture with a mutable memUsed field; nothing else
// is read on the OOM path.
function fakeTexture(): Texture {
  return { memUsed: 0 } as unknown as Texture;
}

describe('TextureMemoryManager — out-of-memory event', () => {
  it('queues an outOfMemory frame event with the estimate and threshold', () => {
    const { mgr, queueFrameEvent } = makeManager({ criticalThreshold: 200e6 });
    // memUsed = baseline (26e6) + texture (100e6) = 126e6
    mgr.setTextureMemUse(fakeTexture(), 100e6);

    mgr.handleOutOfMemory();

    expect(queueFrameEvent).toHaveBeenCalledTimes(1);
    expect(queueFrameEvent).toHaveBeenCalledWith('outOfMemory', {
      memUsed: 126e6,
      criticalThreshold: 200e6,
    });
  });

  it('requests an immediate cleanup as a best-effort mitigation', () => {
    const { mgr } = makeManager();
    expect(mgr.criticalCleanupRequested).toBe(false);

    mgr.handleOutOfMemory();

    expect(mgr.criticalCleanupRequested).toBe(true);
  });

  it('does not change the critical threshold itself', () => {
    const { mgr } = makeManager({ criticalThreshold: 200e6 });
    const before = mgr.getMemoryInfo().criticalThreshold;

    mgr.handleOutOfMemory();

    expect(mgr.getMemoryInfo().criticalThreshold).toBe(before);
  });

  it('reports the current estimate each time it fires', () => {
    const { mgr, queueFrameEvent } = makeManager({ criticalThreshold: 200e6 });

    mgr.setTextureMemUse(fakeTexture(), 50e6);
    mgr.handleOutOfMemory();
    mgr.setTextureMemUse(fakeTexture(), 80e6);
    mgr.handleOutOfMemory();

    expect(queueFrameEvent.mock.calls[0]![1]).toEqual({
      memUsed: 76e6, // 26e6 baseline + 50e6
      criticalThreshold: 200e6,
    });
    expect(queueFrameEvent.mock.calls[1]![1]).toEqual({
      memUsed: 156e6, // 26e6 baseline + 50e6 + 80e6
      criticalThreshold: 200e6,
    });
  });
});
