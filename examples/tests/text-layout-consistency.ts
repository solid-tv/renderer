import type { ExampleSettings } from '../common/ExampleSettings.js';
import { getLoremIpsum } from '../common/LoremIpsum.js';

export async function automation(settings: ExampleSettings) {
  const next = await test(settings);
  await settings.snapshot();
  while (await next()) {
    await settings.snapshot();
  }
}

/**
 * This test is to ensure that the canvas text renderer and the sdf text
 * renderer are as consistent as possible in their layout. Two text nodes are
 * created with the same text, font size, and font family. The only difference
 * is that one uses the canvas text renderer (red text) and the other uses the
 * sdf text renderer (blue text). The width of the text nodes
 * are changed during each step.
 *
 * Unfortunately, the canvas text renderer horitzonal layout will vary between
 * browsers and platforms. The only thing the Renderer can guarantee is that
 * the vertical baseline layout will be consistent.
 *
 * Acceptable results: The baselines of the two text nodes overlap precisely.
 * Horizontal layout may vary.
 *
 * Ideal results: All text appears purple because both the horizontal and
 * vertical layout are consistent.
 *
 * Press the right arrow key to cycle through the different widths
 *
 * @param param0
 * @returns
 */
export default async function test({ renderer, testRoot }: ExampleSettings) {
  const fontFamily = 'Ubuntu';
  const text = getLoremIpsum(1200);
  const fontSize = 20;
  const yPos = 0;
  testRoot.w = 500;
  testRoot.h = 500;
  testRoot.clipping = true;
  testRoot.color = 0xffffffff;

  /**
   * Light Green Background
   */
  const background = renderer.createNode({
    x: 0,
    y: 0,
    w: testRoot.w,
    h: testRoot.h,
    color: 0x00ff0020,
    parent: testRoot,
  });
  const canvasText = renderer.createTextNode({
    y: yPos,
    maxWidth: testRoot.w,
    text,
    fontSize,
    fontFamily,
    color: 0xff0000ff,
    textRendererOverride: 'canvas',
    parent: testRoot,
  });
  const sdfText = renderer.createTextNode({
    y: yPos,
    maxWidth: testRoot.w,
    text,
    fontSize,
    fontFamily,
    color: 0x0000ff77,
    parent: testRoot,
    zIndex: 3,
  });
  const indexInfo = renderer.createTextNode({
    x: testRoot.w,
    y: testRoot.h,
    mount: 1,
    color: 0x000000ff,
    fontFamily: 'Ubuntu',
    fontSize: 20,
    text: '1',
    parent: testRoot,
  });

  let i = 0;
  const mutations = [
    () => {
      canvasText.maxWidth = sdfText.maxWidth = background.w = 250;
    },
    () => {
      canvasText.maxWidth = sdfText.maxWidth = background.w = 350;
    },
    () => {
      canvasText.maxWidth = sdfText.maxWidth = background.w = 500;
    },
  ];

  /**
   * Run the next mutation in the list
   *
   * @param idx
   * @returns `false` if loop is set to false and we've already gone through all mutations. Otherwise `true`.
   */
  async function next(loop = false, idx = i + 1): Promise<boolean> {
    if (idx > mutations.length - 1) {
      if (!loop) {
        return false;
      }
      idx = 0;
    }
    i = idx;
    mutations[i]?.();
    indexInfo.text = (i + 1).toString();
    return true;
  }
  await next(false, 0);

  window.addEventListener('keydown', (event) => {
    // When right arrow is pressed, call next
    if (event.key === 'ArrowRight') {
      next(true).catch(console.error);
    }
  });

  return next;
}
