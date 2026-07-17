import { ImageWorkerManager } from './lib/ImageWorker.js';
import type { CoreRenderer } from './renderers/CoreRenderer.js';
import { ColorTexture } from './textures/ColorTexture.js';
import { ImageTexture } from './textures/ImageTexture.js';
import { NoiseTexture } from './textures/NoiseTexture.js';
import { SubTexture } from './textures/SubTexture.js';
import { RenderTexture } from './textures/RenderTexture.js';
import { Texture, TextureType } from './textures/Texture.js';
import type { TextureData } from './textures/Texture.js';
import { EventEmitter } from '../common/EventEmitter.js';
import type { Stage } from './Stage.js';
import {
  validateCreateImageBitmap,
  detectPremultiplyAlphaHonored,
  type CreateImageBitmapSupport,
} from './lib/validateImageBitmap.js';
import type { Platform } from './platforms/Platform.js';
import { TextureError, TextureErrorCode } from './TextureError.js';

/**
 * Augmentable map of texture class types
 *
 * @remarks
 * This interface can be augmented by other modules/apps to add additional
 * texture types. The ones included directly here are the ones that are
 * included in the core library.
 */
export interface TextureMap {
  ColorTexture: typeof ColorTexture;
  ImageTexture: typeof ImageTexture;
  NoiseTexture: typeof NoiseTexture;
  SubTexture: typeof SubTexture;
  RenderTexture: typeof RenderTexture;
}

export type ExtractProps<Type> = Type extends { z$__type__Props: infer Props }
  ? Props
  : never;

/**
 * Contains information about the texture manager's internal state
 * for debugging purposes.
 */
export interface TextureManagerDebugInfo {
  keyCacheSize: number;
}

export interface TextureManagerSettings {
  numImageWorkers: number;
  createImageBitmapSupport: 'auto' | 'basic' | 'options' | 'full';
  // Override for whether createImageBitmap honors premultiplyAlpha:'premultiply'.
  // 'auto' = detect via probe; boolean = force the value and skip the probe.
  premultiplyAlphaHonored: boolean | 'auto';
  maxRetryCount: number;
  // Upper bound on concurrent main-thread fetch+decode operations when no
  // image worker manager exists (numImageWorkers === 0). See CoreTextureManager
  // for how the gate is applied. `0` disables the gate (unbounded).
  imageDecodeConcurrency: number;
}

export type ResizeModeOptions =
  | {
      /**
       * Specifies that the image should be resized to cover the specified dimensions.
       */
      type: 'cover';
      /**
       * The horizontal clipping position
       * To clip the left, set clipX to 0. To clip the right, set clipX to 1.
       * clipX 0.5 will clip a equal amount from left and right
       *
       * @defaultValue 0.5
       */
      clipX?: number;
      /**
       * The vertical clipping position
       * To clip the top, set clipY to 0. To clip the bottom, set clipY to 1.
       * clipY 0.5 will clip a equal amount from top and bottom
       *
       * @defaultValue 0.5
       */
      clipY?: number;
    }
  | {
      /**
       * Specifies that the image should be resized to fit within the specified dimensions.
       */
      type: 'contain';
    };

/**
 * Universal options for all texture types
 *
 * @remarks
 * Texture Options provide a way to specify options that are relevant to the
 * texture loading process (including caching) and specifically for how a
 * texture is rendered within a specific Node (or set of Nodes).
 *
 * They are not used in determining the cache key for a texture (except if
 * the `cacheKey` option is provided explicitly to oveerride the default
 * cache key for the texture instance) nor are they stored/referenced within
 * the texture instance itself. Instead, the options are stored/referenced
 * within individual Nodes. So a single texture instance can be used in
 * multiple Nodes each using a different set of options.
 */
export interface TextureOptions {
  /**
   * Preload the texture immediately even if it's not being rendered to the
   * screen.
   *
   * @remarks
   * This allows the texture to be used immediately without any delay when it
   * is first needed for rendering. Otherwise the loading process will start
   * when the texture is first rendered, which may cause a delay in that texture
   * being shown properly.
   *
   * @defaultValue `false`
   */
  preload?: boolean;

