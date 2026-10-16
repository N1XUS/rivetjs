// Ported from embla-carousel (packages/embla-carousel/src/__tests__/axis-ltr.test.ts, v8.6.0), MIT, © David Jerleke.
// Changes: Vitest with Jest globals (`@rivetjs/testing/jest`), happy-dom instead of jsdom (`carousel/mocks/dom.ts`),
// module specifiers.
import { beforeEach, describe, expect, jest, test } from "@rivetjs/testing/jest";
import EmblaCarousel from "../carousel/engine/EmblaCarousel.ts";
import { mockTestElements } from "./carousel/mocks/index.ts";
import { FIXTURE_AXIS_X_LTR } from "./carousel/fixtures/axis-ltr.fixture.ts";

describe("➡️  Axis - Horizontal LTR", () => {
  test("Translates correctly", () => {
    const emblaApi = EmblaCarousel(mockTestElements(FIXTURE_AXIS_X_LTR), {
      containScroll: false,
    });

    expect(emblaApi.containerNode().style.transform).toBe("translate3d(100px,0px,0px)");
  });
});
