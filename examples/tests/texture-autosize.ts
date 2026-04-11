import type { ExampleSettings } from '../common/ExampleSettings.js';
import robotImg from '../assets/robot/robot.png';
import { waitForLoadedDimensions } from '../common/utils.js';

export async function automation(settings: ExampleSettings) {
  await test(settings);
  await settings.snapshot();
}

/**
 * Tests that text nodes with different contain settings and text renderers
 * are displayed correctly.
 *
 * Press the right arrow key to cycle through the different settings when
 * running in the browser.
 *
 * @param settings
 * @returns
 */
export default async function test(settings: ExampleSettings) {
  const { renderer, testRoot } = settings;

  // Set a smaller snapshot area
  testRoot.w = 200;
  testRoot.h = 250;
  testRoot.color = 0xffffffff;

  const image = renderer.createNode({
    mount: 0.5,
    x: testRoot.w / 2,
    y: testRoot.h / 4,
    autosize: true,
    src: robotImg,
    parent: testRoot,
  });

  const dimensions = await waitForLoadedDimensions(image);

  const dimensionsMatch = dimensions.w === image.w && dimensions.h === image.h;

  renderer.createTextNode({
    mountX: 0.5,
    mountY: 1,
    x: testRoot.w / 2,
    y: testRoot.h,
    textAlign: 'center',
    text: dimensionsMatch ? 'Autosize\nSuccess' : 'Autosize\nFailure',
    color: dimensionsMatch ? 0x00ff00ff : 0xff0000ff,
    fontSize: 50,
    fontFamily: 'Ubuntu',
    parent: testRoot,
  });
}