  /**
   * Prevent clean up of the texture when it is no longer being used.
   *
   * @remarks
   * This is useful when you want to keep the texture in memory for later use.
   * Regardless of whether the texture is being used or not, it will not be
   * cleaned up.
   *
   * @defaultValue `false`
   */
  preventCleanup?: boolean;

  /**
   * Number of times to retry loading a failed texture
   *
   * @remarks
   * When a texture fails to load, Lightning will retry up to this many times
   * before permanently giving up. Each retry will clear the texture ownership
   * and then re-establish it to trigger a new load attempt.
   *
   * Set to null to disable retries. Set to 0 to always try once and never retry.
   * This is typically only used on ImageTexture instances.
   *
   */
  maxRetryCount?: number | null;

  /**
   * Flip the texture horizontally when rendering
   *
   * @defaultValue `false`
   */
  flipX?: boolean;

  /**
   * Flip the texture vertically when rendering
   *
   * @defaultValue `false`
   */
  flipY?: boolean;

  /**
   * You can use resizeMode to determine the clipping automatically from the width
   * and height of the source texture. This can be convenient if you are unsure about
   * the exact image sizes but want the image to cover a specific area.
   *
   * The resize modes cover and contain are supported
   */
  resizeMode?: ResizeModeOptions;
}

/**
 * Insertion-ordered, dedup'd FIFO queue used by the texture upload
 * pipeline.
 *
 * Backed by an array (for ordered traversal without per-call iterator
 * allocation) plus a Set (for O(1) membership and cancel-by-reference).
 * Removed entries are tombstoned in the array — they're skipped on the
 * next `shift()`, and the array is compacted once the consumed prefix
 * grows large enough to be worth reclaiming.
 */
class TextureUploadQueue {
  private list: Texture[] = [];
  private membership: Set<Texture> = new Set();
  private head = 0;

  get size(): number {
    return this.membership.size;
  }

  has(texture: Texture): boolean {
    return this.membership.has(texture);
  }

  add(texture: Texture): void {
    if (this.membership.has(texture)) {
      return;
    }
    this.membership.add(texture);
    this.list.push(texture);
  }

  delete(texture: Texture): boolean {
    return this.membership.delete(texture);
  }

  /**
   * Remove and return the oldest live entry, or `undefined` if empty.
   */
  shift(): Texture | undefined {
    const list = this.list;
    const membership = this.membership;
    while (this.head < list.length) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const texture = list[this.head++]!;
      if (membership.has(texture)) {
        membership.delete(texture);
        this.compactIfNeeded();
        return texture;
      }
    }
    // Fully drained — reset for the next batch.
    this.head = 0;
    list.length = 0;
    return undefined;
  }

  private compactIfNeeded(): void {
    // Drop the consumed prefix once it's substantial in absolute terms
    // and at least half the array. Avoids growing the array unboundedly
    // when shift() runs faster than the queue refills.
    if (this.head >= 64 && this.head >= this.list.length >> 1) {
      this.list = this.list.slice(this.head);
      this.head = 0;
    }
  }
}

/**
 * Bounds how many async operations run concurrently.
 *
 * Used to cap main-thread fetch+decode (`getTextureData`) when there are no
 * image workers: on such devices every `createImageBitmap`/decode runs on the
 * main thread, so a scroll that makes dozens of image nodes renderable at once
 * would otherwise fire dozens of decodes back-to-back and starve the render
 * loop. A caller `await`s {@link acquire} before the work and calls
 * {@link release} in a `finally` after it.
 *
 * The in-flight slot is handed straight from a releaser to the next waiter, so
 * the active count never dips below `limit` while work is pending.
 *
 * Exported for unit testing; not part of the public renderer surface.
 */
export class ConcurrencyGate {
  private inFlight = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  acquire(): Promise<void> {
    if (this.inFlight < this.limit) {
      this.inFlight++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.waiters.push(resolve);
    });
  }

  release(): void {
    const next = this.waiters.shift();
    if (next !== undefined) {
      // Transfer the slot to the next waiter without touching the count —
      // one operation left, one is starting, so `inFlight` is unchanged.
      next();
      return;
    }
    this.inFlight--;
  }
}

