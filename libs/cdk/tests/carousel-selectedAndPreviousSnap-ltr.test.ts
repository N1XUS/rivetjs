// Ported from embla-carousel (packages/embla-carousel/src/__tests__/selectedAndPreviousSnap-ltr.test.ts, v8.6.0), MIT, © David Jerleke.
// Changes: Vitest with Jest globals (`@rivetjs/testing/jest`), happy-dom instead of jsdom (`carousel/mocks/dom.ts`),
// module specifiers; synchronous `done` callbacks dropped (Vitest has no `done`).
import { beforeEach, describe, expect, jest, test } from "@rivetjs/testing/jest";
import EmblaCarousel from "../carousel/engine/EmblaCarousel.ts";
import { mockTestElements } from "./carousel/mocks/index.ts";
import { FIXTURE_SELECTED_PREVIOUS_SNAP_LTR } from "./carousel/fixtures/selectedAndPreviousSnap-ltr.fixture.ts";

describe("➡️  SelectedScrollSnap & PreviousScrollSnap - Horizontal LTR", () => {
  describe("Is correct when LOOP:FALSE when:", () => {
    const emblaApi = EmblaCarousel(mockTestElements(FIXTURE_SELECTED_PREVIOUS_SNAP_LTR));
    const lastIndex = FIXTURE_SELECTED_PREVIOUS_SNAP_LTR.slideOffsets.length - 1;
    const firstIndex = 0;

    beforeEach(() => {
      emblaApi.reInit({ startIndex: firstIndex });
    });

    test("startIndex is NOT set", () => {
      expect(emblaApi.selectedScrollSnap()).toBe(firstIndex);
      expect(emblaApi.previousScrollSnap()).toBe(firstIndex);
    });

    test("startIndex is set", () => {
      emblaApi.reInit({ startIndex: 2 });

      expect(emblaApi.selectedScrollSnap()).toBe(2);
      expect(emblaApi.previousScrollSnap()).toBe(2);
    });

    test("User tries to scrollNext() past the last slide", () => {
      emblaApi.reInit({ startIndex: lastIndex });
      emblaApi.scrollNext();

      expect(emblaApi.selectedScrollSnap()).toBe(lastIndex);
      expect(emblaApi.previousScrollSnap()).toBe(lastIndex);
    });

    test("User tries to scrollPrev before the first slide", () => {
      emblaApi.scrollPrev();

      expect(emblaApi.selectedScrollSnap()).toBe(firstIndex);
      expect(emblaApi.previousScrollSnap()).toBe(firstIndex);
    });

    test("User tries to scrollTo() an index more than last index", () => {
      emblaApi.scrollTo(lastIndex + 1);

      expect(emblaApi.selectedScrollSnap()).toBe(lastIndex);
      expect(emblaApi.previousScrollSnap()).toBe(firstIndex);
    });

    test("User tries to scrollTo() an index less than first index", () => {
      emblaApi.scrollTo(firstIndex - 1);

      expect(emblaApi.selectedScrollSnap()).toBe(firstIndex);
      expect(emblaApi.previousScrollSnap()).toBe(firstIndex);
    });

    test("Stepping forward one snap at a time from the beginning", () => {
      let i = firstIndex;

      while (i !== lastIndex) {
        emblaApi.scrollNext();
        expect(emblaApi.previousScrollSnap()).toBe(i);
        i += 1;
        expect(emblaApi.selectedScrollSnap()).toBe(i);
      }
    });

    test("Stepping backward one snap at a time from the end", () => {
      emblaApi.reInit({ startIndex: lastIndex });
      let i = lastIndex;

      while (i !== firstIndex) {
        emblaApi.scrollPrev();
        expect(emblaApi.previousScrollSnap()).toBe(i);
        i -= 1;
        expect(emblaApi.selectedScrollSnap()).toBe(i);
      }
    });
  });

  describe("Is correct when LOOP:TRUE when:", () => {
    const emblaApi = EmblaCarousel(mockTestElements(FIXTURE_SELECTED_PREVIOUS_SNAP_LTR), { loop: true });
    const lastIndex = FIXTURE_SELECTED_PREVIOUS_SNAP_LTR.slideOffsets.length - 1;
    const firstIndex = 0;

    beforeEach(() => {
      emblaApi.reInit({ startIndex: firstIndex });
    });

    test("startIndex is NOT set", () => {
      expect(emblaApi.selectedScrollSnap()).toBe(firstIndex);
      expect(emblaApi.previousScrollSnap()).toBe(firstIndex);
    });

    test("startIndex is set", () => {
      emblaApi.reInit({ startIndex: 2 });

      expect(emblaApi.selectedScrollSnap()).toBe(2);
      expect(emblaApi.previousScrollSnap()).toBe(2);
    });

    test("User tries to scrollNext() past the last slide", () => {
      emblaApi.reInit({ startIndex: lastIndex });
      emblaApi.scrollNext();

      expect(emblaApi.selectedScrollSnap()).toBe(firstIndex);
      expect(emblaApi.previousScrollSnap()).toBe(lastIndex);
    });

    test("User tries to scrollPrev before the first slide", () => {
      emblaApi.scrollPrev();

      expect(emblaApi.selectedScrollSnap()).toBe(lastIndex);
      expect(emblaApi.previousScrollSnap()).toBe(firstIndex);
    });

    test("User tries to scrollTo() an index more than last index", () => {
      emblaApi.scrollTo(lastIndex + 1);

      expect(emblaApi.selectedScrollSnap()).toBe(firstIndex);
      expect(emblaApi.previousScrollSnap()).toBe(firstIndex);
    });

    test("User tries to scrollTo() an index less than first index", () => {
      emblaApi.scrollTo(firstIndex - 1);

      expect(emblaApi.selectedScrollSnap()).toBe(lastIndex);
      expect(emblaApi.previousScrollSnap()).toBe(firstIndex);
    });

    test("Stepping forward one snap at a time from the beginning", () => {
      let i = firstIndex;

      while (i !== lastIndex) {
        emblaApi.scrollNext();
        expect(emblaApi.previousScrollSnap()).toBe(i);
        i += 1;
        expect(emblaApi.selectedScrollSnap()).toBe(i);
      }
    });

    test("Stepping backward one snap at a time from the end", () => {
      emblaApi.reInit({ startIndex: lastIndex });
      let i = lastIndex;

      while (i !== firstIndex) {
        emblaApi.scrollPrev();
        expect(emblaApi.previousScrollSnap()).toBe(i);
        i -= 1;
        expect(emblaApi.selectedScrollSnap()).toBe(i);
      }
    });
  });
});
