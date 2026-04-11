import type { CoreNode, UpdateType } from '../CoreNode.js';
import type {
  IAnimationController,
  AnimationControllerState,
} from '../../common/IAnimationController.js';
import { type TimingFunction } from '../utils.js';
import { mergeColorProgress } from '../../utils.js';

export interface PropValues {
  start: number;
  target: number;
  isColor: boolean;
}

export interface AnimationConfig extends IAnimationController {
  manager: AnimationManager;
  node: CoreNode;
  duration: number;
  delayFor: number;
  delay: number;
  progress: number;
  loop: boolean;
  repeat: number;
  stopMethod: 'reverse' | 'reset' | false;
  timingFunction: TimingFunction;
  state: AnimationControllerState;
  props: Record<string, PropValues> | null;
  shaderProps: Record<string, PropValues> | null;
  stoppedResolve: (() => void) | null;
  stoppedPromise: Promise<void> | null;
}

export class AnimationManager {
  activeAnimations: AnimationConfig[] = [];

  registerAnimation(animation: AnimationConfig) {
    if (!this.activeAnimations.includes(animation)) {
      this.activeAnimations.push(animation);
    }
  }

  unregisterAnimation(animation: AnimationConfig) {
    const idx = this.activeAnimations.indexOf(animation);
    if (idx !== -1) {
      this.activeAnimations.splice(idx, 1);
    }
  }

  update(dt: number) {
    for (let i = this.activeAnimations.length - 1; i >= 0; i--) {
      const anim = this.activeAnimations[i];
      if (!anim) continue;

      if (anim.node.destroyed) {
        anim.stop();
        continue;
      }

      const { duration, loop } = anim;
      let remainingDt = dt;

      if (anim.delayFor > 0) {
        anim.delayFor -= remainingDt;
        if (anim.delayFor >= 0) {
          continue;
        } else {
          remainingDt = -anim.delayFor;
          anim.delayFor = 0;
        }
      }

      if (anim.progress === 0 && anim.state === 'scheduled') {
        anim.state = 'running';
      }

      if (duration === 0) {
        anim.progress = 1;
      } else {
        anim.progress += remainingDt / duration;
      }

      let isFinished = false;
      if (anim.progress >= 1) {
        if (loop) {
          anim.progress = anim.progress % 1;
          anim.delayFor = anim.delay;
        } else {
          anim.progress = 1;
          isFinished = true;
        }
      }

      this.applyValues(anim);

      if (isFinished) {
        if (anim.stopMethod === 'reverse') {
          this.reverseValues(anim);
          anim.progress = 0;
          anim.delayFor = anim.delay;
        } else {
          anim.stop();
        }
      }
    }
  }

  private applyValues(anim: AnimationConfig) {
    const easedProgress = anim.timingFunction(anim.progress) || anim.progress;

    if (anim.props) {
      for (const key in anim.props) {
        const value = anim.props[key]!;
        if (anim.progress === 1) {
          (anim.node as any)[key] = value.target;
        } else if (anim.progress === 0) {
          (anim.node as any)[key] = value.start;
        } else if (value.isColor) {
          (anim.node as any)[key] = mergeColorProgress(
            value.start,
            value.target,
            easedProgress,
          );
        } else {
          (anim.node as any)[key] =
            value.start + (value.target - value.start) * easedProgress;
        }
      }
    }

    if (anim.shaderProps && anim.node.shader) {
      let updated = false;
      for (const key in anim.shaderProps) {
        const value = anim.shaderProps[key]!;
        if (anim.progress === 1) {
          (anim.node.shader.props as any)[key] = value.target;
        } else if (anim.progress === 0) {
          (anim.node.shader.props as any)[key] = value.start;
        } else if (value.isColor) {
          (anim.node.shader.props as any)[key] = mergeColorProgress(
            value.start,
            value.target,
            easedProgress,
          );
        } else {
          (anim.node.shader.props as any)[key] =
            value.start + (value.target - value.start) * easedProgress;
        }
        updated = true;
      }
      if (updated) {
        // Must use code UpdateType.RecalcUniforms = 4096
        anim.node.setUpdateType(4096 as UpdateType);
      }
    }
  }

  private reverseValues(anim: AnimationConfig) {
    if (anim.props) {
      for (const key in anim.props) {
        const v = anim.props[key]!;
        const t = v.start;
        v.start = v.target;
        v.target = t;
      }
    }
    if (anim.shaderProps) {
      for (const key in anim.shaderProps) {
        const v = anim.shaderProps[key]!;
        const t = v.start;
        v.start = v.target;
        v.target = t;
      }
    }
    if (!anim.loop) {
      anim.stopMethod = false;
    }
  }
}
