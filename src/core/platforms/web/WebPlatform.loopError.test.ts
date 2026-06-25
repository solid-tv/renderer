/**
 * Tests the `handleLoopError` escape hatch: a synchronous throw inside a frame
 * (event subscriber, animation step, draw) must never propagate out of the
 * `requestAnimationFrame` callback and freeze the loop. By default the error is
 * swallowed and the loop keeps running; a registered handler is invoked with the
 * error and the loop still survives.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebPlatform } from './WebPlatform.js';
import type { Stage } from '../../Stage.js';

interface MakeStageOptions {
  idle?: boolean;
  handleLoopError?: (error: unknown) => void;
  throwIn?: 'drawFrame' | 'emitIdle';
  error?: unknown;
}

function makeStage(opts: MakeStageOptions = {}) {
  const idle = opts.idle ?? false;
  const error = opts.error ?? new Error('frame boom');

  const drawFrame = vi.fn(() => {
    if (opts.throwIn === 'drawFrame') {
      throw error;
    }
  });
  const emit = vi.fn(() => {
    if (opts.throwIn === 'emitIdle') {
      throw error;
    }
  });

  const stage = {
    isContextLost: false,
    targetFrameTime: 0,
    updateFrameTime: vi.fn(),
    updateAnimations: vi.fn(() => false),
    hasSceneUpdates: vi.fn(() => !idle),
    calculateFps: vi.fn(),
    drawFrame,
    flushFrameEvents: vi.fn(),
    shManager: { cleanup: vi.fn() },
    cleanupTextRenderers: vi.fn(),
    eventBus: { emit },
    txMemManager: {
      checkCleanup: vi.fn(() => false),
      cleanup: vi.fn(),
      handleOutOfMemory: vi.fn(),
    },
    renderer: { checkForOutOfMemory: vi.fn(() => false) },
    options: { handleLoopError: opts.handleLoopError },
  } as unknown as Stage;

  return { stage, drawFrame, emit };
}

describe('WebPlatform render loop — handleLoopError escape hatch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Stubs raf/setTimeout, starts the loop, and returns a `runFrame` that drives
  // exactly one frame plus the raf/setTimeout call counts so far.
  function harness(stage: Stage) {
    let capturedLoop: ((t?: number) => void) | null = null;
    const raf = vi.fn((cb: (t?: number) => void) => {
      capturedLoop = cb;
      return 1;
    });
    const timeout = vi.fn(() => 1 as unknown as ReturnType<typeof setTimeout>);
    vi.stubGlobal('requestAnimationFrame', raf);
    vi.stubGlobal('setTimeout', timeout);

    new WebPlatform().startLoop(stage);

    return {
      runFrame: () => capturedLoop!(0),
      rafCount: () => raf.mock.calls.length,
      timeoutCount: () => timeout.mock.calls.length,
    };
  }

  it('routes an active-frame error to the handler and keeps the loop alive', () => {
    const error = new Error('draw boom');
    const handleLoopError = vi.fn();
    const { stage } = makeStage({
      throwIn: 'drawFrame',
      error,
      handleLoopError,
    });

    const h = harness(stage);
    expect(h.rafCount()).toBe(1); // initial schedule from startLoop

    expect(() => h.runFrame()).not.toThrow();

    expect(handleLoopError).toHaveBeenCalledTimes(1);
    expect(handleLoopError).toHaveBeenCalledWith(error);
    expect(h.rafCount()).toBe(2); // rescheduled the next frame
  });

  it('swallows the error and keeps the loop alive when no handler is registered', () => {
    const error = new Error('draw boom');
    const { stage } = makeStage({ throwIn: 'drawFrame', error });

    const h = harness(stage);

    // Default behaviour: the error is swallowed, never propagated, and the loop
    // reschedules so the app does not freeze.
    expect(() => h.runFrame()).not.toThrow();
    expect(h.rafCount()).toBe(2); // rescheduled despite the error
  });

  it('does not double-schedule when an idle-path error follows the idle reschedule', () => {
    const handleLoopError = vi.fn();
    const { stage } = makeStage({
      idle: true,
      throwIn: 'emitIdle',
      handleLoopError,
    });

    const h = harness(stage);

    expect(() => h.runFrame()).not.toThrow();

    expect(handleLoopError).toHaveBeenCalledTimes(1);
    // The idle path already queued the next tick via setTimeout before the throw,
    // so the catch must NOT queue an extra rAF.
    expect(h.timeoutCount()).toBe(1);
    expect(h.rafCount()).toBe(1);
  });

  it('does not touch the handler on a clean frame and reschedules normally', () => {
    const handleLoopError = vi.fn();
    const { stage, drawFrame } = makeStage({ handleLoopError });

    const h = harness(stage);
    h.runFrame();

    expect(handleLoopError).not.toHaveBeenCalled();
    expect(drawFrame).toHaveBeenCalledTimes(1);
    expect(h.rafCount()).toBe(2);
  });
});
