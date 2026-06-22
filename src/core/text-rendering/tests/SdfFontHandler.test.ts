import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadFont, waitingForFont, isFontLoaded } from '../SdfFontHandler.js';
import { EventEmitter } from '../../../common/EventEmitter.js';
import { TextureError, TextureErrorCode } from '../../TextureError.js';
import type { Stage } from '../../Stage.js';

// Minimal XHR stand-in: synchronously delivers valid SDF font JSON so loadFont
// proceeds to create the atlas texture and attach its event listeners.
class FakeXHR {
  status = 200;
  response: unknown = null;
  responseType = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  open(): void {}
  send(): void {
    // Enough shape for processFontData to run on the success path without
    // throwing: a chars array, an (empty) kernings array, and metrics so it
    // skips the atlas-derived cap/x-height branches.
    this.response = {
      chars: [{}],
      kernings: [],
      lightningMetrics: {
        ascender: 800,
        descender: -200,
        lineGap: 200,
        unitsPerEm: 1000,
      },
    };
    if (this.onload !== null) {
      this.onload();
    }
  }
}

// A texture is just an EventEmitter to loadFont; stub the few props it reads.
function makeFakeTexture() {
  const tex = new EventEmitter() as unknown as EventEmitter & {
    state: string;
    preventCleanup: boolean;
    setRenderableOwner: (owner: string, val: boolean) => void;
  };
  tex.state = 'loading'; // not 'loaded' -> goes through the listener path
  tex.preventCleanup = false;
  tex.setRenderableOwner = () => {};
  return tex;
}

// Drain microtasks + one macrotask so the async loader reaches listener setup.
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe('SdfFontHandler loadFont — failed event argument', () => {
  let errSpy: ReturnType<typeof vi.spyOn>;
  let originalXHR: unknown;

  beforeEach(() => {
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    originalXHR = (globalThis as unknown as { XMLHttpRequest: unknown })
      .XMLHttpRequest;
    (globalThis as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest =
      FakeXHR;
  });

  afterEach(() => {
    errSpy.mockRestore();
    (globalThis as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest =
      originalXHR;
  });

  it('rejects with the TextureError (second emit arg), not the emitting texture', async () => {
    const tex = makeFakeTexture();
    const stage = {
      txManager: { createTexture: () => tex },
    } as unknown as Stage;

    const promise = loadFont(stage, {
      fontFamily: 'TestSdfFailFont',
      atlasUrl: 'atlas.png',
      atlasDataUrl: 'atlas.json',
    } as Parameters<typeof loadFont>[1]);

    await flush();

    const error = new TextureError(
      TextureErrorCode.TEXTURE_UPLOAD_FAILED,
      'boom',
    );

    // Attach the rejection assertion before emitting so the handler is ready.
    const assertion = expect(promise).rejects.toBe(error);

    // EventEmitter calls listeners as (target, data) -> (tex, error).
    tex.emit('failed', error);

    await assertion;
  });

  it('logs the error, not the texture, on failure', async () => {
    const tex = makeFakeTexture();
    const stage = {
      txManager: { createTexture: () => tex },
    } as unknown as Stage;

    const promise = loadFont(stage, {
      fontFamily: 'TestSdfFailFontLog',
      atlasUrl: 'atlas.png',
      atlasDataUrl: 'atlas.json',
    } as Parameters<typeof loadFont>[1]);

    await flush();

    const error = new TextureError(
      TextureErrorCode.TEXTURE_UPLOAD_FAILED,
      'boom',
    );
    const rejected = promise.catch(() => {});
    tex.emit('failed', error);
    await rejected;

    const lastCall = errSpy.mock.calls[errSpy.mock.calls.length - 1]!;
    expect(lastCall[1]).toBe(error);
    expect(lastCall[1]).not.toBe(tex);
  });
});

describe('SdfFontHandler loadFont — retry after a failed load', () => {
  let errSpy: ReturnType<typeof vi.spyOn>;
  let originalXHR: unknown;

  beforeEach(() => {
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    originalXHR = (globalThis as unknown as { XMLHttpRequest: unknown })
      .XMLHttpRequest;
    (globalThis as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest =
      FakeXHR;
  });

  afterEach(() => {
    errSpy.mockRestore();
    (globalThis as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest =
      originalXHR;
  });

  it('preserves nodes parked before the failure so a successful retry wakes them', async () => {
    // Hand out a fresh texture per loadFont call so the first can fail and the
    // second can succeed independently.
    const textures: ReturnType<typeof makeFakeTexture>[] = [];
    const stage = {
      txManager: {
        createTexture: () => {
          const t = makeFakeTexture();
          textures.push(t);
          return t;
        },
      },
    } as unknown as Stage;

    const fontFamily = 'RetrySdfFont';
    const opts = {
      fontFamily,
      atlasUrl: 'atlas.png',
      atlasDataUrl: 'atlas.json',
    } as Parameters<typeof loadFont>[1];

    // First attempt: park a node waiting on the font, then fail the atlas.
    const first = loadFont(stage, opts);
    await flush();

    const node = { id: 1, setUpdateType: vi.fn() };
    waitingForFont(
      fontFamily,
      node as unknown as Parameters<typeof waitingForFont>[1],
    );

    const firstRejected = first.catch(() => {});
    textures[0]!.emit(
      'failed',
      new TextureError(TextureErrorCode.TEXTURE_UPLOAD_FAILED, 'boom'),
    );
    await firstRejected;

    expect(isFontLoaded(fontFamily)).toBe(false);
    expect(node.setUpdateType).not.toHaveBeenCalled();

    // Retry: reuses the existing waiter list, then succeeds.
    const second = loadFont(stage, opts);
    await flush();

    textures[1]!.emit('loaded');
    await second;

    expect(isFontLoaded(fontFamily)).toBe(true);
    // The node parked before the failed attempt was not stranded.
    expect(node.setUpdateType).toHaveBeenCalledTimes(1);
  });
});
