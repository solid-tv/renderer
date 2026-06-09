import {
  type CoreShaderNode,
  type FpsUpdatePayload,
  type INode,
  type RendererMain,
} from '@lightningjs/renderer';
import type { ExampleSettings } from '../common/ExampleSettings.js';
import { waitUntilIdle } from '../common/utils.js';
import lightning from '../assets/lightning.png';
import rocko from '../assets/rocko.png';
import testscreen from '../assets/testscreen.png';
import robot from '../assets/robot/robot.png';
import environment from '../assets/robot/environment.png';
import elevator from '../assets/robot/elevator-background.png';

/**
 * TV animation stress test (FPS + VAO focus) — "how many moving cards?".
 *
 * Sibling of `stress-tv`, but **dynamic**. `stress-tv` builds a static grid:
 * once built nothing changes per frame, render is cheap, FPS pins at the panel's
 * vsync (~60), and VAO makes no visible difference. Here the scene is built once
 * and then **animated with `node.animate()`** — every row container slides its
 * x/y forever, so every frame has changing transforms -> nodes go dirty -> they
 * are re-uploaded and re-drawn -> the per-draw attribute-binding cost is paid
 * every frame. That is exactly where VAO matters (one `bindVertexArray` per draw
 * vs N x `vertexAttribPointer` + `enableVertexAttribArray`), so FPS is a
 * meaningful metric and the VAO delta is measurable.
 *
 * What it measures: start with 100 animated cards, then **keep appending more**
 * (never destroying/recreating what exists) until the sustained FPS falls to the
 * target (10 fps by default, capped at 1000 cards). At that point the ramp stops
 * and a **summary screen** reports how many cards were animated and how many
 * nodes were drawn. A live debug panel (top-left) and FPS counter (top-right) are
 * on the whole time — no ?debug=true needed (though passing it adds the per-draw
 * GL-call counts that reveal the VAO signature).
 *
 * Scene: a real TV home screen — a vertical stack of rows (rails), each a parent
 * node holding a horizontal strip of cards (rounded-rect bg + cycled image
 * thumbnail). Only the **row containers** are animated; their cards ride along via
 * world-transform propagation. As the row count grows the whole scene is squished
 * vertically (one `scaleY` on the root) so every card stays on-screen and keeps
 * costing a draw — no existing card is ever moved or recreated, only new ones are
 * appended.
 *
 * Run with the live overlay for FPS / draw-call / quad / VAO read-out:
 *   ?test=stress-animation&debug=true
 *
 * A/B the VAO optimization by reloading with and without (it is fixed at renderer
 * construction — you cannot flip it at runtime):
 *   ?test=stress-animation&debug=true            (VAO on  -> more cards @ target)
 *   ?test=stress-animation&debug=true&novao=true (VAO off -> fewer cards @ target)
 * With VAO off the overlay's `vertexAttribPointer` / `enableVertexAttribArray`
 * climb with the draw count and `bindVAO` stays 0; with VAO on those stay ~0 and
 * `bindVAO` tracks the draw count.
 *
 * Tunables (URL params):
 *   ?targetfps=10  FPS floor that ends the ramp (default 10)
 *   ?start=100     initial element count (default 100)
 *   ?multiplier=N  scales the initial count (perfMultiplier)
 */

// Distinct image sources cycled per card so the batcher has to switch textures —
// that is what makes attribute re-binding (and thus the VAO win) actually show
// up in the numbers. Only 6 unique sources, so after the first rows load every
// later card reuses a cached texture (no upload cost as the scene grows).
const IMAGES = [lightning, rocko, testscreen, robot, environment, elevator];

const APP_W = 1920;
const APP_H = 1080;

// Fixed grid geometry. Cards-per-row is constant; the grid only ever grows
// downward (more rows), and a single root `scaleY` squishes it to fit the
// screen. Fixed cell size means appended cards never disturb existing ones.
const COLS = 16;
const CELL = APP_W / COLS; // 120
const GAP = 10;
const CARD_W = CELL - GAP;
const CARD_H = CELL - GAP;
const RADIUS = 12;

// Per-row animation amplitudes (row-local px) and timing.
const AMP_X = CELL * 0.5;
const AMP_Y = CELL * 0.25;
const ANIM_BASE_MS = 1200;

// Hard ceiling on how many cards the ramp will create. Well under the Uint16
// index-buffer limit (16384 quads/frame; each card is 2 quads), so geometry
// never silently drops.
const MAX_COUNT = 1000;

