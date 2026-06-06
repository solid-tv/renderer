import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ImageWorkerManager } from './ImageWorker.js';
import type { CreateImageBitmapSupport } from './validateImageBitmap.js';

/**
 * Minimal Web Worker stand-in. The real Worker spawns a thread that parses the
 * blob script; here we only care about how many are constructed and when, so we
 * record every instance and never auto-respond (so `getImage` calls stay
 * "in flight" and accumulate load, simulating concurrency).
 */
class FakeWorker {
  static instances: FakeWorker[] = [];
  static reset() {
    FakeWorker.instances = [];
  }
  onmessage: ((e: unknown) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onmessageerror: ((e: unknown) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor(public url: string) {
    FakeWorker.instances.push(this);
  }
}

const support: CreateImageBitmapSupport = {
  basic: true,
  options: true,
  full: true,
  premultiplyHonored: true,
};

let createObjectURL: ReturnType<typeof vi.fn>;
let revokeObjectURL: ReturnType<typeof vi.fn>;

beforeEach(() => {
  FakeWorker.reset();
  createObjectURL = vi.fn(() => 'blob:fake-url');
  revokeObjectURL = vi.fn();
  // The manager builds the worker source via Blob + object URL, then spawns
  // Workers. None of these exist in the node test env, so stub them.
  vi.stubGlobal(
    'Blob',
    class {
      constructor(public parts: unknown[], public opts: unknown) {}
    },
  );
  vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
  vi.stubGlobal('self', { URL: { createObjectURL, revokeObjectURL } });
  vi.stubGlobal('Worker', FakeWorker);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const load = (mgr: ImageWorkerManager) =>
  void mgr.getImage('img.png', null, null, null, null, null);

describe('ImageWorkerManager pool spawning', () => {
  it('does not spawn any workers at construction', () => {
    new ImageWorkerManager(3, support);
    // Spawning is lazy — nothing happens until the first image request.
    expect(FakeWorker.instances.length).toBe(0);
  });

  it('spawns the whole pool at once on the first image request', () => {
    const mgr = new ImageWorkerManager(3, support);
    load(mgr);
    expect(FakeWorker.instances.length).toBe(3);
  });

  it('does not respawn the pool on subsequent requests', () => {
    const mgr = new ImageWorkerManager(3, support);
    load(mgr); // spawns the pool
    expect(FakeWorker.instances.length).toBe(3);
    // Subsequent requests reuse the existing pool — no new workers.
    load(mgr);
    load(mgr);
    load(mgr);
    expect(FakeWorker.instances.length).toBe(3);
  });

  it('spawns exactly maxWorkers when that is 1', () => {
    const mgr = new ImageWorkerManager(1, support);
    load(mgr);
    expect(FakeWorker.instances.length).toBe(1);
    load(mgr);
    load(mgr);
    expect(FakeWorker.instances.length).toBe(1);
  });

  it('serializes the worker source once, reusing the blob per worker', () => {
    const mgr = new ImageWorkerManager(3, support);
    load(mgr);
    // One object URL created+revoked per spawned worker (3), serialized once.
    expect(createObjectURL).toHaveBeenCalledTimes(3);
    expect(revokeObjectURL).toHaveBeenCalledTimes(3);
  });

  it('routes each request to a worker via postMessage', () => {
    const mgr = new ImageWorkerManager(2, support);
    load(mgr);
    expect(FakeWorker.instances[0]!.postMessage).toHaveBeenCalledTimes(1);
  });
});
