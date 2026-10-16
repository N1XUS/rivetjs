// Ported from embla-carousel (packages/embla-carousel/src/__tests__/align-ltr.test.ts, v8.6.0), MIT, © David Jerleke.
// Changes: Vitest with Jest globals (`@rivetjs/testing/jest`), happy-dom instead of jsdom (`carousel/mocks/dom.ts`),
// module specifiers.
import { beforeEach, describe, expect, jest, test } from "@rivetjs/testing/jest";
import EmblaCarousel from "../carousel/engine/EmblaCarousel.ts";
import { mockTestElements } from "./carousel/mocks/index.ts";
import { FIXTURE_ALIGN_LTR_1, FIXTURE_ALIGN_LTR_2 } from "./carousel/fixtures/align-ltr.fixture.ts";

const FIRST_SNAP_INDEX = 0;

describe("➡️  Align - Horizontal LTR", () => {
  describe("Is correct for slides WITHOUT MARGINS and ALIGN is:", () => {
    const emblaApi = EmblaCarousel(mockTestElements(FIXTURE_ALIGN_LTR_1), {
      containScroll: false,
    });

    test("Start", () => {
      emblaApi.reInit({ align: "start" });

      const engine = emblaApi.internalEngine();
      const expectedScrollSnaps = [0, -800, -1200, -1400, -1900];

      expect(engine.scrollSnaps).toEqual(expectedScrollSnaps);
      expect(engine.location.get()).toBe(expectedScrollSnaps[FIRST_SNAP_INDEX]);
    });

    test("Center", () => {
      emblaApi.reInit({ align: "center" });

      const engine = emblaApi.internalEngine();
      const expectedScrollSnaps = [100, -500, -800, -1150, -1550];

      expect(engine.scrollSnaps).toEqual(expectedScrollSnaps);
      expect(engine.location.get()).toBe(expectedScrollSnaps[FIRST_SNAP_INDEX]);
    });

    test("End", () => {
      emblaApi.reInit({ align: "end" });

      const engine = emblaApi.internalEngine();
      const expectedScrollSnaps = [200, -200, -400, -900, -1200];

      expect(engine.scrollSnaps).toEqual(expectedScrollSnaps);
      expect(engine.location.get()).toBe(expectedScrollSnaps[FIRST_SNAP_INDEX]);
    });

    test("Custom", () => {
      emblaApi.reInit({ align: (viewSize) => viewSize * 0.1 });

      const engine = emblaApi.internalEngine();
      const expectedScrollSnaps = [100, -700, -1100, -1300, -1800];

      expect(engine.scrollSnaps).toEqual(expectedScrollSnaps);
      expect(engine.location.get()).toBe(expectedScrollSnaps[FIRST_SNAP_INDEX]);
    });
  });

  describe("Is correct for slides WITH MARGINS and ALIGN is:", () => {
    const emblaApi = EmblaCarousel(mockTestElements(FIXTURE_ALIGN_LTR_2), {
      containScroll: false,
    });

    test("Start", () => {
      emblaApi.reInit({ align: "start" });

      const engine = emblaApi.internalEngine();
      const expectedScrollSnaps = [-10, -830, -1250, -1470, -1990];

      expect(engine.scrollSnaps).toEqual(expectedScrollSnaps);
      expect(engine.location.get()).toBe(expectedScrollSnaps[FIRST_SNAP_INDEX]);
    });

    test("Center", () => {
      emblaApi.reInit({ align: "center" });

      const engine = emblaApi.internalEngine();
      const expectedScrollSnaps = [90, -530, -850, -1220, -1640];

      expect(engine.scrollSnaps).toEqual(expectedScrollSnaps);
      expect(engine.location.get()).toBe(expectedScrollSnaps[FIRST_SNAP_INDEX]);
    });

    test("End", () => {
      emblaApi.reInit({ align: "end" });

      const engine = emblaApi.internalEngine();
      const expectedScrollSnaps = [190, -230, -450, -970, -1290];

      expect(engine.scrollSnaps).toEqual(expectedScrollSnaps);
      expect(engine.location.get()).toBe(expectedScrollSnaps[FIRST_SNAP_INDEX]);
    });

    test("Custom", () => {
      emblaApi.reInit({ align: (viewSize) => viewSize * 0.1 });

      const engine = emblaApi.internalEngine();
      const expectedScrollSnaps = [90, -730, -1150, -1370, -1890];

      expect(engine.scrollSnaps).toEqual(expectedScrollSnaps);
      expect(engine.location.get()).toBe(expectedScrollSnaps[FIRST_SNAP_INDEX]);
    });
  });
});
