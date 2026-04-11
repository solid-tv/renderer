import { isProductionEnvironment } from '../utils.js';
import type { Stage } from './Stage.js';
import { Texture, TextureType } from './textures/Texture.js';
import { bytesToMb } from './utils.js';

export interface TextureMemoryManagerSettings {
  /**
   * Critical Threshold (in bytes)
   *
   * @remarks
   * When the amount of memory used by textures exceeds this threshold,
   * the Renderer will immediately trigger a Texture Cleanup towards the
   * Target Threshold Level.
   *
   * When set to `0`, the Texture Memory Manager is disabled.
   *
   * @defaultValue `124e6` (118 MB)
   */
  criticalThreshold: number;

  /**
   * Target Threshold Level (as fraction of Critical Threshold)
   *
   * @remarks
   * This value is the fractional level of the Critical Threshold that the
   * Texture Memory Manager will attempt to maintain by cleaning up textures.
   * The Texture Memory Manager will attempt to keep the memory usage below
   * this level by freeing up non-renderable textures.
   *
   * Valid Range: 0.0 - 1.0
   *
   * @defaultValue `0.5`
   */
  targetThresholdLevel: number;

  /**
   * Interval between non-aggressive Texture Cleanups (in milliseconds)
   *
   * @remarks
   * Texture Memory Manager will perform a non aggressive Texture Cleanup no more
   * frequently than this interval when the scene becomes idle.
   *
   * @defaultValue `5,000` (5 seconds)
   */
  cleanupInterval: number;

  /**
   * Whether or not to log debug information
   *
   * @defaultValue `false`
   */
  debugLogging: boolean;

  /**
   * Baseline memory allocation for the Texture Memory Manager
   *
   * @remarks
   * Baseline texture memory is an allocation of memory by simply having a 1080p WebGL context.
   * This will be used on top of the memory used by textures to determine when to trigger a cleanup.
   *
   * @defaultValue `25e6` (25 MB)
   */
  baselineMemoryAllocation: number;

  /**
   * Do not exceed critical threshold
   *
   * @defaultValue `false`
   */
  doNotExceedCriticalThreshold: boolean;
}

export interface MemoryInfo {
  criticalThreshold: number;
  targetThreshold: number;
  renderableMemUsed: number;
  memUsed: number;
  renderableTexturesLoaded: number;
  loadedTextures: number;
  baselineMemoryAllocation: number;
}

/**
 * LRU (Least Recently Used) style memory manager for textures
 *
 * @remarks
 * This class is responsible for managing the memory usage of textures
 * in the Renderer. It keeps track of the memory used by each texture
 * and triggers a cleanup when the memory usage exceeds a critical
 * threshold (`criticalThreshold`).
 *
 * The cleanup process will free up non-renderable textures until the
 * memory usage is below a target threshold (`targetThresholdLevel`).
 *
 * The memory manager's clean up process will also be triggered when the
 * scene is idle for a certain amount of time (`cleanupInterval`).
 */
export class TextureMemoryManager {
  private memUsed = 0;
  private loadedTextures: Set<Texture> = new Set();
  private orphanedTextures: Set<Texture> = new Set();
  private criticalThreshold: number = 124e6;
  private targetThreshold: number = 0.5;
  private cleanupInterval: number = 5000;
  private debugLogging: boolean = false;
  private loggingID: ReturnType<typeof setInterval> =
    0 as unknown as ReturnType<typeof setInterval>;
  private lastCleanupTime = 0;
  private baselineMemoryAllocation: number = 26e6;

  private hasWarnedAboveCritical = false;

  public criticalCleanupRequested = false;
  public doNotExceedCriticalThreshold: boolean = false;

  /**
   * The current frame time in milliseconds
   *
   * @remarks
   * This is used to determine when to perform Idle Texture Cleanups.
   *
   * Set by stage via `updateFrameTime` method.
   */
  public frameTime = 0;

