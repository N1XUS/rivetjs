// Ported from @malva-ui/scheduler (src/lib/time-grid/scheduler-time-grid.ts `scrollOffsetFor`, `_initialMinutes`,
// `_snapToSlot`, `_scrollTo`, the initial-scroll + `scrollRequest` `afterRenderEffect`s; src/lib/scheduler/scheduler.ts
// minute tick), MIT, © 2026 Malva UI.
// Rivet: the time grid's only load-time client work, in a leaf module (its chunk imports reactivity, `time.ts` and the
// zone lookup only — never the view's render graph, `docs/guides/resumability.md` "App guidance"):
// - initial scroll: one `clientEffect` re-applied when the view / `minTime` / `maxTime` / `slotDuration` /
//   `scrollToCurrentTime` change (week ↔ day reuse one grid, malva rule);
// - `schedulerScrollToTime` request: applied once, then consumed (registered after the initial scroll: the later
//   writer wins in the same tick, malva rule);
// - the minute clock behind the now-line (`when: "visible"`, ticks only while `showCurrentTime` is on and the tab is
//   visible (`visibilitychange`); never imports drag code; the server
//   renders no now-line, so no stale time sits in the HTML).
import { untrack, type Signal } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";
import { now as zonedNow } from "../date/queries.ts";
import { MINUTES_PER_DAY, parseTime, slotCount } from "./time.ts";
import type { SchedulerState } from "./state.ts";

/**
 * Pixel offset that puts `minutes` at the top of the viewport (malva `scrollOffsetFor`). `headroomPx` = pixels kept
 * above the target (half an hour label top-aligned, half the visible region centred); clamped at `0`.
 */
export function scrollOffsetFor(minutes: number, minMinutes: number, slotDuration: number, slotHeightPx: number, headroomPx = 0): number {
  return Math.max(0, ((minutes - minMinutes) / slotDuration) * slotHeightPx - headroomPx);
}

/** `08:00`, or the business-hours start (malva `_initialMinutes`). */
export function initialMinutes(businessStart: string | undefined): number {
  return businessStart ? parseTime(businessStart) : 8 * 60;
}

/** Clamps to the rendered rows and snaps down to a slot start (malva `_snapToSlot`). */
export function snapToSlot(minutes: number, min: number, max: number, slotDuration: number): number {
  const last = min + (slotCount(min, max, slotDuration) - 1) * slotDuration;
  const clamped = Math.min(last, Math.max(min, minutes));
  return min + Math.floor((clamped - min) / slotDuration) * slotDuration;
}

const read = <V,>(value: V | (() => V)): V => (typeof value === "function" ? (value as () => V)() : value);

interface Axis {
  min: number;
  max: number;
  slot: number;
}

function axisOf(state: SchedulerState<any>): Axis {
  const options = state.options;
  return { min: parseTime(read(options.minTime) ?? "00:00"), max: parseTime(read(options.maxTime) ?? "24:00"), slot: read(options.slotDuration) ?? 30 };
}

/** Minutes of day of the wall clock in the scheduler zone. */
function nowMinutes(state: SchedulerState<any>): number {
  const n = zonedNow(read(state.options.timeZone) ?? state.zone);
  return n.hour * 60 + n.minute;
}

/** The current wall minutes (`day * 1440 + minute`) in the scheduler zone. */
function nowWallMinutes(state: SchedulerState<any>): number {
  const n = zonedNow(read(state.options.timeZone) ?? state.zone);
  return Math.floor(Date.UTC(n.year, n.month - 1, n.day) / 86_400_000) * MINUTES_PER_DAY + n.hour * 60 + n.minute;
}

/**
 * Scrolls the time grid (malva `_scrollTo`): `"start"` snaps down to the owning slot and keeps half an hour label of
 * headroom (the label straddles its line); `"center"` keeps the exact minute and centres it in the region below the
 * sticky header + all-day band. Nothing measurable → no-op.
 */
