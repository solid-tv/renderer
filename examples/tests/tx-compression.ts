import type { ExampleSettings } from '../common/ExampleSettings.js';

export default async function ({ renderer, testRoot }: ExampleSettings) {
  renderer.createTextNode({
    x: 100,
    y: 100,
    color: 0xffffffff,
    alpha: 1.0,
    text: 'etc1 compression in .pvr',
    fontFamily: 'Ubuntu',
    fontSize: 30,
    parent: testRoot,
  });

  renderer.createNode({
    x: 100,
    y: 170,
    w: 550,
    h: 550,
    src: '../assets/test-etc1.pvr',
    parent: testRoot,
  });

  renderer.createTextNode({
    x: 800,
    y: 100,
    color: 0xffffffff,
    alpha: 1.0,
    text: 's3tc compression in .ktx',
    fontFamily: 'Ubuntu',
    fontSize: 30,
    parent: testRoot,
  });

  renderer.createNode({
    x: 800,
    y: 170,
    w: 400,
    h: 400,
    src: '../assets/test-s3tc.ktx',
    parent: testRoot,
  });
}
