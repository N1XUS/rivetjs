// Ported from embla-carousel (packages/embla-carousel/src/components/SlidesToScroll.ts, v8.6.0), MIT, © David Jerleke.
// Rivet: TypeScript module specifiers (`.ts`, `import type`), `as` casts (erasable syntax), formatting; otherwise verbatim.
import type { AxisType } from "./Axis.ts";
import type { NodeRectType } from "./NodeRects.ts";
import { arrayKeys, arrayLast, arrayLastIndex, isNumber, mathAbs } from "./utils.ts";

export type SlidesToScrollOptionType = "auto" | number;

export type SlidesToScrollType = {
  groupSlides: <Type>(array: Type[]) => Type[][];
};

export function SlidesToScroll(
  axis: AxisType,
  viewSize: number,
  slidesToScroll: SlidesToScrollOptionType,
  loop: boolean,
  containerRect: NodeRectType,
  slideRects: NodeRectType[],
  startGap: number,
  endGap: number,
  pixelTolerance: number,
): SlidesToScrollType {
  const { startEdge, endEdge, direction } = axis;
  const groupByNumber = isNumber(slidesToScroll);

  function byNumber<Type>(array: Type[], groupSize: number): Type[][] {
    return arrayKeys(array)
      .filter((i) => i % groupSize === 0)
      .map((i) => array.slice(i, i + groupSize));
  }

  function bySize<Type>(array: Type[]): Type[][] {
    if (!array.length) return [];

    return arrayKeys(array)
      .reduce((groups: number[], rectB, index) => {
        const rectA = arrayLast(groups) || 0;
        const isFirst = rectA === 0;
        const isLast = rectB === arrayLastIndex(array);

        const edgeA = containerRect[startEdge] - slideRects[rectA][startEdge];
        const edgeB = containerRect[startEdge] - slideRects[rectB][endEdge];
        const gapA = !loop && isFirst ? direction(startGap) : 0;
        const gapB = !loop && isLast ? direction(endGap) : 0;
        const chunkSize = mathAbs(edgeB - gapB - (edgeA + gapA));

        if (index && chunkSize > viewSize + pixelTolerance) groups.push(rectB);
        if (isLast) groups.push(array.length);
        return groups;
      }, [])
      .map((currentSize, index, groups) => {
        const previousSize = Math.max(groups[index - 1] || 0);
        return array.slice(previousSize, currentSize);
      });
  }

  function groupSlides<Type>(array: Type[]): Type[][] {
    return groupByNumber ? byNumber(array, slidesToScroll) : bySize(array);
  }

  const self: SlidesToScrollType = {
    groupSlides,
  };
  return self;
}
