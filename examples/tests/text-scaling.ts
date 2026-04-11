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
  const { renderer, testRoot } = settings;
  const pageContainer = new PageContainer(settings, {
    w: renderer.settings.appWidth,
    h: renderer.settings.appHeight,
    parent: testRoot,
    title: 'Text Scaling',
  });

  await paginateTestRows(pageContainer, [
    ...generateScalingTest(renderer, 'sdf', 'scale'),
    ...generateScalingTest(renderer, 'sdf', 'scaleX'),
    ...generateScalingTest(renderer, 'sdf', 'scaleY'),
    ...generateScalingTest(renderer, 'canvas', 'scale'),
    ...generateScalingTest(renderer, 'canvas', 'scaleX'),
    ...generateScalingTest(renderer, 'canvas', 'scaleY'),
  ]);

  return pageContainer;
}

const NODE_PROPS = {
  x: 100,
  y: 100,
  color: 0x000000ff,
  text: 'xyz',
  fontFamily: 'Ubuntu',
  textRendererOverride: 'sdf',
  fontSize: 50,
} satisfies Partial<ITextNodeProps>;

function generateScalingTest(
  renderer: RendererMain,
  textRenderer: 'canvas' | 'sdf',
  scaleProp: 'scale' | 'scaleX' | 'scaleY',
): TestRow[] {
  return [
    {
      title: `Text Node ('${scaleProp}', ${textRenderer}, mount = 0)`,
      content: async (rowNode) => {
        const nodeProps = {
          ...NODE_PROPS,
          textRendererOverride: textRenderer,
        } satisfies Partial<ITextNodeProps>;

        const baselineNode = renderer.createTextNode({
          ...nodeProps,
        });

        const dimensions = {
          w: 74,
          h: 51,
        };

        // Get the position for the center of the container based on mount = 0
        const position = {
          x: 100 - dimensions.w / 2,
          y: 100 - dimensions.h / 2,
        };

        baselineNode.x = position.x;
        baselineNode.y = position.y;

        return await constructTestRow({ renderer, rowNode }, [
          baselineNode,
          'scale 2 ->\npivot 0.5 ->',
          renderer.createTextNode({
            ...nodeProps,
            ...position,
            [scaleProp]: 2,
            // pivot: 0.5, (should be default)
          }),
          'pivot 0 ->',
          renderer.createTextNode({
            ...nodeProps,
            ...position,
            pivot: 0,
            [scaleProp]: 2,
          }),
          'pivot 1 ->',
          renderer.createTextNode({
            ...nodeProps,
            ...position,
            pivot: 1,
            [scaleProp]: 2,
          }),
          "pivot 0.5 ->\ncontain -> 'width'",
          renderer.createTextNode({
            ...nodeProps,
            ...position,
            maxWidth: dimensions.w,
            pivot: 0.5,
            [scaleProp]: 2,
          }),
          "pivot 0.5 ->\ncontain -> 'both'",
          renderer.createTextNode({
            ...nodeProps,
            ...position,
            maxWidth: dimensions.w,
            maxHeight: dimensions.h,
            pivot: 0.5,
            [scaleProp]: 2,
          }),
        ]);
      },
    },
    {
      title: `Text Node ('${scaleProp}', ${textRenderer},  mount = 0.5)`,
      content: async (rowNode) => {
        const nodeProps = {
          ...NODE_PROPS,
          mount: 0.5,
          x: 100,
          y: 100,
          textRendererOverride: textRenderer,
        } satisfies Partial<ITextNodeProps>;

        const baselineNode = renderer.createTextNode({
          ...nodeProps,
        });

        const dimensions = {
          w: 74,
          h: 51,
        };

        return await constructTestRow({ renderer, rowNode }, [
          baselineNode,
          'scale 2 ->\npivot 0.5 ->',
          renderer.createTextNode({
            ...nodeProps,
            [scaleProp]: 2,
            // pivot: 0.5, (should be default)
          }),
          'pivot 0 ->',
          renderer.createTextNode({
            ...nodeProps,
            pivot: 0,
            [scaleProp]: 2,
          }),
          'pivot 1 ->',
          renderer.createTextNode({
            ...nodeProps,
            pivot: 1,
            [scaleProp]: 2,
          }),
          "pivot 0.5 ->\ncontain -> 'width'",
          renderer.createTextNode({
            ...nodeProps,
            maxWidth: dimensions.w,
            pivot: 0.5,
            [scaleProp]: 2,
          }),
          "pivot 0.5 ->\ncontain -> 'both'",
          renderer.createTextNode({
            ...nodeProps,
            maxWidth: dimensions.w,
            maxHeight: dimensions.h,
            pivot: 0.5,
            [scaleProp]: 2,
          }),
        ]);
      },
    },
    {
      title: `Text Node ('${scaleProp}', ${textRenderer},  mount = 1)`,
      content: async (rowNode) => {
        const nodeProps = {
          ...NODE_PROPS,
          mount: 1,
          textRendererOverride: textRenderer,
        } satisfies Partial<ITextNodeProps>;

        const baselineNode = renderer.createTextNode({
          ...nodeProps,
        });
        const dimensions = {
          w: 74,
          h: 51,
        };

        // Get the position for the center of the container based on mount = 0
        const position = {
          x: 100 - dimensions.w / 2,
          y: 100 - dimensions.h / 2,
        };

        baselineNode.x = position.x;
        baselineNode.y = position.y;

        return await constructTestRow({ renderer, rowNode }, [
          baselineNode,
          'scale 2 ->\npivot 0.5 ->',
          renderer.createTextNode({
            ...nodeProps,
            ...position,
            [scaleProp]: 2,
            // pivot: 0.5, (should be default)
          }),
          'pivot 0 ->',
          renderer.createTextNode({
            ...nodeProps,
            ...position,
            pivot: 0,
            [scaleProp]: 2,
          }),
          'pivot 1 ->',
          renderer.createTextNode({
            ...nodeProps,
            ...position,
            pivot: 1,
            [scaleProp]: 2,
          }),
          "pivot 0.5 ->\ncontain -> 'width'",
          renderer.createTextNode({
            ...nodeProps,
            ...position,
            maxWidth: dimensions.w,
            pivot: 0.5,
            [scaleProp]: 2,
          }),
          "pivot 0.5 ->\ncontain -> 'both'",
          renderer.createTextNode({
            ...nodeProps,
            ...position,
            maxWidth: dimensions.w,
            maxHeight: dimensions.h,
            pivot: 0.5,
            [scaleProp]: 2,
          }),
        ]);
      },
    },
  ] satisfies TestRow[];
}