export class CoreTextureManager extends EventEmitter {
  /**
   * Map of textures by cache key
   */
  keyCache: Map<string, Texture> = new Map();

  /**
   * Map of texture constructors by their type name
   */
  txConstructors: Partial<TextureMap> = {};

  public maxRetryCount: number;
  private uploadTextureQueue: TextureUploadQueue = new TextureUploadQueue();
  private initialized = false;
  private stage: Stage;
  private numImageWorkers: number;
  private imageDecodeConcurrency: number;
  /**
   * Caps concurrent main-thread fetch+decode. Non-null only when there is no
   * image worker manager (workers already bound concurrency by pool size).
   * Assigned in {@link initialize} once worker availability is known.
   */
  private decodeGate: ConcurrencyGate | null = null;

  public platform: Platform;

  get pixelRatio(): number {
    return this.stage.pixelRatio;
  }

  imageWorkerManager: ImageWorkerManager | null = null;
  hasCreateImageBitmap = false;
  imageBitmapSupported = {
    basic: false,
    options: false,
    full: false,
    premultiplyHonored: null as boolean | null,
  };

  hasWorker = !!self.Worker;
  /**
   * Renderer that this texture manager is associated with
   *
   * @remarks
   * This MUST be set before the texture manager is used. Otherwise errors
   * will occur when using the texture manager.
   */
  renderer!: CoreRenderer;

  /**
   * The current frame time in milliseconds
   *
   * @remarks
   * This is used to populate the `lastRenderableChangeTime` property of
   * {@link Texture} instances when their renderable state changes.
   *
   * Set by stage via `updateFrameTime` method.
   */
  frameTime = 0;

  constructor(stage: Stage, settings: TextureManagerSettings) {
    super();

    const {
      numImageWorkers,
      createImageBitmapSupport,
      premultiplyAlphaHonored,
      maxRetryCount,
      imageDecodeConcurrency,
    } = settings;

    this.stage = stage;
    this.platform = stage.platform;
    this.numImageWorkers = numImageWorkers;
    this.maxRetryCount = maxRetryCount;
    this.imageDecodeConcurrency = imageDecodeConcurrency;

    if (createImageBitmapSupport === 'auto') {
      validateCreateImageBitmap(this.platform)
        .then((result) => {
          this.resolvePremultiplyAndInit(result, premultiplyAlphaHonored);
        })
        .catch(() => {
          console.warn(
            '[Lightning] createImageBitmap is not supported on this browser. ImageTexture will be slower.',
          );

          // initialized without image worker manager and createImageBitmap
          this.initialized = true;
          this.emit('initialized');
        });
    } else {
      this.resolvePremultiplyAndInit(
        {
          basic: createImageBitmapSupport === 'basic',
          options: createImageBitmapSupport === 'options',
          full: createImageBitmapSupport === 'full',
          premultiplyHonored: null,
        },
        premultiplyAlphaHonored,
      );
    }

    this.registerTextureType('ImageTexture', ImageTexture);
    this.registerTextureType('ColorTexture', ColorTexture);
    this.registerTextureType('NoiseTexture', NoiseTexture);
    this.registerTextureType('SubTexture', SubTexture);
    this.registerTextureType('RenderTexture', RenderTexture);
  }

  registerTextureType<Type extends keyof TextureMap>(
    textureType: Type,
    textureClass: TextureMap[Type],
  ): void {
    this.txConstructors[textureType] = textureClass;
  }

  /**
   * Resolve `premultiplyHonored` on the support object, then initialize.
   *
   * - boolean override -> use it directly, skip the probe
   * - 'auto' -> run the detection probe (only meaningful when the options/full
   *   API exists, since that's the only path that passes the premultiply option)
   */
  private resolvePremultiplyAndInit(
    support: CreateImageBitmapSupport,
    premultiplyAlphaHonored: boolean | 'auto',
  ): void {
    if (premultiplyAlphaHonored !== 'auto') {
      support.premultiplyHonored = premultiplyAlphaHonored;
      this.initialize(support);
      return;
    }

    if (support.options === false && support.full === false) {
      support.premultiplyHonored = null;
      this.initialize(support);
      return;
    }

    detectPremultiplyAlphaHonored(this.platform)
      .then((honored) => {
        support.premultiplyHonored = honored;
        this.initialize(support);
      })
      .catch(() => {
        support.premultiplyHonored = null;
        this.initialize(support);
      });
  }

