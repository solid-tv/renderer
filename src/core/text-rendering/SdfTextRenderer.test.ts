import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CoreTextNodeProps } from '../CoreTextNode.js';

// Mock the font handler so renderText/generateTextLayout can run without a
// real loaded font. getFontData is only invoked on a layout-cache MISS, so the
// call count is our probe for cache hits vs misses.
vi.mock('./SdfFontHandler.js', () => {
  const fontData = {
    data: {
      common: { base: 0, scaleW: 512, scaleH: 512, lineHeight: 50 },
      info: { size: 42 },
      distanceField: { distanceRange: 4 },
    },
    glyphMap: new Map(),
    kernings: {},
    atlasTexture: {},
    metrics: {},
    maxCharHeight: 50,
  };
  const metrics = {
    ascender: 40,
    descender: -10,
    lineGap: 0,
    capHeight: 30,
    xHeight: 20,
  };
  return {
    type: 'sdf',
    init: vi.fn(),
    getFontData: vi.fn(() => fontData),
    getFontMetrics: vi.fn(() => metrics),
    measureText: vi.fn((text: string) => text.length * 10),
    getAtlas: vi.fn(() => null),
  };
});

import SdfTextRenderer from './SdfTextRenderer.js';
import * as SdfFontHandler from './SdfFontHandler.js';

const makeProps = (text: string): CoreTextNodeProps =>
  ({
    text,
    fontFamily: 'Test',
    fontStyle: 'normal',
    fontSize: 42,
    letterSpacing: 0,
    lineHeight: 0,
    maxHeight: 0,
    maxWidth: 100000,
    maxLines: 0,
    textAlign: 'left',
    wordBreak: 'normal',
    overflowSuffix: '',
  } as unknown as CoreTextNodeProps);

const initRenderer = (cacheSize: number): void => {
  const fakeStage = {
    options: { textLayoutCacheSize: cacheSize },
    shManager: {
      registerShaderType: vi.fn(),
      createShader: vi.fn(() => ({})),
    },
  };
  SdfTextRenderer.init(fakeStage as never);
};

const render = (text: string): void => {
  SdfTextRenderer.renderText(makeProps(text));
};

describe('SdfTextRenderer layout cache', () => {
  beforeEach(() => {
    // Empty the module-level cache between tests, then reset call counts.
    initRenderer(0);
    SdfTextRenderer.cleanup();
    vi.clearAllMocks();
  });

  it('reuses the cached layout for identical strings', () => {
    initRenderer(10);

    render('Badge');
    render('Badge');

    // Second render is a cache hit: no fresh layout generation.
    expect(SdfFontHandler.getFontData).toHaveBeenCalledTimes(1);
  });

  it('caches long strings too (no length-based skip)', () => {
    initRenderer(10);
    const long = 'x'.repeat(500);

    render(long);
    render(long);

    // Bounded purely by the LRU cap, not by length.
    expect(SdfFontHandler.getFontData).toHaveBeenCalledTimes(1);
  });

  it('eagerly bounds the cache on insert (does not wait for idle cleanup)', () => {
    // An animating scene never goes idle, so the cache must be bounded on insert
    // rather than relying solely on idle `cleanup`. With cap 2, inserting a 3rd
    // entry must immediately evict the least-recently-used (oldest) one — 'A'.
    initRenderer(2);

    render('A'); // {A}
    render('B'); // {A, B}
    render('C'); // insert -> over cap -> eagerly evict LRU 'A' -> {B, C}

    vi.clearAllMocks();
    // Probe survivors first (hits only re-order, they don't change membership),
    // then the evicted entry last so its re-insert can't perturb the assertion.
    render('C'); // survived -> hit
    render('B'); // survived -> hit
    render('A'); // evicted -> miss (one layout regen)

    expect(SdfFontHandler.getFontData).toHaveBeenCalledTimes(1);
  });

  it('cleanup is a no-op while under the cap', () => {
    initRenderer(10);

    render('one');
    render('two');

    SdfTextRenderer.cleanup();

    vi.clearAllMocks();
    render('one'); // still cached -> hit
    render('two'); // still cached -> hit

    expect(SdfFontHandler.getFontData).toHaveBeenCalledTimes(0);
  });
});

