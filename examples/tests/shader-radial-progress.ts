import type { ExampleSettings } from '../common/ExampleSettings.js';

export async function automation(settings: ExampleSettings) {
  await test(settings);
  await settings.snapshot();
}

export default async function test({ renderer, testRoot }: ExampleSettings) {
  // 1. Fill-up animation: progress 0 → 1, looping. Cyan ring on a dim track.
  const fillRing = renderer.createNode({
    x: 40,
    y: 40,
    w: 300,
    h: 300,
    color: 0x00000000,
    shader: renderer.createShader('RadialProgress', {
      width: 16,
      progress: 0,
      colors: [0x4aff80ff],
      trackColor: 0x1c3a2aff,
    }),
    parent: testRoot,
  });

  // fillRing
  //   .animate(
  //     { shaderProps: { progress: 1 } },
  //     { duration: 2000, loop: true, easing: 'linear' },
  //   )
  //   .start();

  // 2. Countdown animation: progress 1 → 0, looping. Matches the reference
  //    screenshot recipe (blue arc, dim blue track).
  const countdownRing = renderer.createNode({
    x: 380,
    y: 40,
    w: 300,
    h: 300,
    color: 0x00000000,
    shader: renderer.createShader('RadialProgress', {
      width: 14,
      progress: 1,
      colors: [0x4aa3ffff],
      trackColor: 0x1f3a5cff,
    }),
    parent: testRoot,
  });

  // countdownRing
  //   .animate(
  //     { shaderProps: { progress: 0 } },
  //     { duration: 2000, loop: true, easing: 'linear' },
  //   )
  //   .start();

  // 3. Multi-stop gradient swept along the arc, 50% progress
  renderer.createNode({
    x: 720,
    y: 40,
    w: 300,
    h: 300,
    color: 0x00000000,
    shader: renderer.createShader('RadialProgress', {
      width: 24,
      progress: 0.5,
      colors: [0x4aa3ffff, 0x9ad6ffff, 0xffffffff],
      trackColor: 0x1f3a5c66,
    }),
    parent: testRoot,
  });

  // 4. Counter-clockwise, butt caps, partial sweep
  renderer.createNode({
    x: 40,
    y: 380,
    w: 300,
    h: 300,
    color: 0x00000000,
    shader: renderer.createShader('RadialProgress', {
      width: 20,
      progress: 0.35,
      direction: -1,
      cap: 0,
      colors: [0xff66aaff, 0xffaa66ff],
      trackColor: 0x33333366,
    }),
    parent: testRoot,
  });

  // 5. Full ring with multi-stop sweep (no track)
  renderer.createNode({
    x: 380,
    y: 380,
    w: 300,
    h: 300,
    color: 0x00000000,
    shader: renderer.createShader('RadialProgress', {
      width: 18,
      progress: 1,
      colors: [0xff0080ff, 0xffaa00ff, 0x00ffaaff, 0xff0080ff],
    }),
    parent: testRoot,
  });

  // 6. Custom startAngle (9 o'clock), 80% progress
  renderer.createNode({
    x: 720,
    y: 380,
    w: 300,
    h: 300,
    color: 0x00000000,
    shader: renderer.createShader('RadialProgress', {
      width: 12,
      progress: 0.8,
      startAngle: Math.PI,
      colors: [0xffffffff],
      trackColor: 0x33333366,
    }),
    parent: testRoot,
  });
}