  private initialize(support: CreateImageBitmapSupport) {
    this.hasCreateImageBitmap =
      support.basic || support.options || support.full;
    this.imageBitmapSupported = support;

    if (support.premultiplyHonored === false) {
      console.warn(
        '[Lightning] createImageBitmap premultiplyAlpha:"premultiply" is not honored on this device — images may show alpha ghosting. GL-side premultiply fallback recommended.',
      );
    }

    if (this.hasCreateImageBitmap === false) {
      console.warn(
        '[Lightning] createImageBitmap is not supported on this browser. ImageTexture will be slower.',
      );
    }

    if (
      this.hasCreateImageBitmap === true &&
      this.hasWorker === true &&
      this.numImageWorkers > 0
    ) {
      this.imageWorkerManager = new ImageWorkerManager(
        this.numImageWorkers,
        support,
      );
    } else {
      console.warn(
        '[Lightning] Image worker count is 0 or workers are not supported on this browser. Image loading will be slower.',
      );
    }

    // Without an image worker manager, every fetch+decode runs on the main
    // thread. Bound how many run at once so a burst (e.g. a scroll that makes
    // many image nodes renderable in one tick) can't serialize dozens of
    // decodes and starve the render loop. With workers, the pool already caps
    // concurrency, so the gate stays null (no main-thread ceiling needed).
    //
    // Scope: this bounds the `createImageBitmap` decode, which happens inside
    // `getTextureData` (see `loadTexture`). On the `<img>` fallback path
    // (`hasCreateImageBitmap === false`) the image decodes lazily and the real
    // main-thread cost is the synchronous `texImage2D` at upload, which the
    // gate does not cover — the per-frame upload budget (`processUntil`) paces
    // that instead. The gate is therefore most effective on the
    // createImageBitmap(-polyfill) path.
    if (this.imageWorkerManager === null && this.imageDecodeConcurrency > 0) {
      this.decodeGate = new ConcurrencyGate(this.imageDecodeConcurrency);
    }

    this.initialized = true;
    this.emit('initialized');

    // Anything that arrived before initialization completed is now safe to
    // process. Without this, queued textures would sit until the next frame
    // tick happens to drain them.
    if (this.uploadTextureQueue.size > 0) {
      this.processUntil(Infinity).catch((err) => {
        console.error('Failed to drain pre-init texture queue:', err);
      });
    }
  }

  /**
   * Enqueue a texture for uploading to the GPU.
   *
   * @param texture - The texture to upload
   */
  enqueueUploadTexture(texture: Texture): void {
    if (texture.state === 'failed' || texture.state === 'freed') {
      return;
    }
    this.uploadTextureQueue.add(texture);
  }

  /**
   * Create a texture
   *
   * @param textureType - The type of texture to create
   * @param props - The properties to use for the texture
   */
  createTexture<Type extends keyof TextureMap>(
    textureType: Type,
    props: ExtractProps<TextureMap[Type]>,
  ): InstanceType<TextureMap[Type]> {
    const TextureClass = this.txConstructors[textureType];
    if (!TextureClass) {
      throw new TextureError(
        TextureErrorCode.TEXTURE_TYPE_NOT_REGISTERED,
        `Texture type "${textureType}" is not registered`,
      );
    }

    // Cache key is computed from raw props (each Texture's makeCacheKey
    // inlines its own defaults) so we can skip the resolveDefaults
    // allocation on a cache hit.
    const cacheKey = TextureClass.makeCacheKey(props as any);
    if (cacheKey) {
      const cached = this.keyCache.get(cacheKey);
      if (cached) {
        return cached as InstanceType<TextureMap[Type]>;
      }
    }

    const resolvedProps = TextureClass.resolveDefaults(props as any);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
    const texture = new TextureClass(this, resolvedProps as any);

    if (cacheKey) {
      this.initTextureToCache(texture, cacheKey);
    }

    return texture as InstanceType<TextureMap[Type]>;
  }

