// Ported from embla-carousel (packages/embla-carousel/src/__tests__/axis-rtl.test.ts, v8.6.0), MIT, © David Jerleke.
// Changes: Vitest with Jest globals (`@rivetjs/testing/jest`), happy-dom instead of jsdom (`carousel/mocks/dom.ts`),
// module specifiers.
import { beforeEach, describe, expect, jest, test } from "@rivetjs/testing/jest";
import EmblaCarousel from "../carousel/engine/EmblaCarousel.ts";
import { mockTestElements } from "./carousel/mocks/index.ts";
import { FIXTURE_AXIS_X_RTL } from "./carousel/fixtures/axis-rtl.fixture.ts";

describe("➡️  Axis - Horizontal RTL", () => {
  test("Translates correctly", () => {
    const emblaApi = EmblaCarousel(mockTestElements(FIXTURE_AXIS_X_RTL), {
      containScroll: false,
      direction: "rtl",
    });

    expect(emblaApi.containerNode().style.transform).toBe("translate3d(-100px,0px,0px)");
  });
});
