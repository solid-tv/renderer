import type { CreateImageBitmapSupport } from '../lib/validateImageBitmap.js';
import { type TextureData } from '../textures/Texture.js';

type MessageCallback = [(value: any) => void, (reason: any) => void];
interface getImageReturn {
  data: ImageBitmap;
  premultiplyAlpha: boolean | null;
}

interface ImageWorkerMessage {
  id: number;
  src: string;
  data: getImageReturn;
  error: string;
  sx: number | null;
  sy: number | null;
  sw: number | null;
  sh: number | null;
}

/**
 * Note that, within the createImageWorker function, we must only use ES5 code to keep it ES5-valid after babelifying, as
 *  the converted code of this section is converted to a blob and used as the js of the web worker thread.
 *
 * The createImageWorker function is a web worker that fetches an image from a URL and returns an ImageBitmap object.
 * The eslint @typescript rule is disabled for the entire function because the function is converted to a blob and used as the
 * js of the web worker thread, so the typescript syntax is not valid in this context.
 */

/* eslint-disable */
function createImageWorker() {
  function hasAlphaChannel(mimeType: string) {
    return mimeType.indexOf('image/png') !== -1;
  }

  function getImage(
    src: string,
    premultiplyAlpha: boolean | null,
    x: number | null,
    y: number | null,
    width: number | null,
    height: number | null,
    options: {
      supportsOptionsCreateImageBitmap: boolean;
      supportsFullCreateImageBitmap: boolean;
      premultiplyAlphaHonored: boolean;
    },
  ): Promise<getImageReturn> {
    return new Promise(function (resolve, reject) {
      var supportsOptionsCreateImageBitmap =
        options.supportsOptionsCreateImageBitmap;
      var supportsFullCreateImageBitmap = options.supportsFullCreateImageBitmap;
      var premultiplyAlphaHonored = options.premultiplyAlphaHonored;
      var xhr = new XMLHttpRequest();
      xhr.open('GET', src, true);
      xhr.responseType = 'blob';

      xhr.onload = function () {
        // On most devices like WebOS and Tizen, the file protocol returns 0 while http(s) protocol returns 200
        if (xhr.status !== 200 && xhr.status !== 0) {
          return reject(
            new Error(
              `Image loading failed. HTTP status code: ${
                xhr.status || 'N/A'
              }. URL: ${src}`,
            ),
          );
        }

        var blob = xhr.response;
        var withAlphaChannel =
          premultiplyAlpha !== undefined && premultiplyAlpha !== null
            ? premultiplyAlpha
            : hasAlphaChannel(blob.type);

        // When the device ignores the createImageBitmap premultiply option,
        // create a straight ('none') bitmap and let WebGL premultiply on
        // upload. `premultiplyAlpha` in the resolved value means "WebGL should
        // premultiply this source on upload".
        var useGlPremultiply =
          withAlphaChannel === true && premultiplyAlphaHonored === false;
        var bitmapMode: 'premultiply' | 'none' =
          withAlphaChannel === true && useGlPremultiply === false
            ? 'premultiply'
            : 'none';

        // createImageBitmap with crop and options
        if (
          supportsFullCreateImageBitmap === true &&
          width !== null &&
          height !== null
        ) {
          createImageBitmap(blob, x || 0, y || 0, width, height, {
            premultiplyAlpha: bitmapMode,
            colorSpaceConversion: 'none',
            imageOrientation: 'none',
          })
            .then(function (data) {
              resolve({ data: data, premultiplyAlpha: useGlPremultiply });
            })
            .catch(function (error) {
              reject(error);
            });
          return;
        } else if (
          supportsOptionsCreateImageBitmap === false &&
          supportsFullCreateImageBitmap === false
        ) {
          // Fallback for browsers that do not support createImageBitmap with options
          // this is supported for Chrome v50 to v52/54 that doesn't support options.
          // The browser default premultiplies, so WebGL must not premultiply again.
          createImageBitmap(blob)
            .then(function (data) {
              resolve({ data: data, premultiplyAlpha: false });
            })
            .catch(function (error) {
              reject(error);
            });
        } else {
          createImageBitmap(blob, {
            premultiplyAlpha: bitmapMode,
            colorSpaceConversion: 'none',
            imageOrientation: 'none',
          })
            .then(function (data) {
              resolve({ data: data, premultiplyAlpha: useGlPremultiply });
            })
            .catch(function (error) {
              reject(error);
            });
        }
      };

      xhr.onerror = function () {
        reject(
          new Error('Network error occurred while trying to fetch the image.'),
        );
      };

      xhr.send();
    });
  }

  self.onmessage = (event) => {
    var src = event.data.src;
    var id = event.data.id;
    var premultiplyAlpha = event.data.premultiplyAlpha;
    var x = event.data.sx;
    var y = event.data.sy;
    var width = event.data.sw;
    var height = event.data.sh;

    // these will be set to true if the browser supports the createImageBitmap options or full
    var supportsOptionsCreateImageBitmap = false;
    var supportsFullCreateImageBitmap = false;
    // set to false when the device is known to ignore the premultiply option
    var premultiplyAlphaHonored = true;

    getImage(src, premultiplyAlpha, x, y, width, height, {
      supportsOptionsCreateImageBitmap,
      supportsFullCreateImageBitmap,
      premultiplyAlphaHonored,
    })
      .then(function (data) {
        // @ts-ignore ts has wrong postMessage signature
        self.postMessage({ id: id, src: src, data: data }, [data.data]);
      })
      .catch(function (error) {
        self.postMessage({ id: id, src: src, error: error.message });
      });
  };
}
/* eslint-enable */

