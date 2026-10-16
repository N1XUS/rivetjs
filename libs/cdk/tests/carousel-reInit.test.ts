// Ported from embla-carousel (packages/embla-carousel/src/__tests__/reInit.test.ts, v8.6.0), MIT, © David Jerleke.
// Changes: Vitest with Jest globals (`@rivetjs/testing/jest`), happy-dom instead of jsdom (`carousel/mocks/dom.ts`),
// module specifiers.
import { beforeEach, describe, expect, jest, test } from "@rivetjs/testing/jest";
import EmblaCarousel from "../carousel/engine/EmblaCarousel.ts";
import { mockTestElementDimensions, mockTestElements } from "./carousel/mocks/index.ts";
import { FIXTURE_REINIT_1, FIXTURE_REINIT_2 } from "./carousel/fixtures/reInit.fixture.ts";

const FIRST_SNAP_INDEX = 0;

describe("➡️  ReInit", () => {
  test("Picks up changes in element dimensions", () => {
    const emblaApi = EmblaCarousel(mockTestElements(FIXTURE_REINIT_1));

    const engine = emblaApi.internalEngine();
    const expectedScrollSnaps = [0, -500, -800, -1150, -1200];
    expect(engine.scrollSnaps).toEqual(expectedScrollSnaps);
    expect(engine.location.get()).toBe(expectedScrollSnaps[FIRST_SNAP_INDEX]);

    mockTestElementDimensions(FIXTURE_REINIT_2, emblaApi.rootNode());
    emblaApi.reInit();

    const newEngine = emblaApi.internalEngine();
    const newExpectedScrollSnaps = [0, -530, -850, -1220, -1300];
    expect(newEngine.scrollSnaps).toEqual(newExpectedScrollSnaps);
    expect(newEngine.location.get()).toBe(newExpectedScrollSnaps[FIRST_SNAP_INDEX]);
  });

  test("Picks up changes in slide count changes", () => {
    const emblaApi = EmblaCarousel(mockTestElements(FIXTURE_REINIT_1));

    const engine = emblaApi.internalEngine();
    const expectedScrollSnaps = [0, -500, -800, -1150, -1200];
    expect(engine.scrollSnaps).toEqual(expectedScrollSnaps);
    expect(engine.location.get()).toBe(expectedScrollSnaps[FIRST_SNAP_INDEX]);

    const slideOffsets = FIXTURE_REINIT_1.slideOffsets;
    const fixtureAllSlidesButFirst = {
      ...FIXTURE_REINIT_1,
      slideOffsets: slideOffsets.slice(0, slideOffsets.length - 1),
    };
    mockTestElementDimensions(fixtureAllSlidesButFirst, emblaApi.rootNode());
    emblaApi.reInit();

    const newEngine = emblaApi.internalEngine();
    const newExpectedScrollSnaps = [0, -500, -800, -900];
    expect(newEngine.scrollSnaps).toEqual(newExpectedScrollSnaps);
    expect(newEngine.location.get()).toBe(newExpectedScrollSnaps[FIRST_SNAP_INDEX]);
  });
});
