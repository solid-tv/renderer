import type {
  INode,
  INodeProps,
  RendererMain,
  TextureMap,
} from '@lightningjs/renderer';
import { assertTruthy } from '@lightningjs/renderer/utils';

export class Character {
  node: INode;
  curIntervalAnimation: ReturnType<typeof setTimeout> | null = null;
  direction!: 'left' | 'right'; // Set in setState
  state!: 'idle' | 'walk' | 'run' | 'jump'; // Set in setState

  constructor(
    private props: Partial<INodeProps>,
    private renderer: RendererMain,
    private rightFrames: InstanceType<TextureMap['SubTexture']>[],
  ) {
    this.node = renderer.createNode({
      x: props.x,
      y: props.y,
      w: 200 / 2,
      h: 300 / 2,
      texture: rightFrames[0],
      parent: renderer.root,
      zIndex: props.zIndex,
    });
    assertTruthy(this.node);
    this.setState('right', 'idle');
  }

  setState(
    direction: 'left' | 'right',
    state: 'idle' | 'walk' | 'run' | 'jump',
  ) {
    if (this.direction === direction && this.state === state) {
      return;
    }
    this.direction = direction;
    this.state = state;
    switch (state) {
      case 'idle':
        this.animateCharacter(direction, 2, 3, 100);
        break;
      case 'walk':
        this.animateCharacter(direction, 0, 7, 100);
        break;
      case 'run':
        this.animateCharacter(direction, 0, 7, 100);
        break;
      case 'jump':
        this.animateCharacter(direction, 0, 7, 100);
        break;
    }
  }

  private animateCharacter(
    direction: 'left' | 'right',
    iStart: number,
    iEnd: number,
    intervalMs: number,
  ) {
    let curI = iStart;
    const flipX = direction === 'left' ? true : false;
    if (iEnd + 1 > this.rightFrames.length || iStart < 0) {
      throw new Error('Animation out of bounds');
    }
    if (this.curIntervalAnimation) {
      clearInterval(this.curIntervalAnimation);
    }
    const nextFrame = () => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.node.texture = this.rightFrames[curI]!;
      this.node.textureOptions.flipX = flipX;
      curI++;
      if (curI > iEnd) {
        curI = iStart;
      }
    };
    nextFrame();
    this.curIntervalAnimation = setInterval(nextFrame, intervalMs);
  }
}
