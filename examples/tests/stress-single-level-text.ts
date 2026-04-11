import { type INode, type ITextNode } from '@lightningjs/renderer';
import type { ExampleSettings } from '../common/ExampleSettings.js';

const randomIntBetween = (from: number, to: number) =>
  Math.floor(Math.random() * (to - from + 1) + from);

export default async function ({
  renderer,
  testRoot,
  perfMultiplier,
}: ExampleSettings) {
  // create 100 nodes
  const numOuterNodes = 100 * perfMultiplier;
  const nodes: ITextNode[] = [];

  const startMin = -1000;
  const startMax = 3000;
  const endMin = -1000;
  const endMax = 3000;

  const bg = renderer.createNode({
    w: 1920,
    h: 1080,
    color: 0xff1e293b,
    parent: testRoot,
  });

  for (let i = 0; i < numOuterNodes; i++) {
    const node = renderer.createTextNode({
      x: randomIntBetween(startMin, startMax),
      y: randomIntBetween(startMin, startMax),
      fontFamily: 'Ubuntu',
      textRendererOverride: 'sdf',
      text: 'Lightning 3.0',
      // contain: 'both',
      // w: 237,
      // h: 45,
      color: 0xffffffff,
      fontSize: 40,
      parent: bg,
    });

    nodes.push(node);
  }

  console.log(`Created ${numOuterNodes} nodes with the same text`);

  // create 100 animations
  const animate = () => {
    nodes.forEach((node) => {
      node
        .animate(
          {
            x: randomIntBetween(endMin, endMax),
            y: randomIntBetween(endMin, endMax),
          },
          {
            duration: 3000,
            loop: true,
          },
        )
        .start();
    });
  };

  animate();
}
