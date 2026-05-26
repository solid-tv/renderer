import { assertTruthy } from '../../utils.js';
import { type TextureData } from '../textures/Texture.js';
import { isBase64Image } from './utils.js';

/**
 * Tests if the given location is a SVG
 * @param url
 * @remarks
 * This function is used to determine if the given image url is a SVG
 * image
 * @returns
 */
export function isSvgImage(url: string): boolean {
  return /\.(svg)(\?.*)?$/.test(url);
}

/**
 * Loads a SVG image and rasterizes it for use as a texture.
 *
 * @remarks
 * Rasterizes at `pixelRatio` to keep the texture sharp on HiDPI / 4K displays.
 * `width`/`height` are interpreted as the logical (CSS-pixel) target size; the
 * backing canvas is allocated at `width * pixelRatio` × `height * pixelRatio`.
 *
 * When `sw`/`sh` are provided they describe a source-region crop on the SVG
 * (not a crop of the destination canvas) and are sampled via the 9-arg form of
 * drawImage.
 *
 * Returns an `ImageBitmap` when available (zero CPU readback, transferable),
 * falling back to `ImageData` on older browsers without `createImageBitmap`.
 */
export const loadSvg = async (
  url: string,
  width: number | null,
  height: number | null,
  sx: number | null,
  sy: number | null,
  sw: number | null,
  sh: number | null,
  pixelRatio: number,
): Promise<TextureData> => {
  const img = new Image();
  if (isBase64Image(url) === false) {
    img.crossOrigin = 'anonymous';
  }

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = (err) => {
      reject(
        err instanceof Error ? err : new Error(`SVG loading failed: ${url}`),
      );
    };
    img.src = url;
  });

  // Target size precedence: explicit w/h on the texture, then the source
  // crop dims (so a node that only sets srcWidth/srcHeight gets a texture
  // sized to the crop, matching pre-fix behavior), then the SVG's intrinsic
  // dimensions.
  const targetW = width || sw || img.naturalWidth || img.width;
  const targetH = height || sh || img.naturalHeight || img.height;
  // Clamp the DPR multiplier so a sub-1 stage pixelRatio (e.g. an app
  // rendering at 720p inside a 1080p design grid) doesn't downscale the
  // raster below the requested size. HiDPI upscaling still applies.
  const ratio = pixelRatio > 1 ? pixelRatio : 1;
  const physW = Math.max(1, Math.ceil(targetW * ratio));
  const physH = Math.max(1, Math.ceil(targetH * ratio));

  const canvas = document.createElement('canvas');
  canvas.width = physW;
  canvas.height = physH;
  const ctx = canvas.getContext('2d');
  assertTruthy(ctx);

  if (sw !== null && sh !== null) {
    ctx.drawImage(img, sx ?? 0, sy ?? 0, sw, sh, 0, 0, physW, physH);
  } else {
    ctx.drawImage(img, 0, 0, physW, physH);
  }

  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(canvas);
      return {
        data: bitmap,
        premultiplyAlpha: false,
      };
    } catch {
      // fall through to ImageData
    }
  }

  return {
    data: ctx.getImageData(0, 0, physW, physH),
    premultiplyAlpha: false,
  };
};
