import logo from '../assets/lightning.png';
import type { ExampleSettings } from '../common/ExampleSettings.js';

export default async function ({ renderer, testRoot }: ExampleSettings) {
  const bg = renderer.createNode({
    w: 1920,
    h: 1080,
    color: 0x000000ff,
    parent: testRoot,
  });

  const dataNodeCheckBox = renderer.createNode({
    w: 100,
    h: 100,
    x: 80,
    y: 200,
    color: 0xff0000ff,
    parent: bg,
  });

  const dataNode = renderer.createNode({
    w: 505,
    h: 101,
    x: 200,
    y: 200,
    src: logo,
    parent: bg,
    data: {
      id: 'dataNode',
      number: 1,
      boolean: true,
    },
  });

  const tooLongStringCheckBox = renderer.createNode({
    w: 100,
    h: 100,
    x: 80,
    y: 400,
    color: 0xff0000ff,
    parent: bg,
  });

  const tooLongString = renderer.createNode({
    w: 505,
    h: 101,
    x: 200,
    y: 400,
    src: logo,
    parent: bg,
    data: {
      id: 'tooLongString',
      b: 'a'.repeat(2049),
    },
  });

  const textNodeCheckBox = renderer.createNode({
    w: 100,
    h: 100,
    x: 80,
    y: 600,
    color: 0xff0000ff,
    parent: bg,
  });

  const textNode = renderer.createTextNode({
    x: 200,
    y: 600,
    h: 100,
    text: 'Hello World',
    fontFamily: 'Ubuntu',
    fontSize: 100,
    parent: bg,
    data: {
      id: 'textNode',
    },
  });

  const testDetailsText = renderer.createTextNode({
    x: 30,
    y: 80,
    h: 100,
    text: 'Boxes should turn green if the inspector is enabled',
    fontFamily: 'Ubuntu',
    fontSize: 50,
    parent: bg,
  });

  const testQparamDetailsText = renderer.createTextNode({
    x: 30,
    y: 800,
    h: 100,
    text: 'Please make sure to run this test with ?inspector=true',
    fontFamily: 'Ubuntu',
    fontSize: 50,
    parent: bg,
  });

  setTimeout(() => {
    // Select the first element with data-id="dataNode"
    const domDataNode = document.querySelector('[data-id="dataNode"]');
    if (domDataNode) {
      dataNodeCheckBox.color = 0x00ff00ff;
    }

    const domTooLongString = document.querySelector(
      '[data-id="tooLongString"]',
    );

    if (domTooLongString) {
      tooLongStringCheckBox.color = 0x00ff00ff;
    }

    const domTextNode = document.querySelector('[data-id="textNode"]');

    if (domTextNode) {
      textNodeCheckBox.color = 0x00ff00ff;
    }
  }, 1000);
}
