// Ported from embla-carousel (packages/embla-carousel/src/components/SlideRegistry.ts, v8.6.0), MIT, © David Jerleke.
// Rivet: TypeScript module specifiers (`.ts`, `import type`), `as` casts (erasable syntax), formatting; otherwise verbatim.
import type { LimitType } from "../../motion/Limit.ts";
import type { ScrollContainOptionType } from "./ScrollContain.ts";
import type { SlidesToScrollType } from "./SlidesToScroll.ts";
import { arrayFromNumber, arrayIsLastIndex, arrayLast, arrayLastIndex } from "./utils.ts";

export type SlideRegistryType = {
  slideRegistry: number[][];
};

export function SlideRegistry(
  containSnaps: boolean,
  containScroll: ScrollContainOptionType,
  scrollSnaps: number[],
  scrollContainLimit: LimitType,
  slidesToScroll: SlidesToScrollType,
  slideIndexes: number[],
): SlideRegistryType {
  const { groupSlides } = slidesToScroll;
  const { min, max } = scrollContainLimit;
  const slideRegistry = createSlideRegistry();

  function createSlideRegistry(): number[][] {
    const groupedSlideIndexes = groupSlides(slideIndexes);
    const doNotContain = !containSnaps || containScroll === "keepSnaps";

    if (scrollSnaps.length === 1) return [slideIndexes];
    if (doNotContain) return groupedSlideIndexes;

    return groupedSlideIndexes.slice(min, max).map((group, index, groups) => {
      const isFirst = !index;
      const isLast = arrayIsLastIndex(groups, index);

      if (isFirst) {
        const range = arrayLast(groups[0]) + 1;
        return arrayFromNumber(range);
      }
      if (isLast) {
        const range = arrayLastIndex(slideIndexes) - arrayLast(groups)[0] + 1;
        return arrayFromNumber(range, arrayLast(groups)[0]);
      }
      return group;
    });
  }

  const self: SlideRegistryType = {
    slideRegistry,
  };
  return self;
}
