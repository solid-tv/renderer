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

describe('ImageWorkerManager staggered spawning', () => {
  it('spawns exactly one worker eagerly at construction', () => {
    new ImageWorkerManager(3, support);
    expect(FakeWorker.instances.length).toBe(1);
  });

  it('does not grow while the existing worker is idle', () => {
    const mgr = new ImageWorkerManager(3, support);
    // First request lands on the idle eager worker — no growth.
    load(mgr);
    expect(FakeWorker.instances.length).toBe(1);
  });

  it('grows one worker at a time under concurrent load, up to the cap', () => {
    const mgr = new ImageWorkerManager(3, support);

    load(mgr); // -> worker 0 (idle), load[0]=1, still 1 worker
    expect(FakeWorker.instances.length).toBe(1);

    load(mgr); // all busy, under cap -> spawn worker 1
    expect(FakeWorker.instances.length).toBe(2);

    load(mgr); // all busy, under cap -> spawn worker 2
    expect(FakeWorker.instances.length).toBe(3);

    load(mgr); // all busy but at cap -> no growth
    load(mgr);
    expect(FakeWorker.instances.length).toBe(3);
  });

  it('never spawns more than one worker when maxWorkers is 1', () => {
    const mgr = new ImageWorkerManager(1, support);
    expect(FakeWorker.instances.length).toBe(1);
    load(mgr);
    load(mgr);
    load(mgr);
    expect(FakeWorker.instances.length).toBe(1);
  });

  it('serializes the worker source only once, reusing the blob per spawn', () => {
    const mgr = new ImageWorkerManager(3, support);
    // Drive growth to the cap.
    load(mgr);
    load(mgr);
    load(mgr);
    // One object URL created+revoked per spawned worker (3), not per request.
    expect(createObjectURL).toHaveBeenCalledTimes(3);
    expect(revokeObjectURL).toHaveBeenCalledTimes(3);
  });

  it('routes each request to a worker via postMessage', () => {
    const mgr = new ImageWorkerManager(2, support);
    load(mgr);
    expect(FakeWorker.instances[0]!.postMessage).toHaveBeenCalledTimes(1);
  });
});
