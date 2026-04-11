import { type INode } from '@lightningjs/renderer';
import logo from '../assets/lightning.png';
import type { ExampleSettings } from '../common/ExampleSettings.js';

const randomIntBetween = (from: number, to: number) =>
  Math.floor(Math.random() * (to - from + 1) + from);

export default async function ({
  renderer,
  testRoot,
  perfMultiplier,
}: ExampleSettings) {
  // create 100 nodes
  const numOuterNodes = 1 * perfMultiplier;
  const nodes: INode[] = [];

  const bg = renderer.createNode({
    w: 1920,
    h: 1080,
    color: 0xff1e293b,
    parent: testRoot,
  });

  for (let i = 0; i < numOuterNodes; i++) {
    const node = renderer.createNode({
      w: 505,
      h: 101,
      x: Math.random() * 1920,
      y: Math.random() * 1080,
      // src: logo,
      parent: bg,
    });

    node.src = logo;

    nodes.push(node);
  }

  console.log(`Created ${numOuterNodes} nodes with the same texture`);

  // create 100 animations
  const animate = () => {
    nodes.forEach((node) => {
      node
        .animate(
          {
            x: randomIntBetween(20, 1740),
            y: randomIntBetween(20, 900),
            rotation: Math.random() * Math.PI,
          },
          {
            duration: 3000,
            easing: 'ease-out',
            loop: true,
            stopMethod: 'reverse',
          },
        )
        .start();
    });
  };

  animate();

  // setInterval(animate, 3000);
}
