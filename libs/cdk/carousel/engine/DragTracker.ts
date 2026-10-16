// Ported from embla-carousel (packages/embla-carousel/src/components/DragTracker.ts, v8.6.0), MIT, © David Jerleke.
// Rivet: the velocity math is `VelocityTracker` of `@rivetjs/cdk/motion` (`../../motion/DragTracker.ts`, numbers
// in); this adapter keeps upstream's event-facing API (`readPoint` from `clientX` / `clientY` of the mouse event or
// first touch, `evt.timeStamp` as time).
import type { AxisOptionType, AxisType } from "./Axis.ts";
import { isMouseEvent, type WindowType } from "./utils.ts";
import { VelocityTracker } from "../../motion/DragTracker.ts";

type PointerCoordType = keyof Touch | keyof MouseEvent;
export type PointerEventType = TouchEvent | MouseEvent;

export type DragTrackerType = {
  pointerDown: (evt: PointerEventType) => number;
  pointerMove: (evt: PointerEventType) => number;
  pointerUp: (evt: PointerEventType) => number;
  readPoint: (evt: PointerEventType, evtAxis?: AxisOptionType) => number;
};

export function DragTracker(axis: AxisType, ownerWindow: WindowType): DragTrackerType {
  const tracker = VelocityTracker();

  function readTime(evt: PointerEventType): number {
    return evt.timeStamp;
  }

  function readPoint(evt: PointerEventType, evtAxis?: AxisOptionType): number {
    const property = evtAxis || axis.scroll;
    const coord: PointerCoordType = `client${property === "x" ? "X" : "Y"}`;
    return (isMouseEvent(evt, ownerWindow) ? evt : evt.touches[0])[coord] as number;
  }

  function pointerDown(evt: PointerEventType): number {
    return tracker.pointerDown(readPoint(evt), readTime(evt));
  }

  function pointerMove(evt: PointerEventType): number {
    return tracker.pointerMove(readPoint(evt), readTime(evt));
  }

  function pointerUp(evt: PointerEventType): number {
    return tracker.pointerUp(readTime(evt));
  }

  const self: DragTrackerType = {
    pointerDown,
    pointerMove,
    pointerUp,
    readPoint,
  };
  return self;
}
