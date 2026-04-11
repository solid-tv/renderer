import type { ExampleSettings } from '../common/ExampleSettings.js';

export async function automation(settings: ExampleSettings) {
  const next = await test(settings);
  await settings.snapshot();
  while (await next()) {
    await settings.snapshot();
  }
}

/**
 * Tests the difference between a Canvas Web font that has explictly provided
 * metrics and the same font without metrics.
 *
 * NOTE: There is no test needed for the SDF renderer as these metrics are
 * absolutely required.
 *
 * Expected results: In each step, the Canvas text should render and likely with
 * different ascenders and line heights.
 *
 * Press the right arrow key to cycle through the different widths
 *
 * @param param0
 * @returns
 */
export default async function test({ renderer, testRoot }: ExampleSettings) {
  const fontFamily = 'Ubuntu';
  const fontFamilyNoMetrics = 'Ubuntu-No-Metrics';

  const text =
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.';
  const fontSize = 100;
  const yPos = 0;
  testRoot.w = 1000;
  testRoot.h = 1000;
  testRoot.color = 0xffffffff;

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
      canvasText.fontFamily = fontFamily;
    },
    () => {
      canvasText.fontFamily = fontFamilyNoMetrics;
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
