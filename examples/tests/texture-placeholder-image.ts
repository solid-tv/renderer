import type { INode, Texture } from '@lightningjs/renderer';
import type { ExampleSettings } from '../common/ExampleSettings.js';

import rockoPng from '../assets/rocko.png';
import lightningPng from '../assets/lightning.png';

/**
 * Visual test for `placeholderImage`: a node with a texture renders a shared,
 * pinned placeholder image (through its shader) until the texture loads.
 *
 * Deterministic states captured in the snapshot:
 * 1. Placeholder image for a permanently failed src, rounded.
 * 2. Same shared placeholder image under RoundedWithBorder.
 * 3. Placeholder image that itself 404s -> placeholderColor rect fallback.
 * 4. A loaded image with placeholderImage set — the image shows.
 * 5. Control: failed src + failed placeholder + no color renders nothing.
 */

const MISSING_SRC = '/does-not-exist-placeholder-test.png';
const MISSING_PLACEHOLDER = '/does-not-exist-placeholder-image.png';

function waitForNodeEvent(
  node: INode,
  event: 'loaded' | 'failed',
  timeoutMs: number,
): Promise<boolean> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), timeoutMs);
    node.once(event, () => {
      clearTimeout(timeout);
      resolve(true);
    });
  });
}

function waitForTextureState(
  texture: Texture,
  state: 'loaded' | 'failed',
  timeoutMs: number,
): Promise<boolean> {
  if (texture.state === state) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), timeoutMs);
    texture.once(state, () => {
      clearTimeout(timeout);
      resolve(true);
    });
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function automation(settings: ExampleSettings) {
  await test(settings);
  // The scene settled inside test() (events already awaited) — force a final
  // frame instead of waiting for an 'idle' that may have already fired.
  settings.renderer.rerender();
  await delay(100);
  await settings.snapshot();
}

export default async function test({ renderer, testRoot }: ExampleSettings) {
  renderer.createTextNode({
    fontFamily: 'Ubuntu',
    text: 'placeholderImage',
    fontSize: 30,
    color: 0xffffffff,
    x: 20,
    y: 20,
    parent: testRoot,
  });

  // Fail fast and permanently: maxRetryCount 0 = one attempt, no retries.
  const missingTexture = renderer.createTexture('ImageTexture', {
    src: MISSING_SRC,
    maxRetryCount: 0,
  });

  // 1. Placeholder image shows for a permanently failed src (rounded).
  const failedRounded = renderer.createNode({
    x: 20,
    y: 80,
    w: 200,
    h: 280,
    texture: missingTexture,
    placeholderImage: lightningPng,
    shader: renderer.createShader('Rounded', { radius: [20] }),
    parent: testRoot,
  });

  // 2. Same shared placeholder image, border shader.
  const failedBordered = renderer.createNode({
    x: 250,
    y: 80,
    w: 200,
    h: 280,
    texture: missingTexture,
    placeholderImage: lightningPng,
    shader: renderer.createShader('RoundedWithBorder', {
      radius: [20],
      'border-w': 8,
    }),
    parent: testRoot,
  });

  // 3. Placeholder image that itself 404s -> placeholderColor rect fallback.
  const fallbackRect = renderer.createNode({
    x: 480,
    y: 80,
    w: 200,
    h: 280,
    texture: missingTexture,
    placeholderImage: MISSING_PLACEHOLDER,
    placeholderColor: 0x993311ff,
    shader: renderer.createShader('Rounded', { radius: [20] }),
    parent: testRoot,
  });

  // 4. A successfully loaded image with a placeholder configured must show
  //    the image.
  const loadedImage = renderer.createNode({
    x: 710,
    y: 80,
    w: 181,
    h: 218,
    src: rockoPng,
    placeholderImage: lightningPng,
    shader: renderer.createShader('Rounded', { radius: [20] }),
    parent: testRoot,
  });

  // 5. Control: failed src + failed placeholder + no color renders nothing.
  renderer.createNode({
    x: 940,
    y: 80,
    w: 200,
    h: 280,
    texture: missingTexture,
    placeholderImage: MISSING_PLACEHOLDER,
    parent: testRoot,
  });

  const placeholderTexture = failedRounded.placeholderTexture as Texture;
  const fallbackPlaceholderTexture = fallbackRect.placeholderTexture as Texture;

  const settled = await Promise.all([
    waitForNodeEvent(failedRounded, 'failed', 10000),
    waitForNodeEvent(failedBordered, 'failed', 10000),
    waitForNodeEvent(loadedImage, 'loaded', 10000),
    waitForTextureState(placeholderTexture, 'loaded', 10000),
    waitForTextureState(fallbackPlaceholderTexture, 'failed', 10000),
  ]);

  for (let i = 0; i < settled.length; i++) {
    if (settled[i] === false) {
      console.error('[texture-placeholder-image] did not settle', settled);
      return false;
    }
  }

  console.log('[texture-placeholder-image] scene settled');
  return true;
}
