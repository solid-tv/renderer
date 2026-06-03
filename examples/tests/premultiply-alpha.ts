import type { INode, NodeLoadedEventHandler } from '@lightningjs/renderer';
import type { ExampleSettings } from '../common/ExampleSettings.js';
import rocko from '../assets/rocko.png';

/**
 * Premultiply-alpha ghosting test.
 *
 * A transparent PNG with antialiased edges is rendered with
 * `premultiplyAlpha: true` (correct) and `premultiplyAlpha: false` (the state
 * older Safari/WebKit silently lands in because it ignores the
 * createImageBitmap `premultiplyAlpha: 'premultiply'` option).
 *
 * Each is shown over a light and a dark background so the edge halos produced
 * by straight (non-premultiplied) alpha are visible: the `false` column should
 * show fringing/ghosting around the silhouette, the `true` column should have
 * clean edges.
 */
export async function automation(settings: ExampleSettings) {
  await test(settings);
  await settings.snapshot();
}

export default async function test({ renderer, testRoot }: ExampleSettings) {
  const PADDING = 80;
  const CELL = 220;

  testRoot.color = 0x808080ff; // neutral grey so both halo colors show

  renderer.createTextNode({
    text: 'Premultiply Alpha: left column = premultiply:true (correct), right = false (Safari bug)',
    fontFamily: 'Ubuntu',
    fontSize: 30,
    color: 0xffffffff,
    x: PADDING,
    y: PADDING,
    parent: testRoot,
  });

  // Surface what the startup probe detected on this device, if reachable.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const honored = (renderer as any).stage?.txManager?.imageBitmapSupported
    ?.premultiplyHonored;
  renderer.createTextNode({
    text: `Device probe: createImageBitmap premultiplyAlpha honored: ${String(
      honored,
    )}`,
    fontFamily: 'Ubuntu',
    fontSize: 26,
    color: 0xffff00ff,
    x: PADDING,
    y: PADDING + 40,
    parent: testRoot,
  });

  const sizeToTexture: NodeLoadedEventHandler = (target, payload) => {
    const { w, h } = payload.dimensions;
    target.w = w;
    target.h = h;
  };

  const rows: { label: string; bg: number }[] = [
    { label: 'over white', bg: 0xffffffff },
    { label: 'over black', bg: 0x000000ff },
  ];

  const cols: { label: string; premultiplyAlpha: boolean }[] = [
    { label: 'premultiply: true', premultiplyAlpha: true },
    { label: 'premultiply: false', premultiplyAlpha: false },
  ];

  const gridTop = PADDING + 90;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]!;
    const y = gridTop + r * (CELL + PADDING + 30);

    for (let c = 0; c < cols.length; c++) {
      const col = cols[c]!;
      const x = PADDING + c * (CELL + PADDING);

      // Contrasting background panel
      renderer.createNode({
        x,
        y,
        w: CELL,
        h: CELL,
        color: row.bg,
        parent: testRoot,
      });

      // Transparent image on top, with the mode under test
      renderer
        .createNode({
          x,
          y,
          parent: testRoot,
          texture: renderer.createTexture('ImageTexture', {
            src: rocko,
            premultiplyAlpha: col.premultiplyAlpha,
          }),
        })
        .once('loaded', sizeToTexture);

      renderer.createTextNode({
        text: `${col.label}, ${row.label}`,
        fontFamily: 'Ubuntu',
        fontSize: 22,
        color: 0xffffffff,
        x,
        y: y + CELL + 4,
        parent: testRoot,
      });
    }
  }
}
