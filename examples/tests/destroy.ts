import { type INode } from '@lightningjs/renderer';
import logo from '../assets/lightning.png';
import type { ExampleSettings } from '../common/ExampleSettings.js';

export async function automation(settings: ExampleSettings) {
  const destroy = await test(settings);
  await settings.snapshot();
  destroy(100);
  await settings.snapshot();
}

export default async function test({
  renderer,
  testRoot,
  automation,
  perfMultiplier,
}: ExampleSettings) {
  // create 100 nodes
  const numOuterNodes = (100 * Math.max(perfMultiplier, 1)) / 2;
  const nodes: INode[] = [];

  const bg = renderer.createNode({
    w: 1920,
    h: 1080,
    color: 0xff1e293b,
    parent: testRoot,
  });

  const gridSize = Math.ceil(Math.sqrt(numOuterNodes));
  for (let i = 0; i < numOuterNodes; i++) {
    const baseX = (i % gridSize) * 150;
    const baseY = Math.floor(i / gridSize) * 60;

    const node = renderer.createNode({
      w: 125,
      h: 25,
      x: baseX,
      y: baseY,
      src: logo,
      shader: renderer.createShader('Rounded', {
        radius: 50,
      }),
      parent: bg,
    });

    nodes.push(node);

    const textNode = renderer.createTextNode({
      w: 125,
      h: 25,
      x: baseX,
      y: baseY + 25,
      text: 'Lightning 3',
      color: 0xffffffff,
      parent: bg,
    });

    nodes.push(textNode);
  }

  console.log(
    `Created ${numOuterNodes} texture nodes and ${numOuterNodes} text nodes`,
  );

  const destroy = (amount = 10) => {
    const nodesToDestroy = nodes.splice(0, amount);
    nodesToDestroy.forEach((node) => {
      node.destroy();
    });

    console.log(`Destroyed ${amount} nodes, ${nodes.length} remaining`);

    if (nodes.length > 0) {
      setTimeout(destroy, 100);
    } else {
      console.log('All nodes destroyed');
    }
  };

  if (!automation) {
    setTimeout(destroy, 100);
  }

  return destroy;
}
