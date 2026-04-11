import type {
  IAnimationController,
  TimingFunction,
} from '@lightningjs/renderer';
import type { ExampleSettings } from '../common/ExampleSettings.js';

interface AnimationExampleSettings {
  duration: number;
  easing: string | TimingFunction;
  delay: number;
  loop: boolean;
  stopMethod: 'reverse' | 'reset' | false;
}

export default async function ({ renderer, testRoot }: ExampleSettings) {
  const node = renderer.createNode({
    x: 0,
    y: 0,
    w: 1920,
    h: 1080,
    color: 0x000000ff,
    parent: testRoot,
  });

  const animatableNode = renderer.createNode({
    x: 0,
    y: 300,
    w: 200,
    h: 200,
    color: 0xffffffff,
    parent: node,
  });

  const easingLabel = renderer.createTextNode({
    parent: node,
    x: 40,
    y: 40,
    fontFamily: 'Ubuntu',
    fontSize: 40,
    text: '',
  });

  const legend = renderer.createTextNode({
    parent: node,
    x: 40,
    y: 90,
    fontFamily: 'Ubuntu',
    fontSize: 20,
    text: 'press left or right arrow key to change easing',
  });

  /**
   * Loop animation demo
   */
  const easings = [
    'linear',
    'ease-in',
    'ease-out',
    'ease-in-out',
    'ease-in-sine',
    'ease-out-sine',
    'ease-in-out-sine',
    'ease-in-cubic',
    'ease-out-cubic',
    'ease-in-out-cubic',
    'ease-in-circ',
    'ease-out-circ',
    'ease-in-out-circ',
    'ease-in-back',
    'ease-out-back',
    'ease-in-out-back',
    'cubic-bezier(0,1.35,.99,-0.07)',
    'cubic-bezier(.41,.91,.99,-0.07)',
    'loopCustomTiming',
    'loopStopMethodReverse',
    'loopStopMethodReset',
    'loop',
  ];

  let animationIndex = 0;
  let currentAnimation: IAnimationController;

  const execEasing = (index = 0): void => {
    const easing = easings[index] ?? 'linear';
    easingLabel.text = `Easing demo: ${easing}`;
    const animationSettings: Partial<AnimationExampleSettings> = {
      duration: 2000,
      delay: 500,
      loop: false,
      stopMethod: false,
      easing: 'linear',
    };
    animationSettings.easing = easing;

    // restore x position before start of every animation
    animatableNode.x = 0;

    if (easing === 'loopStopMethodReverse') {
      animationSettings.easing = 'linear';
      animationSettings.loop = true;
      animationSettings.stopMethod = 'reverse';
    } else if (easing === 'loopStopMethodReset') {
      animationSettings.easing = 'linear';
      animationSettings.loop = true;
      animationSettings.stopMethod = 'reset';
    } else if (easing === 'loop') {
      animationSettings.easing = 'linear';
      animationSettings.loop = true;
    } else if (easing === 'loopCustomTiming') {
      animationSettings.easing = (t: number) => {
        return Math.round(t * 5) / 5;
      };
      animationSettings.loop = true;
      animationSettings.stopMethod = 'reverse';
    } else {
      animationSettings.loop = false;
      animationSettings.stopMethod = false;
    }

    if (currentAnimation) {
      currentAnimation.stop();
    }

    currentAnimation = animatableNode.animate(
      {
        x: renderer.settings.appWidth - animatableNode.w,
      },
      animationSettings, // Remove the unnecessary assertion
    );

    currentAnimation.start();
  };

  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') {
      animationIndex++;
    }
    if (e.key === 'ArrowLeft') {
      animationIndex--;
    }

    // wrap around
    animationIndex =
      ((animationIndex % easings.length) + easings.length) % easings.length;

    execEasing(animationIndex);
  });

  execEasing(animationIndex);
}