export class ImageWorkerManager {
  messageManager: Record<number, MessageCallback> = {};
  workers: Worker[] = [];
  workerLoad: number[] = [];
  nextId = 0;
  /** Upper bound on the pool size, from the `numImageWorkers` setting. */
  private readonly maxWorkers: number;
  /**
   * Shared worker source blob, retained so additional workers can be spawned
   * one at a time without re-serializing. Released once the pool reaches
   * `maxWorkers`, since no further workers will ever be created.
   */
  private workerBlob: Blob | null = null;

  constructor(
    numImageWorkers: number,
    createImageBitmapSupport: CreateImageBitmapSupport,
  ) {
    this.maxWorkers = numImageWorkers;
    // Build the shared worker source once, then spawn workers one at a time:
    // the first eagerly so the image pipeline is live immediately, the rest on
    // demand as concurrent load grows (see getImage). This keeps all N worker
    // threads from spinning up and parsing the blob simultaneously during the
    // first-paint window on constrained devices.
    this.workerBlob = this.createWorkerBlob(createImageBitmapSupport);
    this.spawnWorker();
  }

  private handleMessage(event: MessageEvent, workerIndex: number) {
    const { id, data, error } = event.data as ImageWorkerMessage;
    const msg = this.messageManager[id];

    if (this.workerLoad[workerIndex]) {
      this.workerLoad[workerIndex]--;
    }

    if (msg) {
      const [resolve, reject] = msg;
      delete this.messageManager[id];
      if (error) {
        reject(new Error(error));
      } else {
        resolve(data);
      }
    }
  }

  private handleWorkerError(event: Event | ErrorEvent, workerIndex: number) {
    const message =
      event instanceof ErrorEvent && event.message
        ? event.message
        : 'Image worker encountered an unrecoverable error';

    // Reject all pending requests; we cannot map a worker-level crash to a
    // specific message id, so fail everything outstanding to avoid hangs.
    for (const id in this.messageManager) {
      const msg = this.messageManager[id];
      if (msg) {
        const [, reject] = msg;
        delete this.messageManager[id];
        reject(new Error(message));
      }
    }
    this.workerLoad[workerIndex] = 0;
  }

