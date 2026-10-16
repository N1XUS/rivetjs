// Ported from embla-carousel (packages/embla-carousel/src/__tests__/axis-vertical.test.ts, v8.6.0), MIT, © David Jerleke.
// Changes: Vitest with Jest globals (`@rivetjs/testing/jest`), happy-dom instead of jsdom (`carousel/mocks/dom.ts`),
// module specifiers.
import { beforeEach, describe, expect, jest, test } from "@rivetjs/testing/jest";
import EmblaCarousel from "../carousel/engine/EmblaCarousel.ts";
import { mockTestElements } from "./carousel/mocks/index.ts";
import { FIXTURE_AXIS_Y } from "./carousel/fixtures/axis-vertical.fixture.ts";

describe("➡️  Axis - Vertical LTR", () => {
  describe("Translates correctly when direction is:", () => {
    test("Vertical", () => {
      const emblaApi = EmblaCarousel(mockTestElements(FIXTURE_AXIS_Y), {
        containScroll: false,
        axis: "y",
      });

      expect(emblaApi.containerNode().style.transform).toBe("translate3d(0px,100px,0px)");
    });
  });
});

describe("➡️  Axis - Vertical RTL", () => {
  test("Translates correctly", () => {
    const emblaApi = EmblaCarousel(mockTestElements(FIXTURE_AXIS_Y), {
      containScroll: false,
      direction: "rtl",
      axis: "y",
    });

    expect(emblaApi.containerNode().style.transform).toBe("translate3d(0px,100px,0px)");
  });
});
