import { type INode } from '@lightningjs/renderer';
import type { ExampleSettings } from '../common/ExampleSettings.js';
import robotImg from '../assets/robot/robot.png';

const randomIntBetween = (from: number, to: number) =>
  Math.floor(Math.random() * (to - from + 1) + from);

export default async function ({
  renderer,
  testRoot,
  perfMultiplier,
}: ExampleSettings) {
  // create nodes
  const numOuterNodes = 100 * perfMultiplier;
  const nodes: INode[] = [];
  let totalNodes = 0;

  const bg = renderer.createNode({
    w: 1920,
    h: 1080,
    color: 0xff1e293b,
    parent: testRoot,
  });

  for (let i = 0; i < numOuterNodes; i++) {
    const container = renderer.createNode({
      x: Math.random() * 1920,
      y: Math.random() * 1080,
      w: 100,
      h: 100,
      clipping: true,
      parent: bg,
    });
    const node = renderer.createNode({
      mount: 0.5,
      x: 50,
      y: 50,
      w: 200,
      h: 200,
      src: robotImg,
      parent: container,
    });

    nodes.push(container);
    totalNodes += 2;
  }

  console.log(
    `Created ${numOuterNodes} clipping outer nodes with an image node nested inside. Total nodes: ${totalNodes}`,
  );

  // create animations
  const animate = () => {
    nodes.forEach((node) => {
      node
        .animate(
          {
            x: randomIntBetween(20, 1740),
            y: randomIntBetween(20, 900),
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
}
