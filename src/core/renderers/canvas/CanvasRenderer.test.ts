import { describe, expect, it, vi } from 'vitest';
import { CanvasRenderer } from './CanvasRenderer.js';
import { TextureType } from '../../textures/Texture.js';

describe('CanvasRenderer.renderContext', () => {
  it('skips drawing when canvas texture image is undefined', () => {
    const drawImage = vi.fn();

    const renderer = Object.create(CanvasRenderer.prototype) as CanvasRenderer;
    (renderer as any).context = {
      drawImage,
      globalAlpha: 1,
    };

    const node = {
      premultipliedColorTl: 0xffffffff,
      globalTransform: { tx: 10, ty: 20 },
      props: { w: 100, h: 50 },
      worldAlpha: 1,
      textureCoords: { x1: 0, y1: 0, x2: 1, y2: 1 },
    } as any;

    const texture = {
      type: TextureType.image,
      ctxTexture: {
        getImage: () => undefined,
      },
    } as any;

    expect(() => renderer.renderContext(node, texture)).not.toThrow();
    expect(drawImage).not.toHaveBeenCalled();
    expect((renderer as any).context.globalAlpha).toBe(1);
  });
});

describe('CanvasRenderer.addQuad transform detection', () => {
  const makeRenderer = () => {
    const renderer = Object.create(CanvasRenderer.prototype) as CanvasRenderer;
    const context = {
      save: vi.fn(),
      restore: vi.fn(),
      setTransform: vi.fn(),
      scale: vi.fn(),
      translate: vi.fn(),
      fillRect: vi.fn(),
      clip: vi.fn(),
      fillStyle: '',
      globalAlpha: 1,
    };
    (renderer as any).context = context;
    (renderer as any).pixelRatio = 1;
    (renderer as any).stage = { defaultTexture: null };
    return { renderer, context };
  };

  const makeColorNode = (transform: {
    tx: number;
    ty: number;
    ta: number;
    tb: number;
    tc: number;
    td: number;
  }) =>
    ({
      globalTransform: transform,
      clippingRect: { valid: false, x: 0, y: 0, w: 0, h: 0 },
      placeholderActive: false,
      premultipliedColorTl: 0xff0000ff,
      premultipliedColorTr: 0xff0000ff,
      premultipliedColorBr: 0xff0000ff,
      worldAlpha: 1,
      props: {
        texture: { type: TextureType.color },
        shader: null,
        w: 100,
        h: 50,
      },
    } as any);

  it('applies the transform for a scaleY-only transform (td !== 1)', () => {
    const { renderer, context } = makeRenderer();
    const node = makeColorNode({ tx: 5, ty: 10, ta: 1, tb: 0, tc: 0, td: 2 });

    renderer.addQuad(node);

    expect(context.setTransform).toHaveBeenCalledWith(1, 0, 0, 2, 5, 10);
    expect(context.save).toHaveBeenCalledTimes(1);
    expect(context.restore).toHaveBeenCalledTimes(1);
  });

  it('applies the transform for a rotation-only transform (tb/tc !== 0)', () => {
    const { renderer, context } = makeRenderer();
    const node = makeColorNode({ tx: 0, ty: 0, ta: 1, tb: -1, tc: 1, td: 1 });

    renderer.addQuad(node);

    expect(context.setTransform).toHaveBeenCalledWith(1, 1, -1, 1, 0, 0);
  });

  it('skips the transform for an identity transform', () => {
    const { renderer, context } = makeRenderer();
    const node = makeColorNode({ tx: 5, ty: 10, ta: 1, tb: 0, tc: 0, td: 1 });

    renderer.addQuad(node);

    expect(context.setTransform).not.toHaveBeenCalled();
    expect(context.save).not.toHaveBeenCalled();
    expect(context.fillRect).toHaveBeenCalledWith(5, 10, 100, 50);
  });
});