export function scrollTimeGrid(scroller: HTMLElement, minutes: number, axis: Axis, align: "start" | "center" = "start"): void {
  const slot = scroller.querySelector<HTMLElement>(".rv-SchedulerTimeGrid-slot");
  if (!slot) return;
  if (align === "center") {
    const top = scroller.querySelector<HTMLElement>(".rv-SchedulerTimeGrid-top");
    const target = Math.min(axis.max, Math.max(axis.min, minutes));
    scroller.scrollTop = scrollOffsetFor(target, axis.min, axis.slot, slot.offsetHeight, (scroller.clientHeight + (top?.offsetHeight ?? 0)) / 2);
    return;
  }
  const label = scroller.querySelector<HTMLElement>(".rv-SchedulerTimeGrid-hour");
  scroller.scrollTop = scrollOffsetFor(
    snapToSlot(minutes, axis.min, axis.max, axis.slot),
    axis.min,
    axis.slot,
    slot.offsetHeight,
    (label?.offsetHeight ?? 0) / 2,
  );
}

export interface SchedulerTimeGridClientProps {
  state: SchedulerState<any>;
  /** The scroll container (`.rv-SchedulerTimeGrid-scroller`). */
  scroller: () => HTMLElement | undefined | null;
  /** Wall minutes of the clock (region signal of the grid; `null` until the first tick). */
  now: Signal<number | null>;
}

/** Client effects of the time grid (internal; renders nothing). */
export function SchedulerTimeGridClient(props: SchedulerTimeGridClientProps): null {
  const state = props.state;
  const scroller = props.scroller;
  const now = props.now;
  // Initial scroll, re-applied when the axis or the view changes. The clock is read here, untracked, not through the
  // now-line signal (malva rule: a hidden line never ticks, so its minute would be stale).
  // Resumed page: the initial scroll is applied when the grid scrolls into view (CEFF 2026-10-28; was idle: every week /
  // day view booted at load).
  clientEffect(
    () => {
      const element = scroller();
      state.view.value();
      const axis = axisOf(state);
      const centre = !!read(state.options.scrollToCurrentTime);
      const business = read(state.options.businessHours);
      if (!element) return;
      untrack(() => {
        const minutes = nowMinutes(state);
        if (centre && minutes >= axis.min && minutes < axis.max) scrollTimeGrid(element, minutes, axis, "center");
        else scrollTimeGrid(element, initialMinutes(business?.start), axis);
      });
    },
    { when: "visible" },
  );
  // `schedulerScrollToTime`: applied once by the live grid, then consumed; only the request is tracked.
  // A request made before the grid adopted is still pending when it adopts (`visible` below): no trigger of its own.
  clientEffect(
    () => {
      const request = state.scrollRequest();
      const element = scroller();
      if (!request || !element) return;
      untrack(() => {
        scrollTimeGrid(element, parseTime(request.time), axisOf(state));
        if (untrack(state.scrollRequest)?.sequence === request.sequence) state.scrollRequest.set(null);
      });
    },
    { when: "interaction" },
  );
  // Minute clock of the now-line.
  clientEffect(
    () => {
      if (!(read(state.options.showCurrentTime) ?? true)) return void now.set(null);
      const tick = () => now.set(nowWallMinutes(state));
      let timeout: ReturnType<typeof setTimeout> | undefined;
      let interval: ReturnType<typeof setInterval> | undefined;
      const stop = () => {
        clearTimeout(timeout);
        clearInterval(interval);
        timeout = interval = undefined;
      };
      // Ticks on the minute while the tab is visible; a hidden tab runs no timer and catches up on its return.
      const start = () => {
        stop();
        if (document.hidden) return;
        tick();
        timeout = setTimeout(
          () => {
            tick();
            interval = setInterval(tick, 60_000);
          },
          60_000 - (Date.now() % 60_000),
        );
      };
      start();
      document.addEventListener("visibilitychange", start);
      return () => {
        stop();
        document.removeEventListener("visibilitychange", start);
      };
    },
    { when: "visible" },
  );
  return null;
}
