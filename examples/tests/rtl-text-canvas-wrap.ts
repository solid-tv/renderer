import type { ExampleSettings } from '../common/ExampleSettings.js';

export async function automation(settings: ExampleSettings) {
  await test(settings);
  await settings.snapshot();
}

/**
 * Canvas RTL text: word wrapping and overflow.
 *
 * Verifies that bidirectional Canvas text behaves correctly when wrapped across
 * multiple lines and when truncated with an overflow suffix:
 *
 * - Wrapping happens in logical order, and each visual line is right-aligned and
 *   reordered (RTL base direction) for an `rtl` node.
 * - With `contain: 'width'`, the block hugs the right edge of the `maxWidth` box.
 * - `maxLines` + `overflowSuffix` truncates and appends the suffix at the
 *   logical end of the text.
 *
 * The left column is `rtl: false` (LTR) for contrast; the right column is
 * `rtl: true`. Uses the bundled NotoSansHebrew font so the snapshot is
 * deterministic across environments (no system font fallback).
 */
export default async function test({ renderer, testRoot }: ExampleSettings) {
  // Long mixed Hebrew + Latin + number paragraph:
  // "This is a long paragraph in Hebrew with numbers like 42 and English
  //  words like world that wraps across several lines in the layout."
  const paragraph =
    'זהו פסקה ארוכה בעברית עם מספרים כמו 42 ומילים באנגלית like world ' +
    'שנמשכת על פני כמה שורות בתוך הפריסה הזאת.';

  const COL_W = 520;
  const MAX_W = 480;

  const labeled = (
    x: number,
    y: number,
    label: string,
    rtl: boolean,
    extra: Record<string, unknown>,
  ) => {
    renderer.createTextNode({
      x,
      y,
      w: COL_W,
      fontFamily: 'Ubuntu',
      fontSize: 24,
      color: 0xffffffff,
      forceLoad: true,
      text: label,
      parent: testRoot,
    });

    renderer.createTextNode({
      x,
      y: y + 36,
      w: MAX_W,
      maxWidth: MAX_W,
      contain: 'width',
      rtl,
      fontFamily: 'NotoSansHebrew',
      fontSize: 34,
      lineHeight: 44,
      color: 0xffd700ff,
      forceLoad: true,
      textRendererOverride: 'canvas',
      text: paragraph,
      parent: testRoot,
      ...extra,
    });
  };

  const lx = 20;
  const rx = 620;

  // Row 1: free wrapping across as many lines as needed.
  labeled(lx, 20, 'Wrapped - LTR', false, {});
  labeled(rx, 20, 'Wrapped - RTL', true, {});

  // Row 2: truncated to 2 lines with an ellipsis suffix.
  labeled(lx, 360, 'maxLines: 2 + ellipsis - LTR', false, {
    maxLines: 2,
    overflowSuffix: '…',
  });
  labeled(rx, 360, 'maxLines: 2 + ellipsis - RTL', true, {
    maxLines: 2,
    overflowSuffix: '…',
  });
}
