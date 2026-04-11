import type { ITextNodeProps, RendererMain } from '@lightningjs/renderer';
import type { ExampleSettings } from '../common/ExampleSettings.js';
import { paginateTestRows, type TestRow } from '../common/paginateTestRows.js';
import { PageContainer } from '../common/PageContainer.js';
import { constructTestRow } from '../common/constructTestRow.js';

export async function automation(settings: ExampleSettings) {
  // Snapshot all the pages
  await (await test(settings)).snapshotPages();
}

export default async function test(settings: ExampleSettings) {
  const { renderer } = settings;
  const pageContainer = new PageContainer(settings, {
    w: renderer.settings.appWidth,
    h: renderer.settings.appHeight,
    title: 'Text Line Height',
  });

  await paginateTestRows(pageContainer, [
    ...generateLineHeightTest(renderer, 'sdf'),
    ...generateLineHeightTest(renderer, 'canvas'),
  ]);

  return pageContainer;
}

const NODE_PROPS = {
  x: 90,
  y: 90,
  mount: 0.5,
  color: 0x000000ff,
  text: 'abcd\ntxyz',
  fontFamily: 'Ubuntu',
  textRendererOverride: 'sdf',
  fontSize: 50,
} satisfies Partial<ITextNodeProps>;

function generateLineHeightTest(
  renderer: RendererMain,
  textRenderer: 'canvas' | 'sdf',
): TestRow[] {
  return [
    {
      title: `Text Node ('lineHeight', ${textRenderer}, fontSize=50)${
        textRenderer === 'canvas' ? ', "BROKEN!"' : ''
      }`,
      content: async (rowNode) => {
        const nodeProps = {
          ...NODE_PROPS,
          textRendererOverride: textRenderer,
        } satisfies Partial<ITextNodeProps>;

        const baselineNode = renderer.createTextNode({
          ...nodeProps,
        });
        // const dimensions = await waitForTextDimensions(baselineNode);

        // // Get the position for the center of the container based on mount = 0
        // const position = {
        //   y: 100 - dimensions.h / 2,
        // };

        // baselineNode.y = position.y;

        return await constructTestRow(
          { renderer, rowNode, containerSize: 180 },
          [
            'lineHeight: (default)\n->',
            baselineNode,
            '60 ->',
            renderer.createTextNode({
              ...nodeProps,
              lineHeight: 60,
            }),
            '70 ->',
            renderer.createTextNode({
              ...nodeProps,
              lineHeight: 70,
            }),
            '25 ->',
            renderer.createTextNode({
              ...nodeProps,
              lineHeight: 25,
            }),
            '10 ->',
            renderer.createTextNode({
              ...nodeProps,
              lineHeight: 10,
            }),
            '1 ->',
            renderer.createTextNode({
              ...nodeProps,
              lineHeight: 1,
            }),
          ],
        );
      },
    },
  ] satisfies TestRow[];
}
