import type { CoreNode, CoreNodeAnimateProps } from '../CoreNode.js';
import { getTimingFunction, type TimingFunction } from '../utils.js';
import type {
  AnimationConfig,
  AnimationManager,
  PropValues,
} from './AnimationManager.js';

export interface AnimationSettings {
  duration: number;
  delay: number;
  easing: string | TimingFunction;
  loop: boolean;
  repeat: number;
  stopMethod: 'reverse' | 'reset' | false;
}

export function createAnimation(
  manager: AnimationManager,
  node: CoreNode,
  props: Partial<CoreNodeAnimateProps>,
  settings: Partial<AnimationSettings>,
): AnimationConfig {
  const easing = settings.easing || 'linear';
  const delay = settings.delay ?? 0;

  let propValues: Record<string, PropValues> | null = null;
  let shaderPropValues: Record<string, PropValues> | null = null;

  for (const key in props) {
    if (key !== 'shaderProps') {
      if (!propValues) propValues = {};
      propValues[key] = {
        start:
          node[key as keyof Omit<CoreNodeAnimateProps, 'shaderProps'>] || 0,
        target: props[
          key as keyof Omit<CoreNodeAnimateProps, 'shaderProps'>
        ] as number,
        isColor: key.indexOf('color') !== -1,
      };
    } else if (key === 'shaderProps' && node.shader !== null) {
      if (!shaderPropValues) shaderPropValues = {};
      for (const shaderKey in props.shaderProps) {
        let start = node.shader.props![shaderKey];
        if (Array.isArray(start)) {
          start = start[0];
        }
        shaderPropValues[shaderKey] = {
          start: start as number,
          target: props.shaderProps[shaderKey] as number,
          isColor: shaderKey.indexOf('color') !== -1,
        };
      }
    }
  }

  const timingFunction =
    typeof easing === 'string' ? getTimingFunction(easing) : easing;

  const config: AnimationConfig = {
    manager,
    node,
    duration: settings.duration ?? 0,
    delay,
    delayFor: delay,
    progress: 0,
    loop: settings.loop ?? false,
    repeat: settings.repeat ?? 0,
    stopMethod: settings.stopMethod ?? false,
    timingFunction,
    state: 'stopped',
    props: propValues,
    shaderProps: shaderPropValues,
    stoppedResolve: null,
    stoppedPromise: null,

    start() {
      if (this.state !== 'running' && this.state !== 'scheduled') {
        if (!this.stoppedPromise) {
          this.stoppedPromise = new Promise((resolve) => {
            this.stoppedResolve = resolve;
          });
        }
        this.manager.registerAnimation(this);
        this.state = 'scheduled';
      }
      return this;
    },

    stop() {
      this.manager.unregisterAnimation(this);
      if (this.stoppedResolve) {
        this.stoppedResolve();
        this.stoppedResolve = null;
      }
      // Reset values
      this.progress = 0;
      this.delayFor = this.delay;
      this.state = 'stopped';
      return this;
    },

    pause() {
      this.manager.unregisterAnimation(this);
      this.state = 'paused';
      return this;
    },

    restore() {
      this.stoppedResolve = null;
      this.stop();
      if (this.props) {
        const entries = Object.entries(this.props);
        for (let i = 0; i < entries.length; i++) {
          const [k, v] = entries[i]!;
          (this.node as unknown as Record<string, number>)[k] = v.start;
        }
      }
      if (this.shaderProps && this.node.shader) {
        const entries = Object.entries(this.shaderProps);
        for (let i = 0; i < entries.length; i++) {
          const [k, v] = entries[i]!;
          (this.node.shader.props as Record<string, number>)[k] = v.start;
        }
      }
      return this;
    },

    waitUntilStopped() {
      if (!this.stoppedPromise) {
        this.stoppedPromise = Promise.resolve();
      }
      return this.stoppedPromise;
    },
  };

  return config;
}
