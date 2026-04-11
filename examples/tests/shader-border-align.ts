import type { ExampleSettings } from '../common/ExampleSettings.js';

export async function automation(settings: ExampleSettings) {
  // Snapshot single page
  await test(settings);
  await settings.snapshot();
}

export default async function test({
  renderer,
  testRoot,
  snapshot,
}: ExampleSettings) {
  const RedRect = renderer.createNode({
    x: 90,
    y: 90,
    w: 200,
    h: 200,
    color: 0xff0000ff,
    shader: renderer.createShader('Border', { w: 20, align: 0 }),
    parent: testRoot,
  });

  const RedRect2 = renderer.createNode({
    x: 390,
    y: 90,
    w: 200,
    h: 200,
    color: 0xff0000ff,
    shader: renderer.createShader('Border', { w: 20, align: 0.5 }),
    parent: testRoot,
  });

  const RedRect3 = renderer.createNode({
    x: 720,
    y: 90,
    w: 200,
    h: 200,
    color: 0xff0000ff,
    shader: renderer.createShader('Border', { w: 20, align: 1 }),
    parent: testRoot,
  });

  const GreenRect = renderer.createNode({
    x: 90,
    y: 400,
    w: 200,
    h: 200,
    color: 0x00ff00ff,
    shader: renderer.createShader('RoundedWithBorder', {
      'border-w': 20,
      'border-align': 'inside',
      radius: 30,
    }),
    parent: testRoot,
  });

  const GreenRect2 = renderer.createNode({
    x: 390,
    y: 400,
    w: 200,
    h: 200,
    color: 0x00ff00ff,
    shader: renderer.createShader('RoundedWithBorder', {
      'border-w': 20,
      'border-align': 'center',
      radius: 30,
    }),
    parent: testRoot,
  });

  const GreenRect3 = renderer.createNode({
    x: 720,
    y: 400,
    w: 200,
    h: 200,
    color: 0x00ff00ff,
    shader: renderer.createShader('RoundedWithBorder', {
      'border-w': 20,
      'border-align': 'outside',
      radius: 30,
    }),
    parent: testRoot,
  });

  const BlueRect = renderer.createNode({
    x: 90,
    y: 710,
    w: 200,
    h: 200,
    color: 0x0000ffff,
    shader: renderer.createShader('RoundedWithBorderAndShadow', {
      'border-w': 20,
      'border-align': 'inside',
      radius: 30,
    }),
    parent: testRoot,
  });

  const BlueRect2 = renderer.createNode({
    x: 390,
    y: 710,
    w: 200,
    h: 200,
    color: 0x0000ffff,
    shader: renderer.createShader('RoundedWithBorderAndShadow', {
      'border-w': 20,
      'border-align': 'center',
      radius: 30,
    }),
    parent: testRoot,
  });

  const BlueRect3 = renderer.createNode({
    x: 720,
    y: 710,
    w: 200,
    h: 200,
    color: 0x0000ffff,
    shader: renderer.createShader('RoundedWithBorderAndShadow', {
      'border-w': 20,
      'border-align': 'outside',
      radius: 30,
    }),
    parent: testRoot,
  });
}
