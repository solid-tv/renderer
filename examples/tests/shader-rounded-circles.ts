import type { ExampleSettings } from '../common/ExampleSettings.js';

export async function automation(settings: ExampleSettings) {
  // Snapshot single page
  await test(settings);
  await settings.snapshot();
}

export default async function test({ renderer, testRoot }: ExampleSettings) {
  const sizes = [10, 20, 40, 80, 100, 200, 300, 400, 800];
  let x = 20;
  let y = 20;
  let rowHeight = 0;

  sizes.forEach((size) => {
    if (x + size > 1900) {
      x = 20;
      y += rowHeight + 20;
      rowHeight = 0;
    }
    renderer.createNode({
      x,
      y,
      w: size,
      h: size,
      color: 0xff0000ff,
      shader: renderer.createShader('Rounded', { radius: size / 2 }),
      parent: testRoot,
    });

    x += size + 20;
    rowHeight = Math.max(rowHeight, size);
  });
}
