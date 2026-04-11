import type { ExampleSettings } from '../common/ExampleSettings.js';

export async function automation(settings: ExampleSettings) {
  // Snapshot single page
  await test(settings);
  await settings.snapshot();
}

export default async function test({ renderer, testRoot }: ExampleSettings) {
  const parent = renderer.createNode({
    x: 200,
    y: 240,
    w: 500,
    h: 500,
    color: 0x000000ff,
    parent: testRoot,
    zIndex: 0,
    zIndexLocked: 1,
    alpha: 0.5,
  });

  const child = renderer.createNode({
    x: 800,
    y: 0,
    w: 500,
    h: 500,
    color: 0xff0000ff,
    parent,
    zIndex: 12,
    alpha: 1,
  });

  console.log('ready!');
}
