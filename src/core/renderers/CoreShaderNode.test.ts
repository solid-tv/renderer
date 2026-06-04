import { describe, it, expect, vi } from 'vitest';
import { CoreShaderNode } from './CoreShaderNode.js';
import type { Stage } from '../Stage.js';
import type { CoreShaderType } from './CoreShaderNode.js';

const makeNode = (mutate: ReturnType<typeof vi.fn>) => {
  const stage = {
    shManager: { mutateShaderValueUsage: mutate },
  } as unknown as Stage;
  return new CoreShaderNode(
    'test',
    { time: undefined } as CoreShaderType,
    stage,
  );
};

describe('CoreShaderNode.detachNode', () => {
  it('releases the held value-cache key so idle cleanup can evict it', () => {
    const mutate = vi.fn();
    const node = makeNode(mutate);
    node.valueKey = 'color:1;node-width:10node-height:10';

    node.detachNode();

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith(
      'color:1;node-width:10node-height:10',
      -1,
    );
    // Key is cleared so a double-detach can't decrement twice.
    expect(node.valueKey).toBe('');
  });

  it('is a no-op when no value key is held', () => {
    const mutate = vi.fn();
    const node = makeNode(mutate);

    node.detachNode();

    expect(mutate).not.toHaveBeenCalled();
  });

  it('does not double-decrement on repeated detach', () => {
    const mutate = vi.fn();
    const node = makeNode(mutate);
    node.valueKey = 'k';

    node.detachNode();
    node.detachNode();

    expect(mutate).toHaveBeenCalledTimes(1);
  });
});
