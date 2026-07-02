import { describe, it, expect } from 'vitest';
import { EdgeFadeTemplate, type EdgeFadeProps } from './EdgeFadeTemplate.js';
import { resolveShaderProps } from '../../renderers/CoreShaderNode.js';

function resolve(input: Partial<EdgeFadeProps>): EdgeFadeProps {
  const props = { ...input } as Record<string, unknown>;
  resolveShaderProps(props, EdgeFadeTemplate.props as never);
  return props as unknown as EdgeFadeProps;
}

describe('EdgeFadeTemplate', () => {
  it('defaults all edges to 0 (no fade)', () => {
    const props = resolve({});
    expect(props.left).toBe(0);
    expect(props.top).toBe(0);
    expect(props.right).toBe(0);
    expect(props.bottom).toBe(0);
  });

  it('passes through a single edge, leaving others at 0', () => {
    const props = resolve({ right: 420 });
    expect(props.right).toBe(420);
    expect(props.left).toBe(0);
    expect(props.top).toBe(0);
    expect(props.bottom).toBe(0);
  });

  it('passes through all edges', () => {
    const props = resolve({ left: 10, top: 20, right: 30, bottom: 40 });
    expect(props.left).toBe(10);
    expect(props.top).toBe(20);
    expect(props.right).toBe(30);
    expect(props.bottom).toBe(40);
  });
});
