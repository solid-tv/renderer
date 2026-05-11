import { describe, expect, it } from 'vitest';
import { Matrix3d } from './Matrix3d.js';

describe('Matrix3d.setTranslate', () => {
  it('writes tx/ty without touching ta/tb/tc/td', () => {
    const m = Matrix3d.identity();
    m.setTranslate(10, 20);
    expect(m.tx).toBe(10);
    expect(m.ty).toBe(20);
    expect(m.ta).toBe(1);
    expect(m.tb).toBe(0);
    expect(m.tc).toBe(0);
    expect(m.td).toBe(1);
  });

  it('updates the float array on subsequent getFloatArr() calls', () => {
    const m = Matrix3d.identity();
    m.setTranslate(5, 7);
    // First read populates the array
    const arr = m.getFloatArr();
    expect(arr[6]).toBe(5);
    expect(arr[7]).toBe(7);

    // Mutate, then expect getFloatArr() to pick up the change.
    m.setTranslate(9, 11);
    const arr2 = m.getFloatArr();
    expect(arr2[6]).toBe(9);
    expect(arr2[7]).toBe(11);
    // Same array reference reused (no GC pressure).
    expect(arr2).toBe(arr);
  });

  it('overwrites prior tx/ty values', () => {
    const m = Matrix3d.translate(100, 200);
    m.setTranslate(0, 0);
    expect(m.tx).toBe(0);
    expect(m.ty).toBe(0);
  });
});
