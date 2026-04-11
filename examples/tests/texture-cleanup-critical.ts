import type { RendererMainSettings } from '@lightningjs/renderer';
import type { ExampleSettings } from '../common/ExampleSettings.js';

export function customSettings(): Partial<RendererMainSettings> {
  return {
    textureMemory: {
      criticalThreshold: 100 * 1024 ** 2,
      targetThresholdLevel: 0.25,
      debugLogging: true,
    },
  };
}

export default async function ({
  renderer,
  testRoot,
  memMonitor,
}: ExampleSettings) {
  // Make the memory monitor update fast
  if (memMonitor) {
    memMonitor.interval = 10;
  }
  const screen = renderer.createNode({
    x: 0,
    y: 0,
    w: renderer.settings.appWidth,
    h: renderer.settings.appHeight,
    parent: testRoot,
    color: 0xff00ffff,
  });

  renderer.createTextNode({
    x: 0,
    y: 0,
    text: 'Critical Texture Memory Cleanup Test',
    parent: screen,
    fontFamily: 'Ubuntu',
    fontSize: 60,
  });

  renderer.createTextNode({
    x: 0,
    y: 100,
    maxWidth: renderer.settings.appWidth,
    text: `This test will create and display a random NoiseTexture node every 10ms and never offer a moment for Idle Texture Cleanup. Only Critical Texture Cleanup will be triggered.

See docs/ManualRegressionTests.md for more information.
    `,
    parent: screen,
    fontFamily: 'Ubuntu',
    fontSize: 40,
  });

  // Create a new random texture every 10ms
  setInterval(() => {
    screen.texture = renderer.createTexture('NoiseTexture', {
      w: 500,
      h: 500,
      cacheId: Math.floor(Math.random() * 100000),
    });
    screen.textureOptions.preload = true;
  }, 100);
}
