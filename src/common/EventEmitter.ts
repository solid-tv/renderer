/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IEventEmitter } from './IEventEmitter.js';

/**
 * EventEmitter base class
 */
export class EventEmitter implements IEventEmitter {
  private eventListeners: { [eventName: string]: any } = {};

  on(event: string, listener: (target: any, data: any) => void): void {
    let listeners = this.eventListeners[event];
    if (!listeners) {
      listeners = [];
    }
    listeners.push(listener);
    this.eventListeners[event] = listeners;
  }

  off(event: string, listener?: (target: any, data: any) => void): void {
    const listeners = this.eventListeners[event];
    if (!listeners) {
      return;
    }
    if (!listener) {
      delete this.eventListeners[event];
      return;
    }
    const index = listeners.indexOf(listener);
    if (index >= 0) {
      listeners.splice(index, 1);
    }
  }

  once(event: string, listener: (target: any, data: any) => void): void {
    const onceListener = (target: any, data: any) => {
      this.off(event, onceListener);
      listener(target, data);
    };
    this.on(event, onceListener);
  }

  emit(event: string, data?: any): void {
    const listeners = this.eventListeners[event];
    if (!listeners) {
      return;
    }
    [...listeners].forEach((listener) => {
      listener(this, data);
    });
  }

  removeAllListeners() {
    this.eventListeners = {};
  }
}