// Average FPS over `frames` animation frames, discarding a short warm-up so a
// freshly-added batch (animation registration, any first-frame upload) doesn't
// skew the reading. Average = frames / elapsed-seconds over the sampled window.
const measureFps = (frames: number): Promise<number> =>
  new Promise((resolve) => {
    const warmup = 8;
    let seen = 0;
    let sampled = 0;
    let sumMs = 0;
    let last = performance.now();
    const tick = (now: number): void => {
      const d = now - last;
      last = now;
      seen++;
      if (seen > warmup) {
        sumMs += d;
        sampled++;
      }
      if (sampled < frames) {
        requestAnimationFrame(tick);
        return;
      }
      resolve((sampled * 1000) / sumMs);
    };
    requestAnimationFrame(tick);
  });

export async function automation(settings: ExampleSettings) {
  // A moving scene is non-deterministic, so snapshot the INITIAL static layout
  // (no animation, no growth) before any motion. `test` builds the static start
  // scene when settings.automation is true. Math.random is unused here so the
  // layout is fully reproducible.
  await test(settings);
  await waitUntilIdle(settings.renderer);
  await settings.snapshot();
}

export default async function test({
  renderer,
  testRoot,
  perfMultiplier,
  automation,
}: ExampleSettings) {
  const params = new URLSearchParams(window.location.search);
  const targetFps = Number(params.get('targetfps') ?? 10);
  const vaoOff = params.get('novao') === 'true';
  const startCount = Math.max(
    COLS,
    Math.round(Number(params.get('start') ?? 100) * perfMultiplier),
  );

  // Measure raw capability, not a throttle — otherwise FPS pins at the panel
  // refresh and the ramp never reaches the target. This is the whole point.
  renderer.targetFPS = 0;

  renderer.createNode({
    x: 0,
    y: 0,
    w: APP_W,
    h: APP_H,
    color: 0x0f172aff, // dark slate background (0xRRGGBBAA)
    parent: testRoot,
  });

  // Everything hangs off one root so a single `scaleY` squishes the whole grid
  // to fit the screen as it grows.
  const sceneRoot = renderer.createNode({
    x: 0,
    y: 0,
    w: APP_W,
    h: APP_H,
    parent: testRoot,
  });

  // Hoisted shared rounded-rect shader — one instance for every card (radius is
  // constant), never created per card.
  const roundedShader = renderer.createShader('Rounded', {
    radius: RADIUS,
  }) as CoreShaderNode;

  // Row containers are the animation drivers. Kept so we can start their
  // animations after the initial textures have loaded.
  const rows: INode[] = [];
  let count = 0; // total cards created
  let animating = false;

  const hud = renderer.createTextNode({
    x: 20,
    y: APP_H - 90,
    fontFamily: 'Ubuntu',
    textRendererOverride: 'sdf', // never Canvas here — it re-rasterizes per edit and OOMs TVs
    fontSize: 26,
    lineHeight: 32,
    color: 0xffffffff,
    text: '',
    zIndex: 1000,
    parent: testRoot,
  });

  // Start a row container's perpetual back-and-forth slide. loop:true advances
  // continuously, so the row (and every card it owns) is dirty every frame.
  const animateRow = (row: INode, rowIdx: number): void => {
    const baseY = rowIdx * CELL;
    row
      .animate(
        { x: AMP_X, y: baseY + AMP_Y },
        {
          duration: ANIM_BASE_MS + (rowIdx % 6) * 250,
          delay: (rowIdx % 8) * 80,
          loop: true,
          easing: 'ease-in-out',
        },
      )
      .start();
  };

  // Squish the grid vertically so all rows fit on-screen (and keep drawing) no
  // matter how many we add. One property on the root — existing cards never move.
  const fitToScreen = (): void => {
    const rowCount = rows.length;
    const totalH = rowCount * CELL;
    sceneRoot.scaleY = totalH > APP_H ? APP_H / totalH : 1;
  };

  // Append `n` cards, creating new row containers as needed. Existing nodes are
  // never touched — this only ever adds. New rows are animated immediately when
  // the scene is already animating.
  const addCards = (n: number): void => {
    for (let k = 0; k < n; k++) {
      const i = count;
      const rowIdx = (i / COLS) | 0;
      const col = i % COLS;

      let row = rows[rowIdx];
      if (row === undefined) {
        row = renderer.createNode<CoreShaderNode>({
          x: 0,
          y: rowIdx * CELL,
          w: APP_W,
          h: CELL,
          parent: sceneRoot,
        });
        rows.push(row);
        if (animating === true) {
          animateRow(row, rowIdx);
        }
      }

      // Card background (shared rounded shader).
      const card = renderer.createNode({
        x: col * CELL + GAP * 0.5,
        y: GAP * 0.5,
        w: CARD_W,
        h: CARD_H,
        color: 0x1e293bff, // slate-800 (0xRRGGBBAA)
        shader: roundedShader,
        parent: row,
      });

      // Image thumbnail (cycled source -> texture switches -> VAO-relevant work).
      renderer.createNode({
        x: GAP * 0.5,
        y: GAP * 0.5,
        w: CARD_W - GAP,
        h: CARD_H - GAP,
        src: IMAGES[i % IMAGES.length]!,
        parent: card,
      });

      count++;
    }
    fitToScreen();
  };

  // Automation: build the static start scene and stop (no animation, no growth)
  // so the snapshot is deterministic.
  if (automation === true) {
    addCards(startCount);
    return;
  }

  // ---- Always-on debug panel (top-left) -------------------------------------
  // The harness ?debug=true overlay is only created AFTER this function returns
  // (i.e. at the very end of the ramp). Build our own so it is live the whole
  // time. fpsUpdate only fires when the stage has an update interval, so enable
  // it at runtime. The per-draw GL-call counts need a context spy, which is only
  // wired at construction — pass ?debug=true to also get those.
  renderer.stage.options.fpsUpdateInterval = 500;

  let sumBackend = 'webgl';
  let sumVao = vaoOff === true ? 'off' : 'on';

  // Latest GL-call sample from fpsUpdate. Updated every interval so that, just
  // before teardown, we can freeze the values from the LIVE animated scene
  // (rather than the idle summary, where drawElem collapses to ~10).
  let liveHasSpy: boolean = false;
  let liveDraws = 0;
  let liveQuads = 0;
  let liveVAttrib = 0;
  let liveEnaVAA = 0;
  let liveBindVao = 0;
  let liveDrawElem = 0;
  let liveGlTotal = 0;

  renderer.createNode({
    x: 0,
    y: 0,
    w: 600,
    h: 172,
    color: 0x000000cc,
    zIndex: 99999,
    parent: testRoot,
  });
  const dbgText = renderer.createTextNode({
    x: 14,
    y: 10,
    w: 580,
    contain: 'width',
    fontFamily: 'Ubuntu',
    textRendererOverride: 'sdf',
    fontSize: 26,
    lineHeight: 30,
    color: 0x33ff88ff,
    text: 'debug: waiting for fpsUpdate...',
    zIndex: 100000,
    parent: testRoot,
  });

  renderer.on('fpsUpdate', (_t: RendererMain, d: FpsUpdatePayload) => {
    const c = d.capabilities;
    const spy = d.contextSpyData;
    const backend =
      c.renderMode === 'webgl' ? `webgl${c.webGlVersion ?? ''}` : c.renderMode;
    sumBackend = backend;
    sumVao = c.vertexArrayObject === true ? 'on' : 'off';

    liveDraws = d.renderOps;
    liveQuads = d.quads;

    const lines = [
      `FPS ${d.fps}   draws ${d.renderOps}   quads ${d.quads}`,
      `${backend}  VAO:${sumVao}  tex ${c.maxTextureSize}/${c.maxTextureUnits}`,
    ];
    if (spy !== null) {
      let total = 0;
      for (const key in spy) {
        total += spy[key]!;
      }
      const at = (k: string): number => spy[k] ?? 0;
      const bindVao = at('bindVertexArray') + at('bindVertexArrayOES');
      // Stash the live sample for the summary's frozen "during animation" block.
      liveHasSpy = true;
      liveVAttrib = at('vertexAttribPointer');
      liveEnaVAA = at('enableVertexAttribArray');
      liveBindVao = bindVao;
      liveDrawElem = at('drawElements');
      liveGlTotal = total;
      lines.push(`GL calls/interval: ${total}`);
      lines.push(
        `vAttribPtr ${at('vertexAttribPointer')}  enaVAA ${at(
          'enableVertexAttribArray',
        )}`,
      );
      lines.push(
        `bindVAO ${bindVao}  drawElem ${at('drawElements')}  prog ${at(
          'useProgram',
        )}`,
      );
    } else {
      lines.push('GL counts: add &debug=true');
    }
    dbgText.text = lines.join('\n');
  });

  // ---- FPS counter (top-RIGHT edge) -----------------------------------------
  const FPS_W = 250;
  renderer.createNode({
    x: APP_W - FPS_W,
    y: 0,
    w: FPS_W,
    h: 86,
    color: 0x000000cc,
    zIndex: 99999,
    parent: testRoot,
  });
  const fpsText = renderer.createTextNode({
    x: APP_W - FPS_W + 16,
    y: 8,
    fontFamily: 'Ubuntu',
    textRendererOverride: 'sdf',
    fontSize: 32,
    lineHeight: 38,
    color: 0x33ff88ff,
    text: 'FPS --',
    zIndex: 100000,
    parent: testRoot,
  });

  // Rolling FPS meter. Runs forever on rAF (independent of the renderer's own
  // loop) so the counter is live at all times, even while idle. Zero-allocation
  // hot path: number locals only, no allocations per frame.
  let fpsFrames = 0;
  let fpsAccum = 0;
  let fpsLast = performance.now();
  const fpsTick = (now: number): void => {
    fpsFrames++;
    fpsAccum += now - fpsLast;
    fpsLast = now;
    if (fpsAccum >= 500) {
      fpsText.text = `FPS ${Math.round(
        (fpsFrames * 1000) / fpsAccum,
      )}\ncards ${count}`;
      fpsFrames = 0;
      fpsAccum = 0;
    }
    requestAnimationFrame(fpsTick);
  };
  requestAnimationFrame(fpsTick);

  const updateHud = (fps: number): void => {
    hud.text =
      `elements ${count}   fps ${Math.round(fps)}   VAO ${
        vaoOff === true ? 'off' : 'on'
      }\n` + `growing until <= ${targetFps} fps...`;
  };

  // Build the initial batch static, let its textures load and the renderer go
  // idle (no animation yet), THEN start animating everything. After this the
  // scene never idles again (perpetual animations), so the growth loop relies on
  // measureFps, not idle waits.
  addCards(startCount);
  await waitUntilIdle(renderer);

  animating = true;
  for (let r = 0; r < rows.length; r++) {
    animateRow(rows[r]!, r);
  }

  // Ramp: add elements until sustained FPS drops to the target (or we approach
  // the index-buffer cap). Batch grows ~15% per step so the ramp is geometric
  // rather than thousands of tiny steps. Each adjustment's card count + average
  // FPS is recorded so the summary can list the full FPS-vs-load curve.
  const steps: { cards: number; fps: number }[] = [];
  let fps = await measureFps(20);
  steps.push({ cards: count, fps });
  updateHud(fps);
  console.log(`stress-animation: ${count} cards -> ${Math.round(fps)} fps`);

  while (fps > targetFps && count < MAX_COUNT) {
    let batch = Math.max(COLS, Math.round(count * 0.15));
    if (count + batch > MAX_COUNT) {
      batch = MAX_COUNT - count;
    }
    addCards(batch);

    fps = await measureFps(20);
    steps.push({ cards: count, fps });
    updateHud(fps);
    console.log(`stress-animation: ${count} cards -> ${Math.round(fps)} fps`);
  }

  // Hold at the final card count for a few seconds with the scene STILL
  // animating, so the debug panel samples the live animated frame. Then freeze
  // that GL-call reading for the summary — captured here, before teardown, it
  // reflects the real per-frame rebind cost (after teardown the panel collapses
  // to the idle summary where drawElem ~10).
  hud.text = `holding ${count} cards (capturing live GL)...`;
  await measureFps(40); // ~several fpsUpdate intervals at the final (low) FPS
  const liveSpy = Boolean(liveHasSpy);
  const capDraws = liveDraws;
  const capQuads = liveQuads;
  const capVAttrib = liveVAttrib;
  const capEnaVAA = liveEnaVAA;
  const capBindVao = liveBindVao;
  const capDrawElem = liveDrawElem;
  const capGlTotal = liveGlTotal;

  // ---- Summary screen -------------------------------------------------------
  // Capture the stats, then tear down the animated scene (destroy() recurses and
  // stops every row animation) and show a static summary over the background.
  const reason =
    count >= MAX_COUNT
      ? `hit ${MAX_COUNT}-card cap`
      : `FPS fell to ${targetFps}`;
  const finalFps = Math.round(fps);
  const animatedCards = count; // every card moves (rides its animated row)
  const drawnNodes = count * 2; // rounded bg + thumbnail per card
  const animatedRows = rows.length; // animation drivers
  const sceneNodes = rows.length + count * 2; // + row containers (not drawn)

  sceneRoot.destroy();
  hud.text = '';

  // Stats block, left column — pushed below the top-left debug panel (0..172px)
  // so it never sits underneath it.
  renderer.createTextNode({
    x: 120,
    y: 210,
    w: 820,
    contain: 'width',
    fontFamily: 'Ubuntu',
    textRendererOverride: 'sdf',
    fontSize: 34,
    lineHeight: 48,
    color: 0xffffffff,
    zIndex: 100000,
    parent: testRoot,
    text:
      `TEST COMPLETE\n\n` +
      `Stopped: ${reason}  (final avg FPS ${finalFps})\n\n` +
      `Cards animated:    ${animatedCards}\n` +
      `Nodes drawn:       ${drawnNodes}   (bg + thumbnail / card)\n` +
      `Animated rows:     ${animatedRows}   (drivers; every card moves)\n` +
      `Scene-graph nodes: ${sceneNodes}\n` +
      `Backend / VAO:     ${sumBackend} / ${sumVao}`,
  });

  // Per-adjustment average FPS — the full FPS-vs-load curve from the ramp.
  let curve = 'AVG FPS PER ADJUSTMENT\n';
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i]!;
    const n = `${i + 1}`.padStart(2, ' ');
    const cards = `${s.cards}`.padStart(4, ' ');
    curve += `${n}.  ${cards} cards  ->  ${Math.round(s.fps)} fps\n`;
  }
  // FPS-vs-load curve, right column — beside the stats, clear of both overlays.
  renderer.createTextNode({
    x: 1020,
    y: 210,
    w: 760,
    contain: 'width',
    fontFamily: 'Ubuntu',
    textRendererOverride: 'sdf',
    fontSize: 24,
    lineHeight: 32,
    color: 0x9fb4d8ff, // slate-300 (0xRRGGBBAA)
    zIndex: 100000,
    parent: testRoot,
    text: curve,
  });

  // LIVE GL block, left column — the GL-call sample frozen DURING animation at
  // the final card count (not the idle summary). This is the real per-frame
  // rebind cost: with VAO off, vAttribPtr/enaVAA climb with the draw count and
  // bindVAO stays 0; with VAO on, those are ~0 and bindVAO tracks drawElem.
  const liveBlock =
    liveSpy === true
      ? `LIVE GL @ ${animatedCards} cards (animating)\n` +
        `draws ${capDraws}  quads ${capQuads}\n` +
        `vAttribPtr ${capVAttrib}  enaVAA ${capEnaVAA}\n` +
        `bindVAO ${capBindVao}  drawElem ${capDrawElem}\n` +
        `GL calls/interval: ${capGlTotal}`
      : `LIVE GL @ ${animatedCards} cards (animating)\n` +
        '(add &debug=true to capture per-draw GL-call counts)';
  renderer.createTextNode({
    x: 120,
    y: 670,
    w: 820,
    contain: 'width',
    fontFamily: 'Ubuntu',
    textRendererOverride: 'sdf',
    fontSize: 26,
    lineHeight: 34,
    color: 0x33ff88ff,
    zIndex: 100000,
    parent: testRoot,
    text: liveBlock,
  });

  // Explanatory note: why the top-left panel and the LIVE block can disagree.
  renderer.createTextNode({
    x: 120,
    y: 860,
    w: 820,
    contain: 'width',
    fontFamily: 'Ubuntu',
    textRendererOverride: 'sdf',
    fontSize: 20,
    lineHeight: 28,
    color: 0x94a3b8ff, // slate-400 (0xRRGGBBAA)
    zIndex: 100000,
    parent: testRoot,
    text:
      'Note: the top-left panel now samples the IDLE summary (scene torn\n' +
      'down, drawElem ~10) and understates the per-frame rebind count. The\n' +
      'LIVE GL block above is the animated sample. The relative signature\n' +
      '(zero rebinds with VAO, nonzero without; bindVAO tracking draws) is\n' +
      'exactly as predicted; the FPS curve (right) is the real animated cost.',
  });

  console.log(
    `\n=== stress-animation result (VAO ${sumVao.toUpperCase()}) ===`,
  );
  console.log(
    `${animatedCards} animated cards, ${drawnNodes} nodes drawn, final avg ${finalFps} fps (stopped: ${reason})`,
  );
  if (liveSpy === true) {
    console.log(
      `LIVE GL @ ${animatedCards} cards: vAttribPtr ${capVAttrib}, enaVAA ${capEnaVAA}, bindVAO ${capBindVao}, drawElem ${capDrawElem}, total ${capGlTotal}/interval`,
    );
  }
  console.table(
    steps.map((s) => ({ cards: s.cards, avgFps: Math.round(s.fps) })),
  );
}