  constructor(private stage: Stage, settings: TextureMemoryManagerSettings) {
    this.updateSettings(settings);
  }

  /**
   * Add a texture to the orphaned textures list
   *
   * @param texture - The texture to add to the orphaned textures list
   */
  addToOrphanedTextures(texture: Texture) {
    // if the texture is already in the orphaned textures list add it at the end
    if (this.orphanedTextures.has(texture)) {
      this.orphanedTextures.delete(texture);
    }

    // If the texture can be cleaned up, add it to the orphaned textures list
    if (texture.preventCleanup === false) {
      this.orphanedTextures.add(texture);
    }
  }

  /**
   * Remove a texture from the orphaned textures list
   *
   * @param texture - The texture to remove from the orphaned textures list
   */
  removeFromOrphanedTextures(texture: Texture) {
    this.orphanedTextures.delete(texture);
  }

  /**
   * Set the memory usage of a texture
   *
   * @param texture - The texture to set memory usage for
   * @param byteSize - The size of the texture in bytes
   */
  setTextureMemUse(texture: Texture, byteSize: number) {
    // Update global memory counter by subtracting old value
    this.memUsed -= texture.memUsed;

    if (byteSize === 0) {
      // PERFORMANCE: Mark for deletion, slot will be reused later
      this.loadedTextures.delete(texture);
      texture.memUsed = 0;
      return;
    } else {
      // Update texture memory and add to tracking if not already present
      texture.memUsed = byteSize;
      this.memUsed += byteSize;
      this.loadedTextures.add(texture);
    }

    if (this.memUsed > this.criticalThreshold) {
      this.criticalCleanupRequested = true;
    }
  }

  checkCleanup() {
    return (
      this.criticalCleanupRequested ||
      (this.memUsed > this.targetThreshold &&
        this.frameTime - this.lastCleanupTime >= this.cleanupInterval)
    );
  }

  checkCriticalCleanup() {
    return this.memUsed > this.criticalThreshold;
  }

  /**
   * Destroy a texture and remove it from the memory manager
   *
   * @param texture - The texture to destroy
   */
  destroyTexture(texture: Texture) {
    if (this.debugLogging === true) {
      console.log(
        `[TextureMemoryManager] Destroying texture. State: ${texture.state}`,
      );
    }

    // PERFORMANCE: Null out array position, slot will be reused later
    this.loadedTextures.delete(texture);

    // Destroy texture and update memory counters
    const txManager = this.stage.txManager;
    txManager.removeTextureFromCache(texture);

    texture.destroy();

    // Update memory counters
    this.memUsed -= texture.memUsed;
    texture.memUsed = 0;
  }

  cleanup(full: boolean = false) {
    const critical = this.criticalCleanupRequested;
    this.lastCleanupTime = this.frameTime;

    if (critical === true) {
      this.stage.queueFrameEvent('criticalCleanup', {
        memUsed: this.memUsed,
        criticalThreshold: this.criticalThreshold,
      });
    }

    if (this.debugLogging === true) {
      console.log(
        `[TextureMemoryManager] Cleaning up textures. Critical: ${critical}. Full: ${full}`,
      );
    }

    // Free non-renderable textures until we reach the target threshold
    const memTarget = critical ? this.criticalThreshold : this.targetThreshold;

    // PERFORMANCE: Zero-overhead cleanup with null marking
    // Skip null entries, mark cleaned textures as null for later defrag
    let currentMemUsed = this.memUsed;

    for (const texture of this.loadedTextures) {
      // Early exit: target memory reached
      if (full === false && currentMemUsed < memTarget) {
        break;
      }

      // Fast type check for cleanable textures
      const isCleanableType =
        texture.type === TextureType.image ||
        texture.type === TextureType.noise ||
        texture.type === TextureType.renderToTexture;

      // Immediate cleanup if eligible
      if (isCleanableType && texture.canBeCleanedUp() === true) {
        // Get memory before destroying
        const textureMemory = texture.memUsed;

        // Destroy texture (which will null out the array position)
        this.destroyTexture(texture);
        currentMemUsed -= textureMemory;
      }
    }

    if (this.memUsed >= this.criticalThreshold) {
      this.stage.queueFrameEvent('criticalCleanupFailed', {
        memUsed: this.memUsed,
        criticalThreshold: this.criticalThreshold,
      });
      // Only emit the warning once per over-threshold period
      if (
        !this.hasWarnedAboveCritical &&
        (this.debugLogging === true || isProductionEnvironment === false)
      ) {
        console.warn(
          `[TextureMemoryManager] Memory usage above critical threshold after cleanup: ${this.memUsed}`,
        );

        this.hasWarnedAboveCritical = true;
      }
    } else {
      this.criticalCleanupRequested = false;
      this.hasWarnedAboveCritical = false;
    }
  }

