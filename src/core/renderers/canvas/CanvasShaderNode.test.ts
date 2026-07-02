import { describe, expect, it, vi } from 'vitest';
import { CanvasShaderNode, type CanvasShaderType } from './CanvasShaderNode.js';
import type { CoreNode } from '../../CoreNode.js';
import type { Stage } from '../../Stage.js';

type TestProps = { radius: number };

const makeShaderNode = (props: TestProps) => {
  const shManager = {
    getShaderValues: vi.fn(),
    setShaderValues: vi.fn(),
    mutateShaderValueUsage: vi.fn(),
  };
  const stage = { shManager } as unknown as Stage;
  const updater = vi.fn(function (this: CanvasShaderNode<TestProps>) {
    (this.computed as Record<string, unknown>).value = 'computed';
  });
  const config = {
    props: { radius: 0 },
    render: vi.fn(),
    update: updater,
  } as unknown as CanvasShaderType<TestProps>;
  const shaderNode = new CanvasShaderNode<TestProps>(
    'test',
    config,
    stage,
    props,
  );
  shaderNode.attachNode({ w: 100, h: 50 } as CoreNode);
  return { shaderNode, shManager, updater };
};

describe('CanvasShaderNode.update value cache', () => {
  it('computes and registers values on a cache miss', () => {
    const { shaderNode, shManager, updater } = makeShaderNode({ radius: 4 });
    shManager.getShaderValues.mockReturnValue(undefined);

    shaderNode.update!();

    expect(updater).toHaveBeenCalledTimes(1);
    expect(shManager.setShaderValues).toHaveBeenCalledTimes(1);
    expect(shManager.setShaderValues).toHaveBeenCalledWith(
      shaderNode.valueKey,
      shaderNode.computed,
    );
    expect((shaderNode.computed as Record<string, unknown>).value).toBe(
      'computed',
    );
  });

  it('reuses cached values on a cache hit without recomputing', () => {
    const { shaderNode, shManager, updater } = makeShaderNode({ radius: 4 });
    const cached = { value: 'cached' };
    shManager.getShaderValues.mockReturnValue(cached);

    shaderNode.update!();

    expect(shaderNode.computed).toBe(cached);
    expect(updater).not.toHaveBeenCalled();
    expect(shManager.setShaderValues).not.toHaveBeenCalled();
  });

  it('skips all work when the value key is unchanged', () => {
    const { shaderNode, shManager, updater } = makeShaderNode({ radius: 4 });
    shManager.getShaderValues.mockReturnValue(undefined);

    shaderNode.update!();
    shaderNode.update!();

    expect(updater).toHaveBeenCalledTimes(1);
    expect(shManager.getShaderValues).toHaveBeenCalledTimes(1);
  });
});