describe('SdfTextRenderer renderQuads cache dispatch', () => {
  type FakeRenderer = {
    stage: unknown;
    sdfBufferIdx: number;
    fSdfBuffer: Float32Array;
    addSdfQuads: ReturnType<typeof vi.fn>;
    addSdfCachedQuads: ReturnType<typeof vi.fn>;
    addSdfTranslatedQuads: ReturnType<typeof vi.fn>;
  };

  const GLYPHS = 2;

  const makeRenderer = (): FakeRenderer => {
    const renderer: FakeRenderer = {
      stage: {
        options: { textLayoutCacheSize: 10 },
        shManager: {
          registerShaderType: vi.fn(),
          createShader: vi.fn(() => ({})),
        },
      },
      sdfBufferIdx: 0,
      fSdfBuffer: new Float32Array(1024),
      // The miss path snapshots [startIdx, endIdx) of fSdfBuffer, so the
      // fake must advance sdfBufferIdx like the real writer does.
      addSdfQuads: vi.fn(() => {
        renderer.sdfBufferIdx += GLYPHS * 24;
      }),
      addSdfCachedQuads: vi.fn(),
      addSdfTranslatedQuads: vi.fn(),
    };
    return renderer;
  };

  const makeLayout = () => ({
    glyphs: new Float32Array(GLYPHS * 8),
    glyphCount: GLYPHS,
    fontScale: 1,
    distanceRange: 4,
    width: 100,
    height: 50,
  });

  const makeCache = () => ({
    vertices: null as Float32Array | null,
    glyphCount: 0,
    color: 0,
    alpha: -1,
    transform: new Float32Array(6),
    layoutRef: null as unknown,
  });

  const makeRenderProps = (
    cache: ReturnType<typeof makeCache>,
    transform: number[],
  ) => ({
    fontFamily: 'Test',
    fontSize: 42,
    color: 0xffffffff,
    offsetY: 0,
    worldAlpha: 1,
    globalTransform: new Float32Array(transform),
    clippingRect: { x: 0, y: 0, w: 0, h: 0, valid: false },
    width: 100,
    height: 50,
    parentHasRenderTexture: false,
    framebufferDimensions: null,
    sdfCache: cache,
  });

  const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const TRANSLATED = [1, 0, 0, 0, 1, 0, 120, -40, 1];
  const SCALED = [2, 0, 0, 0, 2, 0, 0, 0, 1];

  const renderQuads = (
    renderer: FakeRenderer,
    layout: ReturnType<typeof makeLayout>,
    renderProps: ReturnType<typeof makeRenderProps>,
  ) =>
    SdfTextRenderer.renderQuads(
      renderer as never,
      layout as never,
      null as never,
      renderProps as never,
    );

  const setupWithAtlas = () => {
    initRenderer(10);
    vi.mocked(SdfFontHandler.getAtlas).mockReturnValue({
      ctxTexture: {},
    } as never);
  };

  it('takes the miss path first and snapshots the cache', () => {
    setupWithAtlas();
    const renderer = makeRenderer();
    const layout = makeLayout();
    const cache = makeCache();

    renderQuads(renderer, layout, makeRenderProps(cache, IDENTITY));

    expect(renderer.addSdfQuads.mock.calls.length).toBe(1);
    expect(cache.vertices).not.toBeNull();
    expect(cache.layoutRef).toBe(layout);
    expect(cache.glyphCount).toBe(GLYPHS);
  });

  it('takes the mem-copy path when nothing changed', () => {
    setupWithAtlas();
    const renderer = makeRenderer();
    const layout = makeLayout();
    const cache = makeCache();

    renderQuads(renderer, layout, makeRenderProps(cache, IDENTITY));
    renderQuads(renderer, layout, makeRenderProps(cache, IDENTITY));

    expect(renderer.addSdfQuads.mock.calls.length).toBe(1);
    expect(renderer.addSdfCachedQuads.mock.calls.length).toBe(1);
    expect(renderer.addSdfTranslatedQuads.mock.calls.length).toBe(0);
  });

  it('takes the translation path when only tx/ty changed, keeping the cache base', () => {
    setupWithAtlas();
    const renderer = makeRenderer();
    const layout = makeLayout();
    const cache = makeCache();

    renderQuads(renderer, layout, makeRenderProps(cache, IDENTITY));
    const baseVertices = cache.vertices;

    renderQuads(renderer, layout, makeRenderProps(cache, TRANSLATED));

    expect(renderer.addSdfQuads.mock.calls.length).toBe(1);
    expect(renderer.addSdfCachedQuads.mock.calls.length).toBe(0);
    const calls = renderer.addSdfTranslatedQuads.mock.calls;
    expect(calls.length).toBe(1);
    // (cachedVertices, glyphCount, dx, dy, ...)
    expect(calls[0]![0]).toBe(baseVertices);
    expect(calls[0]![1]).toBe(GLYPHS);
    expect(calls[0]![2]).toBe(120);
    expect(calls[0]![3]).toBe(-40);
    // The scroll path must not re-snapshot: base transform and vertices stay
    expect(cache.vertices).toBe(baseVertices);
    expect(cache.transform[4]).toBe(0);
    expect(cache.transform[5]).toBe(0);
  });

  it('falls back to the miss path when scale or rotation changed', () => {
    setupWithAtlas();
    const renderer = makeRenderer();
    const layout = makeLayout();
    const cache = makeCache();

    renderQuads(renderer, layout, makeRenderProps(cache, IDENTITY));
    renderQuads(renderer, layout, makeRenderProps(cache, SCALED));

    expect(renderer.addSdfQuads.mock.calls.length).toBe(2);
    expect(renderer.addSdfTranslatedQuads.mock.calls.length).toBe(0);
  });

  it('falls back to the miss path when color or alpha changed', () => {
    setupWithAtlas();
    const renderer = makeRenderer();
    const layout = makeLayout();
    const cache = makeCache();

    renderQuads(renderer, layout, makeRenderProps(cache, IDENTITY));

    const faded = makeRenderProps(cache, TRANSLATED);
    faded.worldAlpha = 0.5;
    renderQuads(renderer, layout, faded);

    expect(renderer.addSdfQuads.mock.calls.length).toBe(2);
    expect(renderer.addSdfTranslatedQuads.mock.calls.length).toBe(0);
  });
});

describe('SdfTextRenderer lazy shader compile', () => {
  it('registers the SDF shader at init but defers compilation', () => {
    const shManager = {
      registerShaderType: vi.fn(),
      createShader: vi.fn(() => ({})),
    };
    const fakeStage = { options: { textLayoutCacheSize: 10 }, shManager };

    SdfTextRenderer.init(fakeStage as never);

    // Registration is cheap and stays at boot; the expensive compile + link is
    // deferred until the first SDF glyph actually renders (see getSdfShader).
    expect(shManager.registerShaderType).toHaveBeenCalledTimes(1);
    expect(shManager.createShader).not.toHaveBeenCalled();
  });
});