  /**
   * Override loadTexture to use the batched approach.
   *
   * @param texture - The texture to load
   * @param immediate - Whether to prioritize the texture for immediate loading
   */
  async loadTexture(texture: Texture, priority?: boolean): Promise<void> {
    if (texture.type === TextureType.subTexture) {
      // ignore subtextures - they get loaded through their parent
      return;
    }

    if (texture.state === 'loaded') {
      // if the texture is already loaded, just return
      return;
    }

    // if we're not initialized, just queue the texture into the upload queue
    if (this.initialized === false) {
      this.uploadTextureQueue.add(texture);
      return;
    }

    texture.setState('loading');

    // Bound concurrent main-thread fetch+decode. Priority (on-screen) textures
    // bypass the gate so they never wait behind off-screen prefetch decodes.
    // `decodeGate` is null when image workers handle decoding off-thread.
    const gate = priority === true ? null : this.decodeGate;
    if (gate !== null) {
      await gate.acquire();
    }

    // Get texture data - early return on failure
    let textureDataResult: TextureData | null;
    try {
      textureDataResult = await texture.getTextureData().catch((err) => {
        console.error(err);
        texture.setState(
          'failed',
          new TextureError(TextureErrorCode.TEXTURE_DATA_NULL),
        );
        return null;
      });
    } finally {
      if (gate !== null) {
        gate.release();
      }
    }

    // Early return if texture data fetch failed
    if (textureDataResult === null || texture.state === 'failed') {
      return;
    }

    // Handle non-image textures: upload immediately
    const shouldUploadImmediately =
      texture.type !== TextureType.image || priority === true;
    if (shouldUploadImmediately === true) {
      await this.uploadTexture(texture).catch((err) => {
        console.error(`Failed to upload texture:`, err);
        texture.setState(
          'failed',
          new TextureError(
            TextureErrorCode.TEXTURE_UPLOAD_FAILED,
            err instanceof Error ? err.message : undefined,
          ),
        );
      });
      return;
    }

    // Queue image textures for throttled upload
    this.enqueueUploadTexture(texture);
  }

  /**
   * Upload a texture to the GPU
   *
   * @param texture Texture to upload
   * @returns Promise that resolves when the texture is fully loaded
   */
  async uploadTexture(texture: Texture): Promise<void> {
    if (
      this.stage.txMemManager.doNotExceedCriticalThreshold === true &&
      this.stage.txMemManager.criticalCleanupRequested === true
    ) {
      // we're at a critical memory threshold, don't upload textures
      texture.setState(
        'failed',
        new TextureError(TextureErrorCode.MEMORY_THRESHOLD_EXCEEDED),
      );
      return;
    }

    if (texture.state === 'failed' || texture.state === 'freed') {
      // don't upload failed or freed textures
      return;
    }

    if (texture.state === 'loaded') {
      // already loaded
      return;
    }

    if (texture.textureData === null) {
      texture.setState(
        'failed',
        new TextureError(
          TextureErrorCode.TEXTURE_DATA_NULL,
          'Texture data is null, cannot upload texture',
        ),
      );
      return;
    }

    const coreContext = texture.loadCtxTexture();
    if (coreContext.state === 'loaded') {
      texture.setState('loaded');
      return;
    }

    await coreContext.load();
  }

  /**
   * Check if a texture is being processed
   */
  isProcessingTexture(texture: Texture): boolean {
    return this.uploadTextureQueue.has(texture);
  }

  /**
   * Upload a single queued texture to the GPU.
   *
   * @remarks
   * Used while animations are running so uploads don't steal time from the
   * animation. If the dequeued texture already died (failed/freed), nothing is
   * uploaded this frame and the next call handles the following one.
   */
  async processOne(): Promise<void> {
    if (this.initialized === false) {
      return;
    }

    const texture = this.uploadTextureQueue.shift();
    if (texture === undefined) {
      return;
    }

    await this.uploadQueued(texture);
  }

