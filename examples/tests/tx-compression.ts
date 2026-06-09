import type { INode } from '@lightningjs/renderer';
import type { ExampleSettings } from '../common/ExampleSettings.js';
import { waitForLoadedDimensions } from '../common/utils.js';

/**
 * Resolve once `node`'s texture has finished uploading, or after `timeoutMs`.
 *
 * @remarks
 * Compressed-texture support is device/driver-specific. A format the running
 * GPU lacks (e.g. ETC1 under the headless CI SwiftShader driver) now surfaces
 * as a `failed` texture, which never fires `loaded`. `waitForLoadedDimensions`
 * alone would then wait forever — and the VRT runner has no per-test timeout,
 * so the whole capture/compare run hangs. The timeout backstop lets the
 * snapshot capture whatever the device produced (a blank tile for an
 * unsupported format) instead of hanging.
 */
function waitForUpload(node: INode, timeoutMs = 2000): Promise<unknown> {
  return Promise.race([
    waitForLoadedDimensions(node),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

export async function automation(settings: ExampleSettings) {
  const { pvr, ktx } = await test(settings);
  // Wait for both to settle (loaded or, on an unsupported format, timed out) so
  // the snapshot captures the decoded result rather than an empty frame.
  await Promise.all([waitForUpload(pvr), waitForUpload(ktx)]);
  await settings.snapshot();
}

export default async function test({ renderer, testRoot }: ExampleSettings) {
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

  const pvr = renderer.createNode({
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

  const ktx = renderer.createNode({
    x: 800,
    y: 170,
    w: 400,
    h: 400,
    src: '../assets/test-s3tc.ktx',
    parent: testRoot,
  });

  return { pvr, ktx };
}
