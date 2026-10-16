// Ported from embla-carousel (packages/embla-carousel/src/__tests__/constructor.test.ts, v8.6.0), MIT, © David Jerleke.
// Changes: Vitest with Jest globals (`@rivetjs/testing/jest`), happy-dom instead of jsdom (`carousel/mocks/dom.ts`),
// module specifiers.
import { beforeEach, describe, expect, jest, test } from "@rivetjs/testing/jest";
import EmblaCarousel from "../carousel/engine/EmblaCarousel.ts";
import { mockTestElements } from "./carousel/mocks/index.ts";
import { FIXTURE_CONSTRUCTOR_1, FIXTURE_CONSTRUCTOR_2 } from "./carousel/fixtures/constructor.fixture.ts";

describe("➡️  EmblaCarousel", () => {
  describe("Does NOT TRHOW when initialized and", () => {
    test("All necessary nodes are provided", () => {
      expect(() => EmblaCarousel(mockTestElements(FIXTURE_CONSTRUCTOR_1))).not.toThrow();
    });

    test("The slide nodes are omitted", () => {
      expect(() => EmblaCarousel(mockTestElements(FIXTURE_CONSTRUCTOR_2))).not.toThrow();
    });
  });

  describe("Does TRHOW when initialized and", () => {
    test("The root node parameter is omitted", () => {
      expect(() => EmblaCarousel(undefined as any)).toThrow();
    });

    test("The container node is omitted", () => {
      expect(() =>
        EmblaCarousel(
          mockTestElements({
            slideOffsets: [],
            endMargin: {
              property: "marginRight",
              value: 0,
            },
          }),
        ),
      ).toThrow();
    });
  });
});