  private createWorkerBlob(
    createImageBitmapSupport: CreateImageBitmapSupport,
  ): Blob {
    let workerCode = `(${createImageWorker.toString()})()`;

    // Replace placeholders with actual initialization values
    if (createImageBitmapSupport.options === true) {
      workerCode = workerCode.replace(
        'var supportsOptionsCreateImageBitmap = false;',
        'var supportsOptionsCreateImageBitmap = true;',
      );
    }

    if (createImageBitmapSupport.full === true) {
      workerCode = workerCode.replace(
        'var supportsOptionsCreateImageBitmap = false;',
        'var supportsOptionsCreateImageBitmap = true;',
      );

      workerCode = workerCode.replace(
        'var supportsFullCreateImageBitmap = false;',
        'var supportsFullCreateImageBitmap = true;',
      );
    }

    if (createImageBitmapSupport.premultiplyHonored === false) {
      workerCode = workerCode.replace(
        'var premultiplyAlphaHonored = true;',
        'var premultiplyAlphaHonored = false;',
      );
    }

    workerCode = workerCode.replace('"use strict";', '');
    return new Blob([workerCode], {
      type: 'application/javascript',
    });
  }

  /**
   * Spawn a single worker from the shared blob and wire up its handlers.
   * No-op once the pool has reached `maxWorkers`.
   */
  private spawnWorker(): void {
    if (this.workerBlob === null || this.workers.length >= this.maxWorkers) {
      return;
    }

    const index = this.workers.length;
    const urlFactory = self.URL ? URL : webkitURL;
    const blobURL: string = urlFactory.createObjectURL(this.workerBlob);
    const worker = new Worker(blobURL);
    // The worker retains the script after construction; the URL is no longer
    // needed once the Worker has been created from it.
    urlFactory.revokeObjectURL(blobURL);

    worker.onmessage = (event) => this.handleMessage(event, index);
    worker.onerror = (event) => this.handleWorkerError(event, index);
    worker.onmessageerror = (event) => this.handleWorkerError(event, index);

    this.workers.push(worker);
    this.workerLoad.push(0);

    // Pool is full — the blob will never be needed again, so release it.
    if (this.workers.length >= this.maxWorkers) {
      this.workerBlob = null;
    }
  }

  private getNextWorkerIndex(): number {
    if (this.workers.length === 0) return -1;

    let minLoad = Infinity;
    let workerIndex = 0;

    for (let i = 0; i < this.workers.length; i++) {
      const load = this.workerLoad[i] || 0;

      if (load === 0) {
        return i;
      }

      if (load < minLoad) {
        minLoad = load;
        workerIndex = i;
      }
    }
    return workerIndex;
  }

  getImage(
    src: string,
    premultiplyAlpha: boolean | null,
    sx: number | null,
    sy: number | null,
    sw: number | null,
    sh: number | null,
  ): Promise<TextureData> {
    return new Promise((resolve, reject) => {
      try {
        // Grow the pool one worker at a time: only when the least-loaded worker
        // is already busy and we're still under the cap. This spreads worker
        // creation across real demand instead of a single boot-time burst.
        let nextWorkerIndex = this.getNextWorkerIndex();
        if (
          nextWorkerIndex !== -1 &&
          this.workerLoad[nextWorkerIndex]! > 0 &&
          this.workers.length < this.maxWorkers
        ) {
          this.spawnWorker();
          nextWorkerIndex = this.workers.length - 1;
        }

        if (nextWorkerIndex === -1) {
          reject(new Error('No image workers available'));
          return;
        }

        const id = this.nextId++;
        this.messageManager[id] = [resolve, reject];
        const worker = this.workers[nextWorkerIndex];
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.workerLoad[nextWorkerIndex]!++;
        worker!.postMessage({
          id,
          src: src,
          premultiplyAlpha,
          sx,
          sy,
          sw,
          sh,
        });
      } catch (error) {
        reject(error);
      }
    });
  }
}
