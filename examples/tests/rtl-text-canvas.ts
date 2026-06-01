import type { ExampleSettings } from '../common/ExampleSettings.js';

export async function automation(settings: ExampleSettings) {
  await test(settings);
  await settings.snapshot();
}

/**
 * Canvas bidirectional (RTL) text.
 *
 * The Canvas renderer leans on the browser's built-in `fillText` bidi: when the
 * node is `rtl`, each line is given an RTL base direction (portably, via an
 * RLE/PDF wrap) so mixed Hebrew/Latin/number runs reorder correctly and the
 * paragraph reads right-to-left, right-aligned.
 *
 * Left column: `rtl: false` (LTR base) — Hebrew still shapes RTL within its run,
 * but the overall order and alignment are left-to-right.
 * Right column: `rtl: true` — RTL base direction, right-aligned, correct order.
 *
 * SDF text is intentionally not covered (deferred); these nodes force the
 * 'canvas' renderer.
 */
export default async function test({ renderer, testRoot }: ExampleSettings) {
  const samples = [
    'שלום עולם', // "hello world"
    'שלום world 123', // mixed Hebrew + Latin + digits
    '90 דקות', // "90 minutes" — leading number
    'מחיר: $42 לחודש', // "price: $42 per month"
  ];

  const COL_W = 560;
  const ROW_H = 70;

  const makeColumn = (x: number, rtl: boolean, title: string) => {
    renderer.createTextNode({
      x,
      y: 20,
      w: COL_W,
      fontFamily: 'Ubuntu',
      fontSize: 32,
      color: 0xffffffff,
      forceLoad: true,
      text: title,
      parent: testRoot,
    });

    for (let i = 0; i < samples.length; i++) {
      renderer.createTextNode({
        x,
        y: 80 + i * ROW_H,
        w: COL_W,
        rtl,
        fontFamily: 'Ubuntu',
        fontSize: 40,
        color: 0xffd700ff,
        forceLoad: true,
        textRendererOverride: 'canvas',
        text: samples[i],
        parent: testRoot,
      });
    }
  };

  makeColumn(20, false, 'LTR base (rtl: false)');
  makeColumn(620, true, 'RTL base (rtl: true)');
}
