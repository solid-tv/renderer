import type {
  INode,
  ITextNodeProps,
  RendererMain,
} from '@lightningjs/renderer';
import type { ExampleSettings } from '../common/ExampleSettings.js';
import { PageContainer } from '../common/PageContainer.js';

export async function automation(settings: ExampleSettings) {
  // Snapshot all the pages
  await (await test(settings)).snapshotPages();
}

/**
 * This test is to ensure that text that starts offscreen and moves onscreen
 * is rendered correctly.
 *
 * This test was designed around the following bug report:
 * https://github.com/lightning-js/renderer/issues/50
 *
 * @param param0
 */
export default async function test(settings: ExampleSettings) {
  const { renderer } = settings;

  const pageContainer = new PageContainer(settings, {
    w: renderer.settings.appWidth,
    h: renderer.settings.appHeight,
    title: 'Text Offscreen Move Tests',
  });

  pageContainer.pushPage(createTestCase(renderer, 'sdf', 0, 0));
  pageContainer.pushPage(createTestCase(renderer, 'sdf', 400, 0));
  pageContainer.pushPage(createTestCase(renderer, 'sdf', 400, 400));
  pageContainer.pushPage(createTestCase(renderer, 'canvas', 0, 0));
  pageContainer.pushPage(createTestCase(renderer, 'canvas', 400, 0));
  pageContainer.pushPage(createTestCase(renderer, 'canvas', 400, 400));

  await delay(200);
  pageContainer.finalizePages();
  return pageContainer;
}

const commonTextProps = {
  mount: 0.5,
  text: 'Test passes if this text appears only as green',
  fontFamily: 'Ubuntu',
  textRendererOverride: 'canvas',
  fontSize: 50,
} satisfies Partial<ITextNodeProps>;

function createTestCase(
  renderer: RendererMain,
  textRenderer: 'canvas' | 'sdf',
  maxWidth: number,
  maxHeight: number,
) {
  return async function (page: INode) {
    const subheader = renderer.createTextNode({
      x: 0,
      y: 10,
      text: '',
      fontFamily: 'Ubuntu',
      textRendererOverride: 'sdf',
      fontSize: 30,
      parent: page,
    });

    subheader.text = `textRenderer = ${textRenderer}\nmaxWidth = ${maxWidth}\nmaxHeight = ${maxHeight}`;
    renderer.createTextNode({
      ...commonTextProps,
      color: 0xff0000ff,
      x: renderer.settings.appWidth / 2,
      y: renderer.settings.appHeight / 2,
      textRendererOverride: textRenderer,
      maxHeight,
      maxWidth,
      parent: page,
    });

    const offscreenStartText = renderer.createTextNode({
      ...commonTextProps,
      color: 0x00ff00ff,
      x: -1000,
      y: -1000,
      textRendererOverride: textRenderer,
      maxHeight,
      maxWidth,
      parent: page,
    });

    // Move Offscreen Text on screen
    offscreenStartText.x = renderer.settings.appWidth / 2;
    offscreenStartText.y = renderer.settings.appHeight / 2;
  };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