  /**
   * Upload queued textures to the GPU until the per-frame time budget runs out.
   *
   * @remarks
   * Called once per frame when idle. Textures are uploaded one-by-one; after
   * each, the elapsed time is rechecked and processing stops once it exceeds
   * `maxProcessingTime`, leaving the rest queued for the next frame.
   *
   * In normal operation a queued texture's data is already decoded
   * (`loadTexture` awaits `getTextureData` before enqueuing), so this budgets
   * GPU upload time. Pass `Infinity` to drain the whole queue.
   *
   * @param maxProcessingTime - The time budget for this frame, in milliseconds
   */
  async processUntil(maxProcessingTime: number): Promise<void> {
    if (this.initialized === false) {
      return;
    }

    const platform = this.platform;
    const startTime = platform.getTimeStamp();

    while (platform.getTimeStamp() - startTime < maxProcessingTime) {
      const texture = this.uploadTextureQueue.shift();
      if (texture === undefined) {
        // Queue drained.
        break;
      }

      await this.uploadQueued(texture);
    }
  }

  /**
   * Decode (if needed) and upload a single already-dequeued texture.
   *
   * @remarks
   * Shared by {@link processOne} and {@link processUntil}. Dead (failed/freed)
   * textures and upload failures are skipped without throwing.
   */
  private async uploadQueued(texture: Texture): Promise<void> {
    if (this.isTextureDead(texture)) {
      return;
    }

    try {
      if (texture.textureData === null) {
        await texture.getTextureData();
      }
      if (this.isTextureDead(texture)) {
        return;
      }
      await this.uploadTexture(texture);
    } catch (error) {
      console.error('Failed to upload texture:', error);
      // Skip this texture instead of stalling the queue.
    }
  }

  /**
   * A texture is "dead" once it has failed or been freed — both terminal for
   * the upload pipeline.
   *
   * @remarks
   * Kept as a method rather than an inline check so TypeScript doesn't
   * permanently narrow `state` after the first comparison: the property is
   * mutable and can transition across the awaits in {@link uploadQueued}.
   */
  private isTextureDead(texture: Texture): boolean {
    return texture.state === 'failed' || texture.state === 'freed';
  }

  public hasUpdates(): boolean {
    return this.uploadTextureQueue.size > 0;
  }

  /**
   * Initialize a texture to the cache
   *
   * @param texture Texture to cache
   * @param cacheKey Cache key for the texture
   */
  initTextureToCache(texture: Texture, cacheKey: string) {
    this.keyCache.set(cacheKey, texture);
    texture.cacheKey = cacheKey;
  }

  /**
   * Get a texture from the cache
   *
   * @param cacheKey
   */
  getTextureFromCache(cacheKey: string): Texture | undefined {
    return this.keyCache.get(cacheKey);
  }

  /**
   * Remove a texture from the cache
   *
   * @remarks
   * Called by Texture Cleanup when a texture is freed.
   *
   * @param texture
   */
  removeTextureFromCache(texture: Texture) {
    const cacheKey = texture.cacheKey;
    if (cacheKey !== null) {
      this.keyCache.delete(cacheKey);
      texture.cacheKey = null;
    }
  }

  /**
   * Remove texture from the upload queue
   *
   * @param texture - The texture to remove
   */
  removeTextureFromQueue(texture: Texture): void {
    this.uploadTextureQueue.delete(texture);
  }

  /**
   * Resolve a parent texture from the cache or fallback to the provided texture.
   *
   * @param texture - The provided texture to resolve.
   * @returns The cached or provided texture.
   */
  resolveParentTexture(texture: ImageTexture): Texture {
    if (!texture?.props) {
      return texture;
    }

    const cacheKey = ImageTexture.makeCacheKey(texture.props);
    const cachedTexture = cacheKey
      ? this.getTextureFromCache(cacheKey)
      : undefined;
    return cachedTexture ?? texture;
  }
}
