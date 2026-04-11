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
 * renderer both support the `textAlign` property consistently.
 *
 * Two text nodes are created with the same text, font size, and font family.
 * The only difference is that one uses the canvas text renderer (red text) and
 * the other uses the sdf text renderer (blue text). The `textAlign` property
 * is changed during each step.
 *
 * This test includes a single line text case to ensure that the `textAlign`
 * bug reported in https://github.com/lightning-js/renderer/issues/171 works.
 *
 * Unfortunately, the canvas text renderer horitzonal layout will vary between
 * browsers and platforms. There will be some differences in the horizontal
 * text layout between the two text nodes. Don't expect entirely homogeneous
 * purple text.
 *
 * Expected results: The two text nodes align text properly according to the
 * `textAlign` property.
 *
 * Press the right arrow key to cycle through the different `textAlign` values.
 *
 * @param param0
 * @returns
 */
export default async function test({ renderer, testRoot }: ExampleSettings) {
  const fontFamily = 'Ubuntu';
  const fontSize = 20;
  const yPos = 0;
  testRoot.w = 500;
  testRoot.h = 500;
  testRoot.clipping = true;
  testRoot.color = 0xffffffff;

  const canvasText = renderer.createTextNode({
    y: yPos,
    maxWidth: testRoot.w,
    contain: 'width',
    fontSize,
    fontFamily,
    color: 0xff0000ff,
    textRendererOverride: 'canvas',
    parent: testRoot,
  });
  const sdfText = renderer.createTextNode({
    y: yPos,
    maxWidth: testRoot.w,
    contain: 'width',
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
      canvasText.text = sdfText.text = getLoremIpsum(1200);
      canvasText.textAlign = sdfText.textAlign = 'left';
    },
    () => {
      canvasText.textAlign = sdfText.textAlign = 'center';
    },
    () => {
      canvasText.textAlign = sdfText.textAlign = 'right';
    },
    () => {
      canvasText.text = sdfText.text = 'Single Line Text';
      canvasText.textAlign = sdfText.textAlign = 'left';
    },
    () => {
      canvasText.textAlign = sdfText.textAlign = 'center';
    },
    () => {
      canvasText.textAlign = sdfText.textAlign = 'right';
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
