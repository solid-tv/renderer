import type { ExampleSettings } from '../common/ExampleSettings.js';
import spritemap from '../assets/spritemap.png';

export async function automation(settings: ExampleSettings) {
  // Snapshot single page
  await test(settings);
  await settings.snapshot();
}

export default async function test({ renderer, testRoot }: ExampleSettings) {
  const FONT_SIZE = 45;

  renderer.createTextNode({
    text: `Texture Spritemap Test`,
    fontSize: FONT_SIZE,
    offsetY: -5,
    parent: testRoot,
  });

  const spriteMapTexture = renderer.createTexture('ImageTexture', {
    src: spritemap,
  });

  spriteMapTexture.on('load', (dimensions) => {
    console.log('Spritemap Texture loaded', dimensions);
  });

  function execTest(y: number, x: number, title: string): Promise<boolean> {
    renderer.createTextNode({
      text: title,
      fontSize: FONT_SIZE,
      y: y,
      parent: testRoot,
    });

    const character = renderer.createTexture('SubTexture', {
      texture: spriteMapTexture,
      x: x,
      y: 0,
      w: 100,
      h: 150,
    });

    renderer.createNode({
      x: 20,
      y: y + 80,
      w: 100,
      h: 150,
      texture: character,
      parent: testRoot,
    });

    return new Promise((resolve, reject) => {
      renderer.once('idle', () => {
        resolve(true);
      });
    });
  }

  await execTest(80, 0, 'Character 1');
  await execTest(300, 100, 'Character 2');
  await execTest(520, 200, 'Character 3');
}
