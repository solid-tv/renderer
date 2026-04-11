import type { ITextNodeProps, RendererMain } from '@lightningjs/renderer';
import type { ExampleSettings } from '../common/ExampleSettings.js';
import { paginateTestRows, type TestRow } from '../common/paginateTestRows.js';
import { PageContainer } from '../common/PageContainer.js';
import { constructTestRow } from '../common/constructTestRow.js';
import { getLoremIpsum } from '../common/LoremIpsum.js';

export async function automation(settings: ExampleSettings) {
  // Snapshot all the pages
  await (await test(settings)).snapshotPages();
}

export default async function test(settings: ExampleSettings) {
  const { renderer } = settings;
  const pageContainer = new PageContainer(settings, {
    w: renderer.settings.appWidth,
    h: renderer.settings.appHeight,
    title: 'Text Overflow Suffix',
  });

  await paginateTestRows(pageContainer, [
    ...generateOverflowSuffixTest(renderer, 'sdf'),
    ...generateOverflowSuffixTest(renderer, 'canvas'),
  ]);

  return pageContainer;
}

const NODE_PROPS = {
  x: 100,
  y: 100,
  maxWidth: 200,
  color: 0x000000ff,
  text: getLoremIpsum(100),
  fontFamily: 'Ubuntu',
  textRendererOverride: 'sdf',
  fontSize: 20,
  lineHeight: 28,
} satisfies Partial<ITextNodeProps>;

function generateOverflowSuffixTest(
  renderer: RendererMain,
  textRenderer: 'canvas' | 'sdf',
): TestRow[] {
  return [
    {
      title: `Text Node ('overflowSuffix', ${textRenderer})`,
      content: async (rowNode) => {
        const nodeProps = {
          ...NODE_PROPS,
          textRendererOverride: textRenderer,
        } satisfies Partial<ITextNodeProps>;

        const baselineNode = renderer.createTextNode({
          ...nodeProps,
        });

        const position = {
          x: 0,
          y: 0,
        };

        baselineNode.x = position.x;
        baselineNode.y = position.y;

        return await constructTestRow({ renderer, rowNode }, [
          baselineNode,
          'overflowSuffix: "..." ->',
          renderer.createTextNode({
            ...nodeProps,
            ...position,
            overflowSuffix: '...',
            maxLines: 1,
          }),
          'overflowSuffix: ".." ->',
          renderer.createTextNode({
            ...nodeProps,
            ...position,
            overflowSuffix: '..',
            maxLines: 1,
          }),
        ]);
      },
    },
  ] satisfies TestRow[];
}
