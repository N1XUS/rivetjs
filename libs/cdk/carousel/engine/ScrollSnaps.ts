// Ported from embla-carousel (packages/embla-carousel/src/components/ScrollSnaps.ts, v8.6.0), MIT, © David Jerleke.
// Rivet: TypeScript module specifiers (`.ts`, `import type`), `as` casts (erasable syntax), formatting; otherwise verbatim.
import type { AlignmentType } from "./Alignment.ts";
import type { AxisType } from "./Axis.ts";
import type { NodeRectType } from "./NodeRects.ts";
import type { SlidesToScrollType } from "./SlidesToScroll.ts";
import { arrayLast, mathAbs } from "./utils.ts";

export type ScrollSnapsType = {
  snaps: number[];
  snapsAligned: number[];
};

export function ScrollSnaps(
  axis: AxisType,
  alignment: AlignmentType,
  containerRect: NodeRectType,
  slideRects: NodeRectType[],
  slidesToScroll: SlidesToScrollType,
): ScrollSnapsType {
  const { startEdge, endEdge } = axis;
  const { groupSlides } = slidesToScroll;
  const alignments = measureSizes().map(alignment.measure);
  const snaps = measureUnaligned();
  const snapsAligned = measureAligned();

  function measureSizes(): number[] {
    return groupSlides(slideRects)
      .map((rects) => arrayLast(rects)[endEdge] - rects[0][startEdge])
      .map(mathAbs);
  }

  function measureUnaligned(): number[] {
    return slideRects.map((rect) => containerRect[startEdge] - rect[startEdge]).map((snap) => -mathAbs(snap));
  }

  function measureAligned(): number[] {
    return groupSlides(snaps)
      .map((g) => g[0])
      .map((snap, index) => snap + alignments[index]);
  }

  const self: ScrollSnapsType = {
    snaps,
    snapsAligned,
  };
  return self;
}