describe('CanvasRenderer.reset', () => {
  const makeRenderer = (clearColorAlpha: number) => {
    const renderer = Object.create(CanvasRenderer.prototype) as CanvasRenderer;
    const context = {
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      scale: vi.fn(),
      fillStyle: '',
    };
    let widthWrites = 0;
    const canvas = {
      height: 100,
      get width() {
        return 200;
      },
      set width(_v: number) {
        widthWrites++;
      },
    };
    (renderer as any).context = context;
    (renderer as any).canvas = canvas;
    (renderer as any).pixelRatio = 2;
    (renderer as any).clearColor = 'rgba(0,0,0,0)';
    (renderer as any).clearColorAlpha = clearColorAlpha;
    return { renderer, context, getWidthWrites: () => widthWrites };
  };

  it('clears via setTransform + clearRect without reallocating the canvas', () => {
    const { renderer, context, getWidthWrites } = makeRenderer(0);

    renderer.reset();

    expect(getWidthWrites()).toBe(0);
    expect(context.setTransform).toHaveBeenCalledWith(1, 0, 0, 1, 0, 0);
    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 200, 100);
    expect(context.scale).toHaveBeenCalledWith(2, 2);
  });

  it('skips the clear-color fill when the clear color is fully transparent', () => {
    const { renderer, context } = makeRenderer(0);

    renderer.reset();

    expect(context.fillRect).not.toHaveBeenCalled();
  });

  it('fills with the clear color when its alpha is non-zero', () => {
    const { renderer, context } = makeRenderer(0xff);
    (renderer as any).clearColor = 'rgba(16,32,48,1)';

    renderer.reset();

    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 200, 100);
    expect(context.fillStyle).toBe('rgba(16,32,48,1)');
  });

  it('updateClearColor keeps the alpha skip in sync', () => {
    const { renderer, context } = makeRenderer(0xff);

    renderer.updateClearColor(0x00000000);
    renderer.reset();

    expect(context.fillRect).not.toHaveBeenCalled();
  });
});

describe('CanvasRenderer.addQuad allocation-free paths', () => {
  const makeRenderer = () => {
    const renderer = Object.create(CanvasRenderer.prototype) as CanvasRenderer;
    const context = {
      save: vi.fn(),
      restore: vi.fn(),
      setTransform: vi.fn(),
      scale: vi.fn(),
      translate: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      fillStyle: '',
      globalAlpha: 1,
    };
    (renderer as any).context = context;
    (renderer as any).pixelRatio = 1;
    (renderer as any).stage = { defaultTexture: null };
    return { renderer, context };
  };

  const makeColorNode = (shader: unknown = null) =>
    ({
      globalTransform: { tx: 5, ty: 10, ta: 1, tb: 0, tc: 0, td: 1 },
      clippingRect: { valid: true, x: 0, y: 0, w: 300, h: 200 },
      placeholderActive: false,
      premultipliedColorTl: 0xff0000ff,
      premultipliedColorTr: 0xff0000ff,
      premultipliedColorBr: 0xff0000ff,
      worldAlpha: 1,
      props: {
        texture: { type: TextureType.color },
        shader,
        w: 100,
        h: 50,
      },
    } as any);

  it('clips with beginPath/rect/clip instead of a Path2D', () => {
    const { renderer, context } = makeRenderer();

    renderer.addQuad(makeColorNode());

    expect(context.beginPath).toHaveBeenCalledTimes(1);
    expect(context.rect).toHaveBeenCalledWith(0, 0, 300, 200);
    expect(context.clip).toHaveBeenCalledWith();
    expect(context.fillRect).toHaveBeenCalledWith(5, 10, 100, 50);
  });

  it('passes the same preallocated renderContext callback to every shader', () => {
    // Real construction (not Object.create) so class-field initializers run —
    // the preallocated callback is a field arrow function.
    const context = {
      save: vi.fn(),
      restore: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      fillStyle: '',
      globalAlpha: 1,
    };
    const renderer = new CanvasRenderer({
      stage: { pixelRatio: 1, clearColor: 0x00000000, defaultTexture: null },
      canvas: { getContext: () => context },
    } as any);
    const seen: Array<() => void> = [];
    const shader = {
      applySNR: false,
      render: vi.fn((_ctx: unknown, _node: unknown, rc: () => void) => {
        seen.push(rc);
        rc();
      }),
    };

    renderer.addQuad(makeColorNode(shader));
    renderer.addQuad(makeColorNode(shader));

    expect(seen.length).toBe(2);
    expect(seen[0]).toBe(seen[1]);
    // The callback drew each node's content when invoked
    expect(context.fillRect).toHaveBeenCalledTimes(2);
    expect(context.fillRect).toHaveBeenCalledWith(5, 10, 100, 50);
  });
});

describe('CanvasRenderer.getCapabilities', () => {
  it('reports the canvas backend with no WebGL or VAO support', () => {
    const renderer = Object.create(CanvasRenderer.prototype) as CanvasRenderer;

    expect(renderer.getCapabilities()).toEqual({
      renderMode: 'canvas',
      webGlVersion: null,
      vertexArrayObject: false,
      maxTextureSize: 0,
      maxTextureUnits: 0,
    });
  });
});
