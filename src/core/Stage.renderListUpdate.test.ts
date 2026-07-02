import { describe, it, expect, vi } from 'vitest';
import { Stage } from './Stage.js';

/**
 * Tests for the requestRenderListUpdate dedupe.
 *
 * A full Stage needs a live renderer, so the method is exercised on a minimal
 * fake via the prototype. Only the fields requestRenderListUpdate touches are
 * provided: renderer.invalidateQuadBuffer, renderListDirty, requestRender.
 */

type FakeStage = {
  renderer: { invalidateQuadBuffer?: ReturnType<typeof vi.fn> };
  renderListDirty: boolean;
  requestRender: ReturnType<typeof vi.fn>;
};

const makeStage = (hasInvalidate = true): FakeStage => ({
  renderer: hasInvalidate ? { invalidateQuadBuffer: vi.fn() } : {},
  renderListDirty: false,
  requestRender: vi.fn(),
});

const requestRenderListUpdate = (stage: FakeStage) =>
  Stage.prototype.requestRenderListUpdate.call(stage as unknown as Stage);

describe('Stage.requestRenderListUpdate dedupe', () => {
  it('invalidates the quad buffer and marks the list dirty on first call', () => {
    const stage = makeStage();

    requestRenderListUpdate(stage);

    expect(stage.renderer.invalidateQuadBuffer!.mock.calls.length).toBe(1);
    expect(stage.renderListDirty).toBe(true);
    expect(stage.requestRender.mock.calls.length).toBe(1);
  });

  it('skips repeat invalidations while a rebuild is already pending', () => {
    const stage = makeStage();

    requestRenderListUpdate(stage);
    requestRenderListUpdate(stage);
    requestRenderListUpdate(stage);

    // One structural invalidation for the whole burst (e.g. a row of cards
    // flipping renderable in the same frame), but a render is requested each
    // time so no frame is ever dropped.
    expect(stage.renderer.invalidateQuadBuffer!.mock.calls.length).toBe(1);
    expect(stage.requestRender.mock.calls.length).toBe(3);
    expect(stage.renderListDirty).toBe(true);
  });

  it('invalidates again after drawFrame clears the dirty flag', () => {
    const stage = makeStage();

    requestRenderListUpdate(stage);
    // drawFrame rebuilds the render list and clears the flag
    stage.renderListDirty = false;
    requestRenderListUpdate(stage);

    expect(stage.renderer.invalidateQuadBuffer!.mock.calls.length).toBe(2);
    expect(stage.renderListDirty).toBe(true);
  });

  it('handles renderers without invalidateQuadBuffer (canvas backend)', () => {
    const stage = makeStage(false);

    requestRenderListUpdate(stage);

    expect(stage.renderListDirty).toBe(true);
    expect(stage.requestRender.mock.calls.length).toBe(1);
  });
});
