// Ported from @malva-ui/scheduler (src/lib/time-grid/scheduler-time-grid.ts + .html: labelled sheet group, header +
// all-day 2-row grid, one listbox of option slots per day, hour gutter, clustered timed chips, business-hours shading,
// now-line, roving tab stop default), MIT, © 2026 Malva UI.
// Rivet:
// - geometry as inline custom properties computed on the server (`--rv-scheduler-event-top` / `-height` / `-start` /
//   `-width`, `--rv-scheduler-offset` of hour labels): the HTML is final, nothing measures before input.
// - client work = `SchedulerTimeGridClient` (leaf module): initial scroll + `scrollToTime` requests (boots by design,
//   week / day only) and the minute clock (`visible`); the server renders no now-line.
// - roving tab stop = a region signal of `{ day, minutes }` (day number, not a column index) instead of malva's
//   `linkedSignal`; a stop whose day leaves the range or whose slot leaves the window falls back to the default
//   (today, else the first day, at the business start / 08:00 snapped to a rendered slot).
// - today: the root's day until the minute clock ticks, then the clock's (advances past midnight; the boot-free month
//   keeps the day it rendered until its next recompute).
// - all-day band: lanes never collapse (malva, `layoutRow(…, Infinity)`), the band grows (`--rv-scheduler-all-day-lanes`).
// - Chip drag / resize: delegated `schedulerPress` on the sheet (T6, lazy `drag.ts`); the target is the slot under the
//   floating clone's top edge. Range selection (T7): empty-slot presses go to the lazy `select.ts`; slots / all-day
//   cells paint `state.selection` continuously (malva).
// - Keyboard, clicks, focus hand-off (T8): delegated on the sheet (`keys-time-grid.ts` / `keys.ts`, leaf chunks);
//   timed chips carry their owning slot (`data-rv-slot`) so `Enter` / `Escape` / the hand-off are DOM lookups.
import { schedulerPart } from "./context.tsx";
import { computed, signal, untrack, useContext } from "@rivetjs/reactivity";
import { For, Show, ref as elementRef, type DOMValue } from "@rivetjs/runtime/dom";
import { SchedulerContext } from "./context.tsx";
import { SchedulerEventChip } from "./event.tsx";
import { SchedulerTimeGridClient, initialMinutes, snapToSlot } from "./time-grid-client.tsx";
import { schedulerPress, timeGridFocusIn, type TimeGridFocus } from "./behaviour.ts";
import { SCHEDULER_KEYS, chipFocusIn, chipFocusOut, schedulerInteraction } from "./keys.ts";
import { timeGridKeyDown } from "./keys-time-grid.ts";
import { formatDay, formatWall } from "./dates.ts";
import type { SchedulerBusinessHours, SchedulerClusteredSegment, SchedulerLaneSegment } from "./layout.ts";
import { DEFAULT_BUSINESS_DAYS, MINUTES_PER_DAY, parseTime, slotCount } from "./time.ts";
import {
  dateLabel,
  isCellSelected,
  schedulerSelectionBounds,
  schedulerSlotDuration,
  schedulerTimeGridLayout,
  schedulerTimeWindow,
  timeLabel,
} from "./state.ts";

/** One slot row of a day column. */
export interface SchedulerTimeSlot {
  /** Start, minutes of day. */
  readonly minutes: number;
  /** `"<date>, <time>"` (`slotLabel`). */
  readonly label: string;
  /** Outside `businessHours` (never set while `businessHours` is unset). */
  readonly outsideBusiness: boolean;
  /** Starts on a full hour. */
  readonly hour: boolean;
}

/** One rendered day of the time grid (malva `MlvSchedulerTimeColumn`, day numbers instead of dates). */
export interface SchedulerTimeColumn {
  readonly dayIndex: number;
  readonly day: number;
  /** Accessible name: the full date, `", today"` suffixed when it is. */
  readonly label: string;
  readonly weekday: string;
  readonly dayNumber: string;
  readonly today: boolean;
  readonly weekend: boolean;
  readonly slots: readonly SchedulerTimeSlot[];
}

interface BusinessWindow {
  readonly days: readonly number[];
  readonly start: number;
  readonly end: number;
}

const read = <V,>(value: V | (() => V)): V => (typeof value === "function" ? (value as () => V)() : value);
const keep = (previous: unknown, next: unknown): boolean => previous === next || next == null;
const sameNumbers = (a: readonly number[], b: readonly number[]): boolean => a.length === b.length && a.every((v, i) => v === b[i]);
const sameWindow = (a: { min: number; max: number }, b: { min: number; max: number }): boolean => a.min === b.min && a.max === b.max;
const NO_LANES: readonly SchedulerLaneSegment<any>[] = Object.freeze([]);
const NO_COLUMNS: readonly SchedulerClusteredSegment<any>[] = Object.freeze([]);
const percent = (value: number): string => value + "%";

