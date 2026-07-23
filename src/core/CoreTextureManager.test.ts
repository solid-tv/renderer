import { describe, it, expect } from 'vitest';
import { ConcurrencyGate } from './CoreTextureManager.js';

/**
 * Flush the microtask queue a few times so acquire()/release() continuations
 * (which resolve across several `await` hops) have all settled before we
 * assert. Deliberately microtask-only — no timers.
 */
const tick = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
};

describe('ConcurrencyGate', () => {
  it('resolves acquisitions immediately up to the limit', async () => {
    const gate = new ConcurrencyGate(2);
    let resolved = 0;

    void gate.acquire().then(() => {
      resolved++;
    });
    void gate.acquire().then(() => {
      resolved++;
    });

    await tick();
    expect(resolved).toBe(2);
  });

  it('blocks acquisitions beyond the limit until a slot is released', async () => {
    const gate = new ConcurrencyGate(1);
    let secondResolved = false;

    // Fast path takes the only slot.
    await gate.acquire();

    void gate.acquire().then(() => {
      secondResolved = true;
    });

    await tick();
    expect(secondResolved).toBe(false);

    gate.release();
    await tick();
    expect(secondResolved).toBe(true);
  });

  it('hands released slots to waiters in FIFO order', async () => {
    const gate = new ConcurrencyGate(1);
    const order: number[] = [];

    // Hold the only slot, then queue three waiters.
    await gate.acquire();
    void gate.acquire().then(() => order.push(1));
    void gate.acquire().then(() => order.push(2));
    void gate.acquire().then(() => order.push(3));

    await tick();
    expect(order).toEqual([]);

    gate.release();
    await tick();
    expect(order).toEqual([1]);

    gate.release();
    await tick();
    expect(order).toEqual([1, 2]);

    gate.release();
    await tick();
    expect(order).toEqual([1, 2, 3]);
  });

  it('frees a slot when releasing with no waiters queued', async () => {
    const gate = new ConcurrencyGate(1);
    let resolved = false;

    await gate.acquire();
    gate.release();

    void gate.acquire().then(() => {
      resolved = true;
    });

    await tick();
    expect(resolved).toBe(true);
  });

  it('never runs more than the limit concurrently under a burst', async () => {
    const limit = 3;
    const gate = new ConcurrencyGate(limit);
    const holds: Array<() => void> = [];
    let active = 0;
    let peak = 0;

    const run = async (): Promise<void> => {
      await gate.acquire();
      active++;
      if (active > peak) {
        peak = active;
      }
      // Hold the slot until externally released.
      await new Promise<void>((resolve) => {
        holds.push(resolve);
      });
      active--;
      gate.release();
    };

    const tasks: Array<Promise<void>> = [];
    for (let i = 0; i < 10; i++) {
      tasks.push(run());
    }

    await tick();
    expect(active).toBe(limit);
    expect(peak).toBe(limit);

    // Drain holds one at a time; each release lets exactly one waiter in.
    while (holds.length > 0) {
      const releaseHold = holds.shift()!;
      releaseHold();
      await tick();
      expect(active).toBeLessThanOrEqual(limit);
    }

    await Promise.all(tasks);
    expect(peak).toBe(limit);
    expect(active).toBe(0);
  });

  it('applies no ceiling below its limit', async () => {
    const gate = new ConcurrencyGate(4);
    let resolved = 0;

    for (let i = 0; i < 4; i++) {
      void gate.acquire().then(() => {
        resolved++;
      });
    }

    await tick();
    expect(resolved).toBe(4);
  });
});
