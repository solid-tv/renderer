import type { ExampleSettings } from '../common/ExampleSettings.js';
import { waitForLoadedDimensions, waitUntilIdle } from '../common/utils.js';

export async function automation(settings: ExampleSettings) {
  await test(settings);
  await settings.snapshot();
}

/**
 * Diagnostic test for initial text jump risk.
 *
 * This test focuses on parent-driven jumps: the text node is inside a parent
 * container that uses mount/autosize. If parent dimensions change from initial
 * frame to loaded frame, its mount translation can cause a visible jump.
 */
export default async function test({
  renderer,
  testRoot,
  renderMode,
}: ExampleSettings) {
  testRoot.w = 900;
  testRoot.h = 360;
  testRoot.color = 0xffffffff;

  renderer.createTextNode({
    x: 20,
    y: 14,
    fontFamily: 'Ubuntu',
    fontSize: 28,
    color: 0x000000ff,
    text: 'Text jump diagnostic (parent mount/autosize case)',
    parent: testRoot,
  });

  if (renderMode === 'webgl') {
    await runCase({
      renderer,
      testRoot,
      y: 120,
      rendererType: 'sdf',
      label: 'SDF',
    });
  }

  await runCase({
    renderer,
    testRoot,
    y: 250,
    rendererType: 'canvas',
    label: 'Canvas',
  });
}

async function runCase({
  renderer,
  testRoot,
  y,
  rendererType,
  label,
}: {
  renderer: ExampleSettings['renderer'];
  testRoot: ExampleSettings['testRoot'];
  y: number;
  rendererType: 'sdf' | 'canvas';
  label: string;
}) {
  const anchorX = 650;

  renderer.createNode({
    x: anchorX,
    y: y - 40,
    w: 1,
    h: 80,
    color: 0x00000066,
    parent: testRoot,
  });

  const parentContainer = renderer.createNode({
    x: anchorX,
    y,
    mountX: 0.5,
    mountY: 0.5,
    pivotX: 0.5,
    pivotY: 0.5,
    autosize: false,
    color: 0x00000000,
    parent: testRoot,
  });

  const textNode = renderer.createTextNode({
    x: 0,
    y: 0,
    contain: 'width',
    maxWidth: 280,
    textAlign: 'center',
    forceLoad: true,
    fontFamily: 'Ubuntu',
    fontSize: 42,
    color: 0x003366ff,
    textRendererOverride: rendererType,
    text: 'JUMP CHECK',
    parent: parentContainer,
  });

  const initialParentW = Math.round(parentContainer.w);
  const initialParentH = Math.round(parentContainer.h);

  await waitForLoadedDimensions(textNode);
  await waitUntilIdle(renderer);

  const loadedParentW = Math.round(parentContainer.w);
  const loadedParentH = Math.round(parentContainer.h);

  const pass =
    initialParentW === loadedParentW && initialParentH === loadedParentH;

  // Red box = initial parent dimensions, green box = loaded parent dimensions.
  renderer.createNode({
    x: anchorX - initialParentW / 2,
    y: y - initialParentH / 2,
    w: initialParentW,
    h: initialParentH,
    color: 0xff000044,
    parent: testRoot,
  });

  renderer.createNode({
    x: anchorX - loadedParentW / 2,
    y: y - loadedParentH / 2,
    w: loadedParentW,
    h: loadedParentH,
    color: 0x00ff0044,
    parent: testRoot,
  });

  renderer.createTextNode({
    x: 20,
    y: y - 32,
    fontFamily: 'Ubuntu',
    fontSize: 24,
    color: pass ? 0x007700ff : 0xaa0000ff,
    text:
      `${label}: parent initial ${initialParentW}x${initialParentH}, loaded ${loadedParentW}x${loadedParentH} -> ` +
      `${pass ? 'PASS' : 'JUMP RISK'}`,
    parent: testRoot,
  });
}
