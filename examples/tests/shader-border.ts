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
    x: 20,
    y: 20,
    w: 200,
    h: 200,
    color: 0xff0000ff,
    shader: renderer.createShader('Border', { w: 1 }),
    parent: testRoot,
  });

  const RedRect2 = renderer.createNode({
    x: 250,
    y: 20,
    w: 200,
    h: 200,
    color: 0xff0000ff,
    shader: renderer.createShader('Border', { w: 30 }),
    parent: testRoot,
  });

  const GreenRect = renderer.createNode({
    x: 20,
    y: 250,
    w: 200,
    h: 200,
    color: 0x00ff00ff,
    shader: renderer.createShader('Border', {
      top: 10,
    }),
    parent: testRoot,
  });

  const GreenRect2 = renderer.createNode({
    x: 250,
    y: 250,
    w: 200,
    h: 200,
    color: 0x00ff00ff,
    shader: renderer.createShader('Border', {
      right: 10,
    }),
    parent: testRoot,
  });

  const GreenRect3 = renderer.createNode({
    x: 480,
    y: 250,
    w: 200,
    h: 200,
    color: 0x00ff00ff,
    shader: renderer.createShader('Border', {
      bottom: 10,
    }),
    parent: testRoot,
  });

  const GreenRect4 = renderer.createNode({
    x: 710,
    y: 250,
    w: 200,
    h: 200,
    color: 0x00ff00ff,
    shader: renderer.createShader('Border', {
      left: 10,
    }),
    parent: testRoot,
  });

  const BlueRect = renderer.createNode({
    x: 20,
    y: 480,
    w: 200,
    h: 200,
    color: 0x0000ffff,
    shader: renderer.createShader('RoundedWithBorder', {
      radius: 10,
      'border-w': 1,
    }),
    parent: testRoot,
  });

  const BlueRect2 = renderer.createNode({
    x: 250,
    y: 480,
    w: 200,
    h: 200,
    color: 0x0000ffff,
    shader: renderer.createShader('RoundedWithBorder', {
      'top-right': 20,
      'border-top': 10,
    }),
    parent: testRoot,
  });

  const BlueRect3 = renderer.createNode({
    x: 480,
    y: 480,
    w: 200,
    h: 200,
    color: 0x0000ffff,
    shader: renderer.createShader('RoundedWithBorder', {
      'border-w': 10,
      'border-left': 20,
      'border-right': 20,
      radius: 50,
    }),
    parent: testRoot,
  });

  const BlueRect4 = renderer.createNode({
    x: 710,
    y: 480,
    w: 200,
    h: 200,
    color: 0x0000ffff,
    shader: renderer.createShader('RoundedWithBorder', {
      'bottom-left': 20,
      'border-bottom': 10,
    }),
    parent: testRoot,
  });

  const YellowRect = renderer.createNode({
    x: 20,
    y: 710,
    w: 200,
    h: 200,
    color: 0xff9900ff,
    shader: renderer.createShader('RoundedWithBorderAndShadow', {
      'top-left': 20,
      'border-w': 1,
    }),
    parent: testRoot,
  });

  const YellowRect2 = renderer.createNode({
    x: 250,
    y: 710,
    w: 200,
    h: 200,
    color: 0xff9900ff,
    shader: renderer.createShader('RoundedWithBorderAndShadow', {
      'top-right': 20,
      'border-w': 1,
    }),
    parent: testRoot,
  });

  const YellowRect3 = renderer.createNode({
    x: 480,
    y: 710,
    w: 200,
    h: 200,
    color: 0xff9900ff,
    shader: renderer.createShader('RoundedWithBorderAndShadow', {
      'bottom-right': 20,
      'border-w': 1,
    }),
    parent: testRoot,
  });

  const YellowRect4 = renderer.createNode({
    x: 710,
    y: 710,
    w: 200,
    h: 200,
    color: 0xff9900ff,
    shader: renderer.createShader('RoundedWithBorderAndShadow', {
      'bottom-left': 20,
      'border-w': 1,
    }),
    parent: testRoot,
  });
}
