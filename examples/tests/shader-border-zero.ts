import type { ExampleSettings } from '../common/ExampleSettings.js';

export async function automation(settings: ExampleSettings) {
  // Snapshot single page
  await test(settings);
  await settings.snapshot();
}

/**
 * Degenerate-prop paths of the border/shadow shaders: zero-width borders and
 * fully transparent shadow colors. These paths are selected branchlessly in
 * the fragment shaders (Mali 400 target), so this locks in that a zero border
 * renders exactly like plain Rounded and a zero-alpha shadow renders nothing.
 */
export default async function test({ renderer, testRoot }: ExampleSettings) {
  const node = renderer.createNode({
    x: 0,
    y: 0,
    w: 1920,
    h: 1080,
    color: 0xffffffff,
    parent: testRoot,
  });

  // Zero-width border: must render identical to plain Rounded
  renderer.createNode({
    x: 300,
    y: 300,
    mount: 0.5,
    w: 250,
    h: 250,
    color: 0xff00ffff,
    shader: renderer.createShader('RoundedWithBorder', {
      radius: 30,
      'border-w': 0,
      'border-color': 0xff0000ff,
    }),
    parent: node,
  });

  // Zero-width border with a shadow: shadow hugs the node box
  renderer.createNode({
    x: 700,
    y: 300,
    mount: 0.5,
    w: 250,
    h: 250,
    color: 0xff00ffff,
    shader: renderer.createShader('RoundedWithBorderAndShadow', {
      radius: 30,
      'border-w': 0,
      'border-color': 0xff0000ff,
      'shadow-x': 50,
      'shadow-spread': 50,
      'shadow-blur': 100,
    }),
    parent: node,
  });

  // Zero-alpha shadow color: no shadow may appear
  renderer.createNode({
    x: 1100,
    y: 300,
    mount: 0.5,
    w: 250,
    h: 250,
    color: 0xff00ffff,
    shader: renderer.createShader('Shadow', {
      x: 50,
      spread: 50,
      blur: 100,
      color: 0x00000000,
    }),
    parent: node,
  });

  // Zero-alpha rounded shadow color: plain rounded corners, no shadow
  renderer.createNode({
    x: 1500,
    y: 300,
    mount: 0.5,
    w: 250,
    h: 250,
    color: 0xff00ffff,
    shader: renderer.createShader('RoundedWithShadow', {
      radius: 30,
      'shadow-x': 50,
      'shadow-spread': 50,
      'shadow-blur': 100,
      'shadow-color': 0x00000000,
    }),
    parent: node,
  });
}
