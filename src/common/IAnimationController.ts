export type AnimationControllerState =
  | 'scheduled'
  | 'running'
  | 'paused'
  | 'stopped';

/**
 * Animation Controller interface
 *
 * @remarks
 * This interface is used to control animations. It provides methods to start,
 * stop, pause, and restore animations. It also provides a way to wait for the
 * animation to stop.
 */
export interface IAnimationController {
  /**
   * Start the animation
   *
   * @remarks
   * If the animation is paused this method will resume the animation.
   */
  start(): IAnimationController;
  /**
   * Stop the animation
   *
   * @remarks
   * Resets the animation to the start state
   */
  stop(): IAnimationController;
  /**
   * Pause the animation
   */
  pause(): IAnimationController;
  /**
   * Restore the animation to the original values
   */
  restore(): IAnimationController;

  /**
   * Promise that resolves when the last active animation is stopped (including
   * when the animation finishes naturally).
   *
   * @remarks
   * The Promise returned by this method is reset every time the animation
   * enters a new start/stop cycle. This means you must call `start()` before
   * calling this method if you want to wait for the animation to stop.
   *
   * This method always returns a resolved promise if the animation is currently
   * in a stopped state.
   *
   * @returns
   */
  waitUntilStopped(): Promise<void>;

  /**
   * Current state of the animation
   *
   * @remarks
   * - `stopped` - The animation is currently stopped (at the beggining or end
   *   of the animation)
   * - `running` - The animation is currently running
   * - `paused` - The animation is currently paused
   */
  readonly state: AnimationControllerState;
}
