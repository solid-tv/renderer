/**
 * Tests that the render loop pauses GL work while the WebGL context is lost.
 *
 * When `stage.isContextLost === true`, `runLoop` must issue no GL-touching
 * calls and instead schedule a slow heartbeat so it resumes once the context
 * is restored.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebPlatform } from './WebPlatform.js';
import type { Stage } from '../../Stage.js';

function makeFakeStage(isContextLost: boolean) {
  return {
    isContextLost,
    targetFrameTime: 0,
    updateFrameTime: vi.fn(),
    updateAnimations: vi.fn(() => false),
    hasSceneUpdates: vi.fn(() => true),
    drawFrame: vi.fn(),
    flushFrameEvents: vi.fn(),
    calculateFps: vi.fn(),
  } as unknown as Stage;
}

describe('WebPlatform render loop context-loss guard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('skips all GL work and schedules a heartbeat while context is lost', () => {
    let capturedLoop: ((t?: number) => void) | null = null;
    const raf = vi.fn((cb: (t?: number) => void) => {
      capturedLoop = cb;
      return 1;
    });
    const setTimeoutSpy = vi.fn(
      (_cb: () => void, _ms?: number) =>
        1 as unknown as ReturnType<typeof setTimeout>,
    );
    vi.stubGlobal('requestAnimationFrame', raf);
    vi.stubGlobal('setTimeout', setTimeoutSpy);

    const stage = makeFakeStage(true);
    new WebPlatform().startLoop(stage);

    // startLoop kicks off the first frame via requestAnimationFrame
    expect(capturedLoop).not.toBeNull();

    // Run one iteration with the context lost
    capturedLoop!(0);

    // No GL-touching frame work happened
    expect(stage.updateFrameTime).not.toHaveBeenCalled();
    expect(stage.drawFrame).not.toHaveBeenCalled();
    expect(stage.hasSceneUpdates).not.toHaveBeenCalled();

    // A heartbeat was scheduled so the loop can resume after restore
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy.mock.calls[0]![1]).toBe(1000);
  });

  it('runs frame work when the context is healthy', () => {
    let capturedLoop: ((t?: number) => void) | null = null;
    const raf = vi.fn((cb: (t?: number) => void) => {
      capturedLoop = cb;
      return 1;
    });
    vi.stubGlobal('requestAnimationFrame', raf);

    const stage = makeFakeStage(false);
    new WebPlatform().startLoop(stage);

    capturedLoop!(0);

    expect(stage.updateFrameTime).toHaveBeenCalledTimes(1);
    expect(stage.drawFrame).toHaveBeenCalledTimes(1);
  });
});