/** Week / day time grid (internal part of `Scheduler`). */
export function SchedulerTimeGrid<T>(): DOMValue {
  const ctx = useContext(SchedulerContext)!;
  const state = ctx.state;
  const scroller = elementRef<HTMLDivElement>();
  const now = signal<number | null>(null);
  const focus = signal<TimeGridFocus | null>(null);

  // Today follows the minute clock once it ticks (past midnight the header, `data-today` and the default tab stop move
  // with the now-line); before the first tick (server, resumed page) it is the root's.
  const today = computed(() => {
    const base = ctx.today();
    const wall = now();
    return base === null || wall === null ? base : Math.floor(wall / MINUTES_PER_DAY);
  });
  const window = computed(() => schedulerTimeWindow(state), { equals: sameWindow });
  const slotDuration = computed(() => schedulerSlotDuration(state));
  const slots = computed(() => slotCount(window().min, window().max, slotDuration()));
  // Minutes covered by the RENDERED rows (`slotCount` is a ceil): every percentage divides by this (malva rule).
  const span = computed(() => slots() * slotDuration());
  const business = computed((): BusinessWindow | null => {
    const hours = read(state.options.businessHours) as SchedulerBusinessHours | null | undefined;
    return hours ? { days: hours.days ?? DEFAULT_BUSINESS_DAYS, start: parseTime(hours.start), end: parseTime(hours.end) } : null;
  });
  const selection = computed(() => schedulerSelectionBounds(state.selection(), ctx.days()));
  const layout = computed(() => schedulerTimeGridLayout<T>(ctx.events() as never, ctx.days(), window(), Number.POSITIVE_INFINITY));
  const dayKeys = computed(() => ctx.days().map((_day, index) => index), { equals: sameNumbers });
  // Static scaffolding only (headers, labels, slots): free of the events, so a drag preview never rebuilds the
  // `days × slots` labels (malva rule).
  const columns = computed((): SchedulerTimeColumn[] => {
    const locale = ctx.locale();
    const { min, max } = window();
    const step = slotDuration();
    const hours = business();
    const todayDay = today();
    const weekend = ctx.weekend();
    return ctx.days().map((day, dayIndex) => {
      const plain = dateLabel(day, locale);
      const weekday = (day + 4) % 7;
      const out: SchedulerTimeSlot[] = [];
      for (let minutes = min; minutes < max; minutes += step)
        out.push({
          minutes,
          label: ctx.t("slotLabel", { date: plain, time: timeLabel(day * MINUTES_PER_DAY + minutes, locale) }),
          outsideBusiness: !!hours && !(hours.days.includes(weekday) && minutes >= hours.start && minutes < hours.end),
          hour: minutes % 60 === 0,
        });
      return {
        dayIndex,
        day,
        label: todayDay === day ? ctx.t("dayLabelToday", { date: plain }) : plain,
        weekday: formatDay(day, locale, { weekday: "short" }),
        dayNumber: formatDay(day, locale, { day: "numeric" }),
        today: todayDay === day,
        weekend: weekend.includes(weekday),
        slots: out,
      };
    });
  });
  const lanesByDay = computed(() => {
    const byDay = new Map<number, SchedulerLaneSegment<T>[]>();
    for (const segment of layout().allDay.visible) {
      const bucket = byDay.get(segment.startIndex);
      if (bucket) bucket.push(segment);
      else byDay.set(segment.startIndex, [segment]);
    }
    return byDay;
  });
  const allDayLanes = () => Math.max(1, layout().allDay.laneCount);
  const hours = computed(() => {
    const { min, max } = window();
    const locale = ctx.locale();
    const total = span();
    const day = ctx.days()[0];
    const out: { minutes: number; label: string; offset: string }[] = [];
    if (day === undefined) return out;
    for (let minutes = Math.ceil(min / 60) * 60; minutes < max; minutes += 60)
      out.push({ minutes, label: formatWall(day * MINUTES_PER_DAY + minutes, locale, { hour: "numeric" }), offset: percent(((minutes - min) / total) * 100) });
    return out;
  });
  const gridLabel = () => {
    const days = ctx.days();
    const locale = ctx.locale();
    if (!days.length) return "";
    const first = dateLabel(days[0]!, locale);
    return ctx.view() === "day"
      ? ctx.t("gridLabel.day", { period: first })
      : ctx.t("gridLabel.week", { period: first + " – " + dateLabel(days[days.length - 1]!, locale) });
  };
  // Now-line: the column of the clock's day, offset in percent of the rendered span; hidden outside the window.
  const nowLine = computed(() => {
    const wall = now();
    if (wall === null || today() === null) return null;
    const dayIndex = ctx.days().indexOf(Math.floor(wall / MINUTES_PER_DAY));
    const minutes = wall % MINUTES_PER_DAY;
    const { min, max } = window();
    if (dayIndex < 0 || minutes < min || minutes > max) return null;
    return { dayIndex, offset: percent(((minutes - min) / span()) * 100) };
  });
  // Today (read untracked: a clock value, malva rule) else the first day, at the initial scroll time.
  const tabStop = computed((): { dayIndex: number; minutes: number | null } => {
    const days = ctx.days();
    const { min, max } = window();
    const step = slotDuration();
    const focused = focus();
    if (focused) {
      const dayIndex = days.indexOf(focused.day);
      const minutes = focused.minutes;
      if (dayIndex >= 0 && (minutes === null || (minutes >= min && minutes < max && (minutes - min) % step === 0))) return { dayIndex, minutes };
    }
    const current = untrack(today);
    const todayIndex = current === null ? -1 : days.indexOf(current);
    const start = (read(state.options.businessHours) as SchedulerBusinessHours | null | undefined)?.start;
    return { dayIndex: Math.max(0, todayIndex), minutes: snapToSlot(initialMinutes(start), min, max, step) };
  });
  const isStop = (dayIndex: number, minutes: number | null) => {
    const stop = tabStop();
    return stop.dayIndex === dayIndex && stop.minutes === minutes;
  };

  return (
    <div
      class="rv-SchedulerTimeGrid"
      style={{
        "--rv-scheduler-day-count": String(dayKeys().length),
        "--rv-scheduler-slot-count": String(slots()),
        "--rv-scheduler-all-day-lanes": String(allDayLanes()),
      }}
    >
      <div ref={scroller} class="rv-SchedulerTimeGrid-scroller" data-rv-scroller="" style={{ overflow: "auto", "overflow-anchor": "none" }}>
        <div
          class={schedulerPart("rv-SchedulerTimeGrid-sheet", ctx.classNames?.(), "grid")}
          role="group"
          aria-label={gridLabel()}
          style={{ "touch-action": "pan-x pan-y pinch-zoom", "user-select": "none", "-webkit-user-select": "none" }}
          data-rk={SCHEDULER_KEYS}
          onKeyDown={(e) => timeGridKeyDown(e, ctx)}
          onClick={(e) => schedulerInteraction("click", e, ctx)}
          onDblClick={(e) => schedulerInteraction("dblclick", e, ctx)}
          onContextMenu={(e) => schedulerInteraction("contextmenu", e, ctx)}
          onFocusIn={(e) => {
            timeGridFocusIn(e, ctx.days(), focus);
            chipFocusIn(e, ctx);
          }}
          onFocusOut={(e) => chipFocusOut(e, ctx)}
          onMouseDown={(e) => schedulerPress(e, state)}
          onTouchStart={(e) => schedulerPress(e, state)}
          onPointerDown={(e) => schedulerPress(e, state)}
        >
          <div class="rv-SchedulerTimeGrid-top" role="grid" aria-label={ctx.t("allDay")}>
            <div class="rv-SchedulerTimeGrid-header" role="row">
              <div class="rv-SchedulerTimeGrid-corner" role="presentation" />
              <For each={dayKeys} by={(i) => i}>
                {(indexOf) => {
                  const dayIndex = indexOf();
                  const column = computed(() => columns()[dayIndex]!, { equals: keep });
                  return (
                    <div
                      class={schedulerPart("rv-SchedulerTimeGrid-day-header", ctx.classNames?.(), "header")}
                      role="columnheader"
                      aria-label={column().label}
                      data-today={column().today ? "true" : undefined}
                      data-weekend={column().weekend ? "true" : undefined}
                    >
                      <span class="rv-SchedulerTimeGrid-weekday" aria-hidden="true">
                        {column().weekday}
                      </span>
                      <span class="rv-SchedulerTimeGrid-day-number" aria-hidden="true">
                        {column().dayNumber}
                      </span>
                    </div>
                  );
                }}
              </For>
            </div>
            <div class={schedulerPart("rv-SchedulerTimeGrid-all-day", ctx.classNames?.(), "allDay")} role="row">
              <div class="rv-SchedulerTimeGrid-all-day-label" role="presentation" aria-hidden="true">
                {ctx.t("allDay")}
              </div>
              <For each={dayKeys} by={(i) => i}>
                {(indexOf) => {
                  const dayIndex = indexOf();
                  const column = computed(() => columns()[dayIndex]!, { equals: keep });
                  const lanes = () => lanesByDay().get(dayIndex) ?? NO_LANES;
                  return (
                    <div
                      class={schedulerPart("rv-SchedulerTimeGrid-all-day-cell", ctx.classNames?.(), "cell")}
                      role="gridcell"
                      aria-label={column().label}
                      tabIndex={isStop(dayIndex, null) ? 0 : -1}
                      data-rv-day-index={String(dayIndex)}
                      data-rv-minutes="all-day"
                      data-today={column().today ? "true" : undefined}
                      data-weekend={column().weekend ? "true" : undefined}
                      aria-selected={isCellSelected(selection(), dayIndex, null) ? "true" : undefined}
                      data-selected={isCellSelected(selection(), dayIndex, null) ? "true" : undefined}
                    >
                      <div class="rv-SchedulerTimeGrid-all-day-lanes">
                        <For each={lanes} by={(segment) => segment.key}>
                          {(segment) => (
                            <SchedulerEventChip
                              segment={() => segment()}
                              lane={true}
                              spanning={() => segment().endIndex > segment().startIndex}
                              geometry={() => ({
                                "--rv-scheduler-lane": String(segment().lane + 1),
                                "--rv-scheduler-span": String(segment().endIndex - segment().startIndex + 1),
                              })}
                            />
                          )}
                        </For>
                      </div>
                    </div>
                  );
                }}
              </For>
            </div>
          </div>
          <div class="rv-SchedulerTimeGrid-body" role="presentation">
            <div class="rv-SchedulerTimeGrid-gutter" aria-hidden="true">
              <For each={hours} by={(hour) => hour.minutes}>
                {(hour) => (
                  <span class="rv-SchedulerTimeGrid-hour" style={{ "--rv-scheduler-offset": hour().offset }}>
                    <bdi>{hour().label}</bdi>
                  </span>
                )}
              </For>
            </div>
            <For each={dayKeys} by={(i) => i}>
              {(indexOf) => {
                const dayIndex = indexOf();
                const column = computed(() => columns()[dayIndex]!, { equals: keep });
                const slotsOf = () => column().slots;
                const segments = () => layout().columns[dayIndex] ?? NO_COLUMNS;
                return (
                  <div
                    class="rv-SchedulerTimeGrid-column"
                    role="presentation"
                    data-rv-day-index={String(dayIndex)}
                    data-today={column().today ? "true" : undefined}
                  >
                    <div
                      class="rv-SchedulerTimeGrid-slots"
                      role="listbox"
                      aria-label={column().label}
                      aria-multiselectable={ctx.selectable() ? "true" : undefined}
                    >
                      <For each={slotsOf} by={(slot) => slot.minutes}>
                        {(slot) => (
                          <div
                            class={schedulerPart("rv-SchedulerTimeGrid-slot", ctx.classNames?.(), "slot")}
                            role="option"
                            aria-label={slot().label}
                            tabIndex={isStop(dayIndex, slot().minutes) ? 0 : -1}
                            data-rv-day-index={String(dayIndex)}
                            data-rv-minutes={String(slot().minutes)}
                            data-outside-business={slot().outsideBusiness ? "true" : undefined}
                            data-hour={slot().hour ? "true" : undefined}
                            aria-selected={isCellSelected(selection(), dayIndex, slot().minutes) ? "true" : undefined}
                            data-selected={isCellSelected(selection(), dayIndex, slot().minutes) ? "true" : undefined}
                          />
                        )}
                      </For>
                    </div>
                    <div class="rv-SchedulerTimeGrid-events" role="presentation">
                      <For each={segments} by={(segment) => segment.key}>
                        {(segment) => (
                          <SchedulerEventChip
                            segment={() => segment()}
                            lane={false}
                            slot={() => {
                              // The slot owning the chip (malva `_owningSlotMinutes`): its start snapped down to a rendered row.
                              const { min } = window();
                              const step = slotDuration();
                              const last = min + (slots() - 1) * step;
                              return min + Math.floor((Math.min(last, segment().startMinutes) - min) / step) * step;
                            }}
                            geometry={() => {
                              const s = segment();
                              const { min } = window();
                              const total = span();
                              return {
                                "--rv-scheduler-event-top": percent(((s.startMinutes - min) / total) * 100),
                                "--rv-scheduler-event-height": percent(((s.endMinutes - s.startMinutes) / total) * 100),
                                "--rv-scheduler-event-start": percent((s.column / s.columns) * 100),
                                "--rv-scheduler-event-width": percent(100 / s.columns),
                              };
                            }}
                          />
                        )}
                      </For>
                    </div>
                    <Show when={() => nowLine()?.dayIndex === dayIndex}>
                      {() => (
                        <div
                          class={schedulerPart("rv-SchedulerTimeGrid-now", ctx.classNames?.(), "nowLine")}
                          aria-hidden="true"
                          style={{ "--rv-scheduler-offset": nowLine()?.offset }}
                        />
                      )}
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>
        </div>
      </div>
      <SchedulerTimeGridClient state={state} scroller={scroller} now={now} />
    </div>
  );
}
