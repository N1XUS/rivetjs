// Ported from embla-carousel (packages/embla-carousel/src/__tests__/loop-ltr.test.ts `scrollToLocationInstant`, v8.6.0), MIT, © David Jerleke.
// Changes: moved out of the test file (importing a test file re-runs its suite).
import type { EngineType } from "../../carousel/engine/Engine.ts";

export const scrollToLocationInstant = (engine: EngineType, location: number): void => {
  engine.target.set(location);
  engine.scrollBody.useDuration(0);
  engine.animation.update();
  engine.animation.render(1);
};
