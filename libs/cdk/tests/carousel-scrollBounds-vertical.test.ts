// Ported from embla-carousel (packages/embla-carousel/src/__tests__/scrollBounds-vertical.test.ts, v8.6.0), MIT, © David Jerleke.
// Changes: Vitest with Jest globals (`@rivetjs/testing/jest`), happy-dom instead of jsdom (`carousel/mocks/dom.ts`),
// module specifiers.
import { beforeEach, describe, expect, jest, test } from "@rivetjs/testing/jest";
import EmblaCarousel from "../carousel/engine/EmblaCarousel.ts";
import { mockTestElements } from "./carousel/mocks/index.ts";
import { SCROLL_BOUNDS_Y_1 } from "./carousel/fixtures/scrollBounds-vertical.fixture.ts";
import type { EngineType } from "../carousel/engine/Engine.ts";

export const setLocationOutOfBounds = (engine: EngineType, outOfBoundsLocation: number): void => {
  engine.offsetLocation.set(outOfBoundsLocation);
  engine.location.set(outOfBoundsLocation);
  engine.target.set(outOfBoundsLocation);
};

describe("➡️  ScrollBounds - Vertical", () => {
  describe("When the carousel is outside its bounds and its location is past the START bounds:", () => {
    test("It does NOT settle", () => {
      const emblaApi = EmblaCarousel(mockTestElements(SCROLL_BOUNDS_Y_1), {
        axis: "y",
      });
      const engine = emblaApi.internalEngine();
      const settleCallback = jest.fn();

      emblaApi.on("settle", settleCallback);

      setLocationOutOfBounds(engine, engine.limit.max + 1);
      engine.animation.render(1);

      expect(settleCallback).toHaveBeenCalledTimes(0);
    });

    test("Target is set to equal the START bound", () => {
      const emblaApi = EmblaCarousel(mockTestElements(SCROLL_BOUNDS_Y_1), {
        axis: "y",
      });
      const engine = emblaApi.internalEngine();

      setLocationOutOfBounds(engine, engine.limit.max + 1);
      engine.animation.update();

      expect(engine.target.get()).toBe(engine.limit.max);
    });
  });

  describe("When the carousel is outside its bounds and its location is past the END bounds:", () => {
    test("It does NOT settle", () => {
      const emblaApi = EmblaCarousel(mockTestElements(SCROLL_BOUNDS_Y_1), {
        axis: "y",
      });
      const engine = emblaApi.internalEngine();
      const settleCallback = jest.fn();

      emblaApi.on("settle", settleCallback);

      setLocationOutOfBounds(engine, engine.limit.min - 1);
      engine.animation.render(1);

      expect(settleCallback).toHaveBeenCalledTimes(0);
    });

    test("Target is set to equal the END bound", () => {
      const emblaApi = EmblaCarousel(mockTestElements(SCROLL_BOUNDS_Y_1), {
        axis: "y",
      });
      const engine = emblaApi.internalEngine();

      setLocationOutOfBounds(engine, engine.limit.min - 1);
      engine.animation.update();

      expect(engine.target.get()).toBe(engine.limit.min);
    });
  });
});
