// Ported from embla-carousel (packages/embla-carousel/src/components/SlideSizes.ts, v8.6.0), MIT, © David Jerleke.
// Rivet: TypeScript module specifiers (`.ts`, `import type`), `as` casts (erasable syntax), formatting; otherwise verbatim.
import type { AxisType } from "./Axis.ts";
import type { NodeRectType } from "./NodeRects.ts";
import { arrayIsLastIndex, arrayLast, mathAbs, type WindowType } from "./utils.ts";

export type SlideSizesType = {
  slideSizes: number[];
  slideSizesWithGaps: number[];
  startGap: number;
  endGap: number;
};

export function SlideSizes(
  axis: AxisType,
  containerRect: NodeRectType,
  slideRects: NodeRectType[],
  slides: HTMLElement[],
  readEdgeGap: boolean,
  ownerWindow: WindowType,
): SlideSizesType {
  const { measureSize, startEdge, endEdge } = axis;
  const withEdgeGap = slideRects[0] && readEdgeGap;
  const startGap = measureStartGap();
  const endGap = measureEndGap();
  const slideSizes = slideRects.map(measureSize);
  const slideSizesWithGaps = measureWithGaps();

  function measureStartGap(): number {
    if (!withEdgeGap) return 0;
    const slideRect = slideRects[0];
    return mathAbs(containerRect[startEdge] - slideRect[startEdge]);
  }

  function measureEndGap(): number {
    if (!withEdgeGap) return 0;
    const style = ownerWindow.getComputedStyle(arrayLast(slides));
    return parseFloat(style.getPropertyValue(`margin-${endEdge}`));
  }

  function measureWithGaps(): number[] {
    return slideRects
      .map((rect, index, rects) => {
        const isFirst = !index;
        const isLast = arrayIsLastIndex(rects, index);
        if (isFirst) return slideSizes[index] + startGap;
        if (isLast) return slideSizes[index] + endGap;
        return rects[index + 1][startEdge] - rect[startEdge];
      })
      .map(mathAbs);
  }

  const self: SlideSizesType = {
    slideSizes,
    slideSizesWithGaps,
    startGap,
    endGap,
  };
  return self;
}
