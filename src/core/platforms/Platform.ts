import { type Stage } from '../Stage.js';

export abstract class Platform {
  /**
   * Creates a new canvas element.
   * @returns The created HTMLCanvasElement.
   */
  abstract createCanvas(): HTMLCanvasElement;

  /**
   * Get a DOM element by ID
   * @returns The DOM element (or null)
   */
  abstract getElementById(id: string): HTMLElement | null;

  /**
   * Starts the main rendering loop, calling the provided update function every frame.
   * @param Stage - The stage for rendering
   */
  abstract startLoop(stage: Stage): void;

  /**
   * Abstracted createImageBitmap method.
   * @param blob - The image source to create the ImageBitmap from.
   * @param sxOrOptions - The source rectangle x coordinate or ImageBitmapOptions.
   * @param sy - The source rectangle y coordinate.
   * @param sw - The source rectangle width.
   * @param sh - The source rectangle height.
   * @param options - The ImageBitmapOptions.
   * @returns A promise that resolves with the created ImageBitmap.
   */
  abstract createImageBitmap(blob: ImageBitmapSource): Promise<ImageBitmap>;
  abstract createImageBitmap(
    blob: ImageBitmapSource,
    options: ImageBitmapOptions,
  ): Promise<ImageBitmap>;
  abstract createImageBitmap(
    blob: ImageBitmapSource,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
  ): Promise<ImageBitmap>;
  abstract createImageBitmap(
    blob: ImageBitmapSource,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    options: ImageBitmapOptions,
  ): Promise<ImageBitmap>;

  /**
   * Retrieves the current timestamp.
   * @returns The current timestamp.
   */
  abstract getTimeStamp(): number;

  /**
   * Adds a FontFace to the platforms FontFaceSet
   * @param font - The FontFace to add
   */
  abstract addFont(font: FontFace): void;
}
