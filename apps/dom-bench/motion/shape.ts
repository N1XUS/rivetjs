// Motion suite contract (`window.motionBench`), shared by the lanes: rivet (`@rivetjs/motion`), react (React 19 +
// `motion/react`), vanilla (`motion` by hand: the floor).
export type Scenario = "mount" | "stagger" | "relayout";
export interface MotionBench {
  /** `mount`: 1000 elements with a static `animate` target; `stagger`: 1000 staggered entrances (opacity + y, 0.4 s,
   * 2 ms apart); `relayout`: a 1000-item masonry (rivet lanes) whose item 0 then expands. Returns once rendered. */
  mount(scenario: Scenario, count: number): void;
  /** `relayout` only: expand item 0 (the animation starts). */
  relayout?(): void;
  dispose(): void;
}
export const STAGGER = { duration: 0.4, each: 0.002, y: 20 };
