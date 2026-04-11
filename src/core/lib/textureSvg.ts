import { assertTruthy } from '../../utils.js';
import { type TextureData } from '../textures/Texture.js';

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
 * Loads a SVG image
 * @param url
 * @returns
 */
export const loadSvg = (
  url: string,
  width: number | null,
  height: number | null,
  sx: number | null,
  sy: number | null,
  sw: number | null,
  sh: number | null,
): Promise<TextureData> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    assertTruthy(ctx);

    ctx.imageSmoothingEnabled = true;
    const img = new Image();
    img.onload = () => {
      const x = sx ?? 0;
      const y = sy ?? 0;
      const w = width || img.width;
      const h = height || img.height;

      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);

      resolve({
        data: ctx.getImageData(x, y, sw ?? w, sh ?? h),
        premultiplyAlpha: false,
      });
    };

    img.onerror = (err) => {
      reject(err);
    };

    img.src = url;
  });
};
