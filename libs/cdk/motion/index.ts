// `@rivetjs/cdk/motion`: embla-carousel's motion core (v8.6.0, MIT, © David Jerleke), DOM-agnostic and reusable —
// fixed-timestep loop with render interpolation (`AnimationLoop`), duration / friction integrator (`ScrollBody`),
// 1-D vectors (`Vector1D`), range helper (`Limit`), drag velocity tracker (`VelocityTracker`), release physics
// (`DragRelease`) and their composition as one animated value (`Motion1D`). Used by `@rivetjs/cdk/carousel`.
export { AnimationLoop, type AnimationLoopType, type FrameSchedulerType } from "./Animations.ts";
export { ScrollBody, type ScrollBodyType } from "./ScrollBody.ts";
export { Vector1D, type Vector1DType } from "./Vector1d.ts";
export { Limit, type LimitType } from "./Limit.ts";
export { VelocityTracker, type VelocityTrackerType } from "./DragTracker.ts";
export { DragRelease, snapForceBoost, freeForceBoost, type DragReleaseType } from "./DragRelease.ts";
export { Motion1D, type Motion1DOptionsType, type Motion1DType } from "./Motion1D.ts";
export { deltaAbs, factorAbs, mathAbs, mathSign } from "./utils.ts";
