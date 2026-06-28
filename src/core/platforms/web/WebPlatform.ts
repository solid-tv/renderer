import { Platform } from '../Platform.js';
import type { Stage } from '../../Stage.js';

/**
 * make fontface add not show errors
 */
interface FontFaceSetWithAdd extends FontFaceSet {
  add(font: FontFace): void;
}

export class WebPlatform extends Platform {
  ////////////////////////
  // Platform-specific methods
  ////////////////////////

  override createCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    return canvas;
  }

  override getElementById(id: string): HTMLElement | null {
    return document.getElementById(id);
  }

  ////////////////////////
  // Update loop
  ////////////////////////

  override startLoop(stage: Stage): void {
    let isIdle = false;
    let lastFrameTime = 0;
    // Set by `tick` once it has queued the next frame; read by `runLoop`'s catch
    // so a throw after scheduling never double-schedules (which would compound
    // into runaway frames if it threw every frame). Reset at the top of each frame.
    let scheduled = false;
    const buffer = 4;

    const requestLoop = () => requestAnimationFrame(runLoop);

    // All per-frame work lives in `tick`, deliberately split out of `runLoop`.
    // `runLoop` carries the try/catch that keeps the loop alive, and some
    // optimizing compilers — notably Chrome 38's Crankshaft, our language floor —
    // refuse to optimize any function that contains a try/catch. Keeping that
    // guard in a near-empty shell confines the de-opt to the shell: every hot
    // operation (the `stage.*` calls below, run every frame) stays in fully
    // optimizable functions. `tick` is also where all client-supplied code runs
    // (synchronous event subscribers, the events drained by `flushFrameEvents`,
    // and animation steps) — i.e. everything that can actually throw.
    const tick = (currentTime: number) => {
      // The GL context is lost and the engine does not rebuild it in place.
      // Stop the loop entirely (no reschedule) so we issue no GL calls against
      // a dead context. Recovery is via app reload (see the `contextLost` event).
      if (stage.isContextLost === true) {
        return;
      }

      const targetFrameTime = stage.targetFrameTime;

      // Frame Limiting logic
      if (targetFrameTime > 0) {
        // Calculate elapsed time since the last frame
        const elapsed = currentTime - lastFrameTime;

        // If not enough time has passed, skip this frame
        if (elapsed < targetFrameTime) {
          const wait = targetFrameTime - elapsed;

          if (wait > buffer) {
            setTimeout(requestLoop, wait - buffer);
          } else {
            requestAnimationFrame(runLoop);
          }
          scheduled = true;
          return;
        }

        // Adjust lastFrameTime to maintain the target FPS
        lastFrameTime = currentTime - (elapsed % targetFrameTime);
      } else {
        lastFrameTime = currentTime;
      }

      stage.updateFrameTime();
      const hasActiveAnimations = stage.updateAnimations();

      if (!stage.hasSceneUpdates()) {
        // We still need to calculate the fps else it looks like the app is frozen
        stage.calculateFps();

        // We use 15ms instead of 16.6ms to provide a safety buffer.
        // This ensures we wake up slightly before the next frame to check for updates,
        // preventing us from missing a frame due to timer variances.
        setTimeout(requestLoop, Math.max(targetFrameTime, 15));
        scheduled = true;

        if (isIdle === false) {
          // The render burst has settled. Probe for a GPU out-of-memory now
          // rather than every frame: GL errors accumulate and persist until
          // drained, so a single check here still catches any OOM raised during
          // the active frames, without paying the getError() CPU/GPU sync on
          // every frame. Queues the `outOfMemory` event, flushed below.
          if (stage.renderer.checkForOutOfMemory() === true) {
            stage.txMemManager.handleOutOfMemory();
          }
          stage.shManager.cleanup();
          stage.cleanupTextRenderers();
          stage.eventBus.emit('idle');
          isIdle = true;
        }

        if (stage.txMemManager.checkCleanup() === true) {
          stage.txMemManager.cleanup();
        }

        stage.flushFrameEvents();
        return;
      }

      isIdle = false;
      stage.drawFrame(hasActiveAnimations);
      stage.flushFrameEvents();

      // Schedule next frame
      requestAnimationFrame(runLoop);
      scheduled = true;
    };

    const runLoop = (currentTime: number = 0) => {
      // `tick` runs client-supplied code every frame; a throw there would
      // otherwise propagate out of the rAF callback and permanently stop the
      // render loop — the whole app freezes until reload. Guard it and always
      // keep the loop alive: hand the error to `handleLoopError` (a no-op by
      // default; the app can override it to log/report) and reschedule unless
      // `tick` already queued the next frame before throwing.
      scheduled = false;
      try {
        tick(currentTime);
      } catch (error: unknown) {
        const handleLoopError = stage.options.handleLoopError;
        if (handleLoopError !== undefined) {
          handleLoopError(error);
        }
        if (scheduled === false) {
          requestAnimationFrame(runLoop);
        }
      }
    };

    requestAnimationFrame(runLoop);
  }

  ////////////////////////
  // ImageBitmap
  ////////////////////////

  override createImageBitmap(
    blob: ImageBitmapSource,
    sxOrOptions?: number | ImageBitmapOptions,
    sy?: number,
    sw?: number,
    sh?: number,
    options?: ImageBitmapOptions,
  ): Promise<ImageBitmap> {
    if (typeof sxOrOptions === 'number') {
      return createImageBitmap(
        blob,
        sxOrOptions,
        sy ?? 0,
        sw ?? 0,
        sh ?? 0,
        options,
      );
    } else {
      return createImageBitmap(blob, sxOrOptions);
    }
  }

  getTimeStamp(): number {
    return Date.now();
  }

  override addFont(font: FontFace): void {
    (document.fonts as FontFaceSetWithAdd).add(font);
  }
}
