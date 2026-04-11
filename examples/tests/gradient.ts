import type { ExampleSettings } from '../common/ExampleSettings.js';

export default async function ({ renderer, testRoot }: ExampleSettings) {
  const elements = [
    'colorTl',
    'colorTr',
    'colorBl',
    'colorBr',
    'colorTop',
    'colorBottom',
    'colorLeft',
    'colorRight',
    'color',
  ];

  const nodes = elements.map((element, idx) => {
    return renderer.createNode({
      x: (idx % 4) * 300 + 100,
      y: Math.floor(idx / 4) * 300 + 100,
      w: 250,
      h: 250,
      color: 0x000000ff,
      [element]: 0xff0000ff,
      parent: testRoot,
    });
  });

  setTimeout(() => {
    nodes.forEach((node, idx) => {
      node
        .animate(
          {
            [elements[idx] ?? 'color']: 0x00ff00ff,
          },
          {
            duration: 1000,
          },
        )
        .start();
    });
  }, 2000);
  /*
   * End: Sprite Map Demo
   */
  console.log('ready!');
}
