import type { ExampleSettings } from '../common/ExampleSettings.js';

export async function automation(settings: ExampleSettings) {
  await test(settings);
  await settings.snapshot();
}

/**
 * RTL layout mirroring.
 *
 * Each row places three boxes at the same increasing `x` offsets. In an LTR
 * container they read left-to-right; in an RTL container the same offsets are
 * mirrored within the container width, so they read right-to-left.
 *
 * Each box carries a small white marker child at its own `x: 0`. A box's own
 * `rtl` flag (not the parent's) controls where that marker lands: under RTL the
 * marker mirrors to the box's right edge. The third row keeps the RTL container
 * (so box positions still mirror) but sets `rtl: false` on each box, so the
 * markers stay on the left edge — demonstrating a sub-tree opting back out.
 *
 * Default 'left' text alignment also flips to the right edge under RTL.
 */
export default async function test({ renderer, testRoot }: ExampleSettings) {
  const CONTAINER_W = 700;
  const BOX = 200;
  const MARKER = 30;
  const GAP = 20;
  const colors = [0xff0000ff, 0x00ff00ff, 0x0000ffff];

  const makeRow = (
    y: number,
    containerRtl: boolean | undefined,
    boxRtl: boolean | undefined,
    label: string,
  ) => {
    const container = renderer.createNode({
      x: 20,
      y,
      w: CONTAINER_W,
      h: BOX,
      color: 0x222222ff,
      rtl: containerRtl,
      parent: testRoot,
    });

    for (let i = 0; i < 3; i++) {
      const box = renderer.createNode({
        x: i * (BOX + GAP),
        w: BOX,
        h: BOX,
        color: colors[i],
        rtl: boxRtl,
        parent: container,
      });
      // Marker at the box's own top-left; mirrors to the right under box RTL.
      renderer.createNode({
        x: 0,
        y: 0,
        w: MARKER,
        h: MARKER,
        color: 0xffffffff,
        parent: box,
      });
    }

    renderer.createTextNode({
      x: 0,
      y: BOX + 4,
      w: CONTAINER_W,
      fontFamily: 'Ubuntu',
      fontSize: 28,
      color: 0xffffffff,
      forceLoad: true,
      text: label,
      parent: container,
    });
  };

  makeRow(20, false, undefined, 'LTR container (markers left)');
  makeRow(300, true, undefined, 'RTL container (mirrored, markers right)');
  makeRow(580, true, false, 'RTL container, boxes rtl:false (markers left)');
}
