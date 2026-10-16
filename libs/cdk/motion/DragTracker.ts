// Ported from embla-carousel (packages/embla-carousel/src/components/DragTracker.ts, v8.6.0), MIT, © David Jerleke.
// Rivet:
// - DOM-agnostic split for `@rivetjs/cdk/motion`: upstream reads `clientX` / `clientY` + `timeStamp` from mouse /
//   touch events; here the caller passes the point (px along its axis) and the time (ms) — `pointerDown(point,
//   time)`, `pointerMove(point, time)`, `pointerUp(time)`. Same math: a 170 ms log interval restarts the velocity
//   window on long moves; `pointerUp` returns the flick force in px/ms (0 when the last move is older than the
//   interval or |force| <= 0.1). The carousel engine's `DragTracker.ts` adapts events onto it.
import { mathAbs } from "./utils.ts";

export type VelocityTrackerType = {
  pointerDown: (point: number, time: number) => number;
  pointerMove: (point: number, time: number) => number;
  pointerUp: (time: number) => number;
};

type SampleType = { point: number; time: number };

/** Drag velocity tracker (embla DragTracker): numbers in (pointer position, time stamp), diff / flick force out. */
export function VelocityTracker(): VelocityTrackerType {
  const logInterval = 170;

  let startEvent: SampleType | undefined;
  let lastEvent: SampleType | undefined;

  function pointerDown(point: number, time: number): number {
    startEvent = { point, time };
    lastEvent = startEvent;
    return point;
  }

  function pointerMove(point: number, time: number): number {
    const diff = point - lastEvent!.point;
    const expired = time - startEvent!.time > logInterval;

    lastEvent = { point, time };
    if (expired) startEvent = lastEvent;
    return diff;
  }

  function pointerUp(time: number): number {
    if (!startEvent || !lastEvent) return 0;
    const diffDrag = lastEvent.point - startEvent.point;
    const diffTime = time - startEvent.time;
    const expired = time - lastEvent.time > logInterval;
    const force = diffDrag / diffTime;
    const isFlick = diffTime && !expired && mathAbs(force) > 0.1;

    return isFlick ? force : 0;
  }

  const self: VelocityTrackerType = {
    pointerDown,
    pointerMove,
    pointerUp,
  };
  return self;
}
