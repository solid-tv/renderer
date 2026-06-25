import type { ExampleSettings } from '../common/ExampleSettings.js';

/**
 * Transparency-focused regression for the LinearGradient shader.
 *
 * Each gradient sits on top of an opaque white background so that any
 * unexpected transparency (or unexpected opacity) is visible against it:
 *  - solid opaque stops must fully hide the background (the WebGL bug where
 *    solid colors rendered semi-transparent)
 *  - partial-alpha stops must let the background show through proportionally
 *  - a stop fading to alpha 0 must reveal the background at that end
 *  - node opacity (alpha) must scale the whole gradient (the `u_alpha` path)
 */
export async function automation(settings: ExampleSettings) {
  await test(settings);
  await settings.snapshot();
}

export default async function test({ renderer, testRoot }: ExampleSettings) {
  const degToRad = (deg: number) => (Math.PI / 180) * deg;

  // Opaque white backdrop — transparency reads as white.
  renderer.createNode({
    x: 0,
    y: 0,
    w: 1920,
    h: 1080,
    color: 0xffffffff,
    parent: testRoot,
  });

  const w = 880;
  const h = 440;

  // Solid opaque stops: must be fully opaque (no white bleed-through).
  renderer.createNode({
    x: 40,
    y: 40,
    w,
    h,
    shader: renderer.createShader('LinearGradient', {
      colors: [0xff0000ff, 0x0000ffff],
      angle: degToRad(0),
    }),
    parent: testRoot,
  });

  // Partial-alpha middle stop: white shows through the centre band.
  renderer.createNode({
    x: 1000,
    y: 40,
    w,
    h,
    shader: renderer.createShader('LinearGradient', {
      colors: [0xff0000ff, 0x00ff0080, 0x0000ffff],
      angle: degToRad(90),
    }),
    parent: testRoot,
  });

  // Fade to fully transparent: bottom edge reveals the white backdrop.
  renderer.createNode({
    x: 40,
    y: 600,
    w,
    h,
    shader: renderer.createShader('LinearGradient', {
      colors: [0x000000ff, 0x00000000],
      stops: [0, 1],
      angle: degToRad(0),
    }),
    parent: testRoot,
  });

  // Node opacity: solid gradient at 50% alpha blends with the white backdrop.
  renderer.createNode({
    x: 1000,
    y: 600,
    w,
    h,
    alpha: 0.5,
    shader: renderer.createShader('LinearGradient', {
      colors: [0xff00ffff, 0xffff00ff],
      angle: degToRad(45),
    }),
    parent: testRoot,
  });
}