  /**
   * Get the current texture memory usage information
   *
   * @remarks
   * This method is for debugging purposes and returns information about the
   * current memory usage of the textures in the Renderer.
   */
  getMemoryInfo(): MemoryInfo {
    let renderableTexturesLoaded = 0;
    let renderableMemUsed = this.baselineMemoryAllocation;

    for (const texture of this.loadedTextures) {
      if (texture && texture.renderable) {
        renderableTexturesLoaded += 1;
        renderableMemUsed += texture.memUsed;
      }
    }

    // Count non-null entries for accurate loaded texture count
    const actualLoadedTextures = this.loadedTextures.size;

    return {
      criticalThreshold: this.criticalThreshold,
      targetThreshold: this.targetThreshold,
      renderableMemUsed,
      memUsed: this.memUsed,
      renderableTexturesLoaded,
      loadedTextures: actualLoadedTextures,
      baselineMemoryAllocation: this.baselineMemoryAllocation,
    };
  }

  public updateSettings(settings: TextureMemoryManagerSettings): void {
    const { criticalThreshold, doNotExceedCriticalThreshold } = settings;

    this.doNotExceedCriticalThreshold = doNotExceedCriticalThreshold || false;
    this.criticalThreshold = Math.round(criticalThreshold);

    if (this.memUsed === 0) {
      this.memUsed = Math.round(settings.baselineMemoryAllocation);
    } else {
      const memUsedExBaseline = this.memUsed - this.baselineMemoryAllocation;
      this.memUsed = Math.round(
        settings.baselineMemoryAllocation + memUsedExBaseline,
      );
    }
    this.baselineMemoryAllocation = Math.round(
      settings.baselineMemoryAllocation,
    );
    const targetFraction = Math.max(
      0,
      Math.min(1, settings.targetThresholdLevel),
    );
    this.targetThreshold = Math.max(
      Math.round(criticalThreshold * targetFraction),
      this.baselineMemoryAllocation,
    );

    this.cleanupInterval = settings.cleanupInterval;
    this.debugLogging = settings.debugLogging;

    if (this.loggingID && !settings.debugLogging) {
      clearInterval(this.loggingID);
      this.loggingID = 0 as unknown as ReturnType<typeof setInterval>;
    }
    if (settings.debugLogging && !this.loggingID) {
      let lastMemUse = 0;
      this.loggingID = setInterval(() => {
        if (lastMemUse !== this.memUsed) {
          lastMemUse = this.memUsed;
          console.log(
            `[TextureMemoryManager] Memory used: ${bytesToMb(
              this.memUsed,
            )} mb / ${bytesToMb(this.criticalThreshold)} mb (${(
              (this.memUsed / this.criticalThreshold) *
              100
            ).toFixed(1)}%)`,
          );
        }
      }, 1000);
    }

    // If the threshold is 0, we disable the memory manager by replacing the
    // setTextureMemUse method with a no-op function.
    if (criticalThreshold === 0) {
      this.setTextureMemUse = () => {};
    }
  }
}
