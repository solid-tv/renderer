/**
 * Tests for WebGL context-loss handling on the Stage.
 *
 * Covers the pragmatic core support added for low-RAM devices (Chromium 123+
 * drops the GPU context when backgrounded). On loss we pause the render loop
 * and emit events so consumers can react; we do NOT auto-rebuild GL resources.
 */
import { describe, expect, it, vi } from 'vitest';
import { Stage } from './Stage.js';
import { EventEmitter } from '../common/EventEmitter.js';

// Build a minimal Stage-like object that exercises the context-loss methods
// without standing up the full GL-backed constructor.
function makeStage() {
  const eventBus = new EventEmitter();
  const requestRender = vi.fn();
  const stage = Object.create(Stage.prototype) as Stage;
  (stage as unknown as { eventBus: EventEmitter }).eventBus = eventBus;
  (stage as unknown as { requestRender: () => void }).requestRender =
    requestRender;
  stage.isContextLost = false;
  return { stage, eventBus, requestRender };
}

describe('Stage.setContextLost', () => {
  it('sets the flag and emits contextLost', () => {
    const { stage, eventBus } = makeStage();
    const onLost = vi.fn();
    eventBus.on('contextLost', onLost);

    stage.setContextLost();

    expect(stage.isContextLost).toBe(true);
    expect(onLost).toHaveBeenCalledTimes(1);
  });

  it('is idempotent — does not re-emit when already lost', () => {
    const { stage, eventBus } = makeStage();
    const onLost = vi.fn();
    eventBus.on('contextLost', onLost);

    stage.setContextLost();
    stage.setContextLost();

    expect(onLost).toHaveBeenCalledTimes(1);
  });
});

describe('Stage.setContextRestored', () => {
  it('clears the flag, requests a render, and emits contextRestored', () => {
    const { stage, eventBus, requestRender } = makeStage();
    const onRestored = vi.fn();
    eventBus.on('contextRestored', onRestored);

    stage.setContextLost();
    stage.setContextRestored();

    expect(stage.isContextLost).toBe(false);
    expect(requestRender).toHaveBeenCalledTimes(1);
    expect(onRestored).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when the context was never lost', () => {
    const { stage, eventBus, requestRender } = makeStage();
    const onRestored = vi.fn();
    eventBus.on('contextRestored', onRestored);

    stage.setContextRestored();

    expect(stage.isContextLost).toBe(false);
    expect(requestRender).not.toHaveBeenCalled();
    expect(onRestored).not.toHaveBeenCalled();
  });
});
