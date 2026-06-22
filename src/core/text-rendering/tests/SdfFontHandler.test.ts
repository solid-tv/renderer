import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loadFont,
  waitingForFont,
  isFontLoaded,
  MAX_FONT_LOAD_RETRIES,
} from '../SdfFontHandler.js';
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

type FakeTexture = ReturnType<typeof makeFakeTexture>;

// A stage whose txManager hands out a fresh fake texture per loadFont attempt
// (so each retry has its own texture to fail/succeed) and records them.
function makeStage(): { stage: Stage; textures: FakeTexture[] } {
  const textures: FakeTexture[] = [];
  const stage = {
    txManager: {
      createTexture: () => {
        const t = makeFakeTexture();
        textures.push(t);
        return t;
      },
      // loadFont evicts a failed atlas before retrying; a no-op is enough here.
      removeTextureFromCache: () => {},
    },
  } as unknown as Stage;
  return { stage, textures };
}

const opts = (fontFamily: string) =>
  ({
    fontFamily,
    atlasUrl: 'atlas.png',
    atlasDataUrl: 'atlas.json',
  } as Parameters<typeof loadFont>[1]);

// Drain microtasks + one macrotask so the async loader reaches listener setup.
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

// Fail every attempt: each iteration waits for the next attempt to wire up its
// atlas listener, then fires 'failed' on that attempt's texture.
async function failAllAttempts(
  textures: FakeTexture[],
  error: TextureError,
  attempts: number,
): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    await flush();
    textures[i]!.emit('failed', error);
  }
}

const TOTAL_ATTEMPTS = MAX_FONT_LOAD_RETRIES + 1; // initial + retries

describe('SdfFontHandler loadFont — failure after exhausting retries', () => {
  let errSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let originalXHR: unknown;

  beforeEach(() => {
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    originalXHR = (globalThis as unknown as { XMLHttpRequest: unknown })
      .XMLHttpRequest;
    (globalThis as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest =
      FakeXHR;
  });

  afterEach(() => {
    errSpy.mockRestore();
    warnSpy.mockRestore();
    (globalThis as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest =
      originalXHR;
  });

  it('rejects with the last TextureError (second emit arg), not the emitting texture', async () => {
    const { stage, textures } = makeStage();
    const promise = loadFont(stage, opts('TestSdfFailFont'));

    const error = new TextureError(
      TextureErrorCode.TEXTURE_UPLOAD_FAILED,
      'boom',
    );

    // Attach the rejection assertion before driving failures.
    const assertion = expect(promise).rejects.toBe(error);
    await failAllAttempts(textures, error, TOTAL_ATTEMPTS);
    await assertion;
  });

  it('logs the error, not the texture, after the final attempt', async () => {
    const { stage, textures } = makeStage();
    const promise = loadFont(stage, opts('TestSdfFailFontLog'));

    const error = new TextureError(
      TextureErrorCode.TEXTURE_UPLOAD_FAILED,
      'boom',
    );
    const rejected = promise.catch(() => {});
    await failAllAttempts(textures, error, TOTAL_ATTEMPTS);
    await rejected;

    const lastCall = errSpy.mock.calls[errSpy.mock.calls.length - 1]!;
    expect(lastCall[1]).toBe(error);
    expect(lastCall[1]).not.toBe(textures[textures.length - 1]);
  });

  it('attempts the load exactly initial + MAX_FONT_LOAD_RETRIES times', async () => {
    const { stage, textures } = makeStage();
    const promise = loadFont(stage, opts('TestSdfAttemptCount'));

    const error = new TextureError(
      TextureErrorCode.TEXTURE_UPLOAD_FAILED,
      'boom',
    );
    const rejected = promise.catch(() => {});
    await failAllAttempts(textures, error, TOTAL_ATTEMPTS);
    await rejected;

    // One texture is created per attempt; no further attempts after exhaustion.
    expect(textures.length).toBe(TOTAL_ATTEMPTS);
    // A warning per retried attempt, error only on the final failure.
    expect(warnSpy).toHaveBeenCalledTimes(MAX_FONT_LOAD_RETRIES);
    expect(errSpy).toHaveBeenCalledTimes(1);
  });
});

describe('SdfFontHandler loadFont — automatic retry', () => {
  let errSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let originalXHR: unknown;

  beforeEach(() => {
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    originalXHR = (globalThis as unknown as { XMLHttpRequest: unknown })
      .XMLHttpRequest;
    (globalThis as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest =
      FakeXHR;
  });

  afterEach(() => {
    errSpy.mockRestore();
    warnSpy.mockRestore();
    (globalThis as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest =
      originalXHR;
  });

  it('recovers when a retry succeeds and wakes nodes parked before the failure', async () => {
    const { stage, textures } = makeStage();
    const fontFamily = 'RetryRecoverFont';

    const promise = loadFont(stage, opts(fontFamily));

    // Park a node while the font is loading (waiter list exists synchronously).
    const node = { id: 1, setUpdateType: vi.fn() };
    waitingForFont(
      fontFamily,
      node as unknown as Parameters<typeof waitingForFont>[1],
    );

    // First attempt fails...
    await flush();
    textures[0]!.emit(
      'failed',
      new TextureError(TextureErrorCode.TEXTURE_UPLOAD_FAILED, 'boom'),
    );

    // ...the automatic retry succeeds.
    await flush();
    textures[1]!.emit('loaded');
    await promise;

    expect(isFontLoaded(fontFamily)).toBe(true);
    expect(node.setUpdateType).toHaveBeenCalledTimes(1);
    // Only two attempts were needed.
    expect(textures.length).toBe(2);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errSpy).not.toHaveBeenCalled();
  });

  it('keeps parked nodes after every retry fails so a later loadFont still wakes them', async () => {
    const { stage, textures } = makeStage();
    const fontFamily = 'RetryExhaustReuseFont';
    const error = new TextureError(
      TextureErrorCode.TEXTURE_UPLOAD_FAILED,
      'boom',
    );

    const first = loadFont(stage, opts(fontFamily));
    const firstRejected = first.catch(() => {});

    const node = { id: 1, setUpdateType: vi.fn() };
    waitingForFont(
      fontFamily,
      node as unknown as Parameters<typeof waitingForFont>[1],
    );

    await failAllAttempts(textures, error, TOTAL_ATTEMPTS);
    await firstRejected;

    expect(isFontLoaded(fontFamily)).toBe(false);
    expect(node.setUpdateType).not.toHaveBeenCalled();

    // A fresh load reuses the still-parked node and wakes it on success.
    const second = loadFont(stage, opts(fontFamily));
    await flush();
    textures[TOTAL_ATTEMPTS]!.emit('loaded');
    await second;

    expect(isFontLoaded(fontFamily)).toBe(true);
    expect(node.setUpdateType).toHaveBeenCalledTimes(1);
  });
});
