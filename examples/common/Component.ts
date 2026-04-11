import type { INode, INodeProps, RendererMain } from '@lightningjs/renderer';

export class Component {
  readonly node: INode;

  constructor(readonly renderer: RendererMain, nodeProps: Partial<INodeProps>) {
    this.node = renderer.createNode({
      ...nodeProps,
    });
  }

  get x() {
    return this.node.x;
  }

  set x(x: number) {
    this.node.x = x;
  }

  get y() {
    return this.node.y;
  }

  set y(y: number) {
    this.node.y = y;
  }

  get w() {
    return this.node.w;
  }

  set w(w: number) {
    this.node.w = w;
  }

  get h() {
    return this.node.h;
  }

  set h(h: number) {
    this.node.h = h;
  }
}
