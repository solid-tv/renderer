import type { ExampleSettings } from '../common/ExampleSettings.js';

export async function automation(settings: ExampleSettings) {
  // Snapshot single page
  await test(settings);
  // await settings.snapshot();
}

export default async function test({
  renderer,
  testRoot,
  snapshot,
}: ExampleSettings) {
  const degToRad = (deg: number) => {
    return (Math.PI / 180) * deg;
  };

  const nodeSize = {
    w: 300,
    h: 300,
  };

  const t1 = renderer.createNode({
    ...nodeSize,
    x: 90,
    y: 90,
    color: 0xff0000ff,
    shader: renderer.createShader('Rounded', {
      radius: 100,
    }),
    parent: testRoot,
  });

  const t1Radius = renderer.createTextNode({
    mountX: 1,
    x: testRoot.w - 90,
    y: 90,
    fontSize: 40,
    fontFamily: 'Ubuntu',
    text: 'radius: 100',
    parent: testRoot,
    color: 0xffffffff,
  });

  await snapshot({ name: 'startup' });

  const shaderAnimation = t1.animate(
    {
      x: 1140,
      shaderProps: {
        radius: 150,
      },
    },
    {
      duration: 500,
    },
  );
  shaderAnimation.start();
  await shaderAnimation.waitUntilStopped();
  t1Radius.text = 'radius: ' + t1.shader.props!.radius.toString();
  await snapshot({ name: 'animation1' });
}
