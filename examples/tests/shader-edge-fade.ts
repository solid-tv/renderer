import rockoImg from '../assets/rocko.png';
import type { ExampleSettings } from '../common/ExampleSettings.js';

export async function automation(settings: ExampleSettings) {
  await test(settings);
  await settings.snapshot();
}

export default async function test({ renderer, testRoot }: ExampleSettings) {
  // Checkerboard background so the fade provably reveals what is behind the
  // faded nodes instead of just darkening them.
  const tile = 100;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 13; col++) {
      renderer.createNode({
        x: col * tile,
        y: row * tile,
        w: tile,
        h: tile,
        color: (row + col) % 2 === 0 ? 0x113355ff : 0xddaa33ff,
        parent: testRoot,
      });
    }
  }

  // 1. The hero use case: image fading out to the right
  renderer.createNode({
    x: 20,
    y: 20,
    w: 540,
    h: 300,
    src: rockoImg,
    shader: renderer.createShader('EdgeFade', { right: 220 }),
    parent: testRoot,
  });

  // 2. Image fading on all four edges (vignette)
  renderer.createNode({
    x: 620,
    y: 20,
    w: 400,
    h: 300,
    src: rockoImg,
    shader: renderer.createShader('EdgeFade', {
      left: 80,
      top: 80,
      right: 80,
      bottom: 80,
    }),
    parent: testRoot,
  });

  // 3. Color rect (no texture) fading left and right
  renderer.createNode({
    x: 20,
    y: 380,
    w: 540,
    h: 160,
    color: 0xff0000ff,
    shader: renderer.createShader('EdgeFade', { left: 150, right: 150 }),
    parent: testRoot,
  });

  // 4. All-zero fades must render identically to the default shader
  renderer.createNode({
    x: 620,
    y: 380,
    w: 400,
    h: 160,
    color: 0x00ff00ff,
    shader: renderer.createShader('EdgeFade'),
    parent: testRoot,
  });

  // 5. Composes with corner colors and node alpha
  renderer.createNode({
    x: 20,
    y: 600,
    w: 540,
    h: 160,
    src: rockoImg,
    alpha: 0.6,
    colorTop: 0xffffffff,
    colorBottom: 0xff66ffff,
    shader: renderer.createShader('EdgeFade', { right: 270 }),
    parent: testRoot,
  });

  // 6. Fade distance larger than the node: never reaches full opacity
  renderer.createNode({
    x: 620,
    y: 600,
    w: 400,
    h: 160,
    color: 0x0000ffff,
    shader: renderer.createShader('EdgeFade', { right: 800 }),
    parent: testRoot,
  });
}
