// Ported from @malva-ui/scheduler (src/lib/layout/scheduler-layout.ts, src/lib/layout/scheduler-focus.ts
// `nextVisibleDate`, src/lib/scheduler/scheduler.types.ts), MIT, © 2026 Malva UI.
// Rivet:
// - Same functions and names minus the `Mlv` prefix, over integers instead of `MlvDateAdapter<D>` dates: days are
//   day numbers (`dates.ts`), event times are wall minutes (`day * 1440 + minute`). Adapter calls map 1:1
//   (`addCalendarDays` → `+ n`, `startOfDay` → `dayOf`, `compareDate*` → integer compare, `getDayOfWeek` →
//   `dayOfWeek`, …; table in `scheduler/CLAUDE.md`), so the layout never touches a date object.
// - `normalizeEvent(event, defaultEventDuration, timeZone)` reads the event dates once (`toWallMinutes`); an
//   unparsable date returns `null` (malva: Invalid Date propagates) and `normalizeEvents` drops it.
// - Sort keys are numeric (lane / cluster order unchanged: first day, span desc, all-day first, start, id).
// - Public types (malva `scheduler.types.ts`) live here: `SchedulerEvent.tone` → `color` (`info` → `accent`),
//   `color` → `cssColor`, `draggable` / `resizable` → `isDraggable` / `isResizable` (RAC naming).
// Deviation: wall-clock arithmetic — a moved timed event keeps its wall-clock duration (malva: elapsed minutes;
// the two differ only across a DST shift inside the event).
import { dayOf, dayOfWeek, toWallMinutes, civilFromDay, dayFromCivil, type SchedulerDate } from "./dates.ts";
import { MINUTES_PER_DAY } from "./time.ts";

/** Views shipped in phase 1. */
export type SchedulerView = "month" | "week" | "day";

/** Semantic event colour (malva `tone`; `info` → `accent`). */
export type SchedulerEventColor = "default" | "accent" | "success" | "warning" | "danger";

/** One calendar event. Dates are `@rivetjs/cdk/date` values or their `DateValueString` (resumable state: strings). */
export interface SchedulerEvent<T = unknown> {
  /** Stable identity; used for keys, focus restoration and model updates. */
  id: string;
  /** Visible title and the base of the accessible name. */
  title: string;
  /** Inclusive start. Midnight of the first day when `allDay`. */
  start: SchedulerDate;
  /** Exclusive end. `end <= start` is repaired to `start + defaultEventDuration` (timed) or one day (all-day). */
  end: SchedulerDate;
  /** Time parts are ignored; the event spans `startOfDay(start)` → `startOfDay(end)` (exclusive). */
  allDay?: boolean;
  /** Semantic colour. */
  color?: SchedulerEventColor;
  /** Any CSS colour; wins over `color`. */
  cssColor?: string;
  /** Per-event override; the scheduler-level `isReadOnly` still wins. Default `true`. */
  isDraggable?: boolean;
  /** Per-event override; the scheduler-level `isReadOnly` still wins. Default `true`. */
  isResizable?: boolean;
  /** Consumer payload, passed through untouched. */
  data?: T;
}

/** The dates a move, a resize or a veto hook is asked about (malva `MlvSchedulerNextRange`). */
export interface SchedulerRange<D = SchedulerDate> {
  /** Inclusive start. Midnight of the first day when `allDay`. */
  start: D;
  /** Exclusive end. Midnight of the day **after** the last one when `allDay`. */
  end: D;
  /** `true` renders the event in a lane (month grid / all-day row) instead of on the time axis. */
  allDay: boolean;
}

/** A `SchedulerRange` on the layout axis (wall minutes). */
export type SchedulerLayoutRange = SchedulerRange<number>;

/** What triggered a change. */
export type SchedulerChangeSource = "pointer" | "keyboard";

/** Payload of `onEventMove` and `onEventResize`. */
export interface SchedulerEventChange<T = unknown> {
  /** The updated event — a new object with the same `id`, already written to `events`. */
  event: SchedulerEvent<T>;
  /** The event's dates before the change. */
  previous: SchedulerRange;
  /** Whether a pointer gesture or a keyboard shortcut produced the change. */
  source: SchedulerChangeSource;
}

/** Payload of `onEventAction`, `onEventDoubleClick`, `onEventContextMenu` and `onEventDelete`. */
export interface SchedulerEventInteraction<T = unknown> {
  /** The event the chip renders, straight out of the `events` model. */
  event: SchedulerEvent<T>;
  /** The chip element — anchor for consumer menus and popovers. */
  element: HTMLElement;
  /**
   * The originating DOM event: the `click` / `dblclick` / `contextmenu` `MouseEvent`, or the `KeyboardEvent` of
   * `Enter` / `Space` (action), of the ContextMenu key / `Shift+F10` (context menu) or of `Delete` / `Backspace`
   * (`onEventDelete`, always prevented). On a `contextmenu` `MouseEvent`, `defaultPrevented` is `true` only when
   * `renderEventMenu` opened the built-in menu on it. A context-menu `KeyboardEvent` is always prevented.
   */
  nativeEvent: MouseEvent | KeyboardEvent;
}

/** Payload of `onSlotAction`, `onSlotDoubleClick` and `onSlotContextMenu`. */
export interface SchedulerSlotEvent<D = SchedulerDate> {
  /** Slot start (time grid) or the day (month grid / all-day row). */
  date: D;
  /** `true` for a month cell or an all-day cell, `false` for a time slot. */
  allDay: boolean;
  /** The cell or slot element that was activated. */
  element: HTMLElement;
  /** The originating DOM event (see `SchedulerEventInteraction.nativeEvent`). */
  nativeEvent: MouseEvent | KeyboardEvent;
}

/** Payload of `onRangeSelect`. */
export interface SchedulerRangeSelectEvent<D = SchedulerDate> {
  /** Inclusive start of the first selected slot or day. */
  start: D;
  /** Exclusive: the end of the last selected slot, or midnight after the last selected day. */
  end: D;
  /** `true` when the selection ran over month cells or the all-day row. */
  allDay: boolean;
  /** Whether a pointer drag or `Shift+Arrow` + `Enter` produced the selection. */
  source: SchedulerChangeSource;
}

/** Payload of `onExternalDrop` — a cdk drag-drop item from a list connected through `dropGroup`. */
export interface SchedulerExternalDropEvent<D = SchedulerDate, I = unknown> {
  /** The dragged item's `data`; the scheduler never moves the item out of its own list. */
  item: I;
  /** Start of the slot or day the item was dropped on. */
  start: D;
  /** `start + defaultEventDuration` for a timed target, `start + 1 day` for an all-day target. */
  end: D;
  /** `true` when the drop landed on a month cell or the all-day row. */
  allDay: boolean;
}

/** The rendered period. */
export interface SchedulerVisibleRange<D = SchedulerDate> {
  /** The view the range was computed for. */
  view: SchedulerView;
  /** Inclusive start of the first rendered day. */
  start: D;
  /** Exclusive: start of the day after the last rendered day. */
  end: D;
}

/** A `SchedulerVisibleRange` in day numbers. */
export type SchedulerDayRange = SchedulerVisibleRange<number>;

/** Working-hours shading for the time grid. */
export interface SchedulerBusinessHours {
  /** `'HH:mm'`. */
  start: string;
  /** `'HH:mm'`; `'24:00'` allowed. */
  end: string;
  /** Weekdays (0 = Sunday). Default Monday–Friday. */
  days?: readonly number[];
}

/** Veto hook for moves and resizes. Return `false` to snap back without emitting. */
export type SchedulerCanChange<T = unknown> = (event: SchedulerEvent<T>, next: SchedulerRange) => boolean;

/** Payload of `onMoreAction` (malva `moreClick`). */
export interface SchedulerMoreEvent<T = unknown, D = SchedulerDate> {
  /** The day whose cell overflowed. */
  date: D;
  /**
   * The day's hidden events (the ones behind the button), in render order. Deviation: malva's type doc says "hidden and
   * visible alike"; its implementation and spec emit the hidden ones — kept.
   */
  events: readonly SchedulerEvent<T>[];
}

/** An event with its dates read (wall minutes), repaired and all-day snapping applied. */
export interface SchedulerNormalizedEvent<T = unknown> {
  readonly event: SchedulerEvent<T>;
  /** Wall minutes. */
  readonly start: number;
  /** Wall minutes, exclusive, strictly after `start`. */
  readonly end: number;
  readonly allDay: boolean;
  /** Set on the drag preview copy rendered while a pointer drag is in progress. */
  readonly ghost?: boolean;
}

/** A run of consecutive visible days inside one row (month week row or the all-day row). */
export interface SchedulerRowSegment<T = unknown> {
  /** `${event.id}:r${startIndex}` — stable per rendered segment. */
  readonly key: string;
  readonly normalized: SchedulerNormalizedEvent<T>;
  /** Inclusive index into the visible-days array. */
  readonly startIndex: number;
  /** Inclusive. */
  readonly endIndex: number;
  /** The event started before this segment's first day. */
  readonly continuesBefore: boolean;
  /** The event ends after this segment's last day. */
  readonly continuesAfter: boolean;
}

/** One day's slice of a timed event, clipped to the visible hours. */
export interface SchedulerColumnSegment<T = unknown> {
  /** `${event.id}:c${dayIndex}`. */
  readonly key: string;
  readonly normalized: SchedulerNormalizedEvent<T>;
  readonly dayIndex: number;
  /** Minutes of day, already clipped to `[minMinutes, maxMinutes]`. */
  readonly startMinutes: number;
  readonly endMinutes: number;
  readonly continuesBefore: boolean;
  readonly continuesAfter: boolean;
}

/** Start (day number) of the week containing `day` (`firstDayOfWeek`: 0 = Sunday). */
export function startOfWeek(day: number, firstDayOfWeek: number): number {
  return day - ((dayOfWeek(day) - firstDayOfWeek + 7) % 7);
}

/** The rendered period (day numbers) for `view` anchored at `day`. */
export function computeVisibleRange(view: SchedulerView, day: number, firstDayOfWeek: number): SchedulerDayRange {
  switch (view) {
    case "month": {
      const [year, month] = civilFromDay(day);
      const first = dayFromCivil(year, month, 1);
      const last = (month === 12 ? dayFromCivil(year + 1, 1, 1) : dayFromCivil(year, month + 1, 1)) - 1;
      return { view, start: startOfWeek(first, firstDayOfWeek), end: startOfWeek(last, firstDayOfWeek) + 7 };
    }
    case "week": {
      const start = startOfWeek(day, firstDayOfWeek);
      return { view, start, end: start + 7 };
    }
    case "day":
      return { view, start: day, end: day + 1 };
  }
}

/**
 * The weekday indices in `hiddenDays` that can actually hide a rendered day: `dayOfWeek` only ever returns an
 * integer `0`–`6`, so anything else is dropped. A set covering **every** weekday is ignored rather than rendering
 * an empty grid — `visibleDays`, `rowLength`, `nextVisibleDate` and the month keyboard handler share this repair so
 * they can never disagree about how wide a week row is or which columns exist.
 */
export function hiddenWeekdays(hiddenDays: readonly number[]): ReadonlySet<number> {
  const hidden = new Set(hiddenDays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6));
  return hidden.size >= 7 ? new Set<number>() : hidden;
}

/** Every day in `range`, in order, minus the hidden weekdays. A `hiddenDays` covering all seven weekdays is ignored. */
export function visibleDays(range: SchedulerDayRange, hiddenDays: readonly number[]): readonly number[] {
  const hidden = hiddenWeekdays(hiddenDays);
  const days: number[] = [];
  for (let cursor = range.start; cursor < range.end; cursor++) if (!hidden.has(dayOfWeek(cursor))) days.push(cursor);
  return days;
}

/** Visible days per week row; never `0`, so a row loop always terminates. */
export function rowLength(hiddenDays: readonly number[]): number {
  return 7 - hiddenWeekdays(hiddenDays).size;
}

/** Index of the visible day `day` (a day number), or `-1`. */
export function dayIndexOf(days: readonly number[], day: number): number {
  return days.indexOf(day);
}

/**
 * Reads the event dates on the wall clock of `timeZone`, repairs `end <= start` and snaps all-day events to day
 * boundaries. `null` when a date does not parse.
 */
export function normalizeEvent<T>(event: SchedulerEvent<T>, defaultEventDuration: number, timeZone = "UTC"): SchedulerNormalizedEvent<T> | null {
  const s = toWallMinutes(event.start, timeZone);
  const e = toWallMinutes(event.end, timeZone);
  if (s === null || e === null) return null;
  if (event.allDay) {
    const start = dayOf(s) * MINUTES_PER_DAY;
    let end = dayOf(e) * MINUTES_PER_DAY;
    if (end <= start) end = start + MINUTES_PER_DAY;
    return { event, start, end, allDay: true };
  }
  return { event, start: s, end: e <= s ? s + defaultEventDuration : e, allDay: false };
}

/** `normalizeEvent` over a list, dropping events whose dates do not parse. */
export function normalizeEvents<T>(events: readonly SchedulerEvent<T>[], defaultEventDuration: number, timeZone = "UTC"): SchedulerNormalizedEvent<T>[] {
  const out: SchedulerNormalizedEvent<T>[] = [];
  for (const event of events) {
    const normalized = normalizeEvent(event, defaultEventDuration, timeZone);
    if (normalized) out.push(normalized);
  }
  return out;
}

/**
 * All-day events and timed events covering a full day or more live in lanes, not on the time axis. The span is
 * measured on the wall clock (layout minutes are wall minutes), so a 00:00 → 24:00 event on a DST day still covers
 * the whole day.
 */
export function isLaneEvent<T>(normalized: SchedulerNormalizedEvent<T>): boolean {
  return normalized.allDay || normalized.end - normalized.start >= MINUTES_PER_DAY;
}

/** Last calendar day (day number) the event touches (an exclusive midnight end does not touch the next day). */
export function lastDayOf<T>(normalized: SchedulerNormalizedEvent<T>): number {
  return normalized.allDay ? dayOf(normalized.end) - 1 : dayOf(normalized.end - 1);
}

/** Whether the event touches more than one calendar day. */
export function spansMultipleDays<T>(normalized: SchedulerNormalizedEvent<T>): boolean {
  return lastDayOf(normalized) > dayOf(normalized.start);
}

/**
 * Slices events into row segments over `days`, splitting at every `rowWidth` boundary (`rowLength(hiddenDays)` days
 * for a month grid, `days.length` for a single row). `only: 'lane'` keeps all-day / ≥ 24 h events (the time grid's
 * all-day row); `'all'` keeps every event (the month grid).
 */
export function sliceRows<T>(
  events: readonly SchedulerNormalizedEvent<T>[],
  days: readonly number[],
  rowWidth: number,
  only: "all" | "lane",
): SchedulerRowSegment<T>[] {
  const segments: SchedulerRowSegment<T>[] = [];
  const count = days.length;
  if (count === 0) return segments;
  const lastVisible = days[count - 1]!;
  const firstVisible = days[0]!;
  for (const normalized of events) {
    if (only === "lane" && !isLaneEvent(normalized)) continue;
    const firstDay = dayOf(normalized.start);
    const lastDay = lastDayOf(normalized);
    if (lastDay < firstVisible || firstDay > lastVisible) continue;
    let runStart = -1;
    for (let index = 0; index < count; index++) {
      const day = days[index]!;
      if (day < firstDay || day > lastDay) {
        if (runStart >= 0) {
          segments.push(rowSegment(normalized, runStart, index - 1, firstDay, lastDay, days));
          runStart = -1;
        }
        if (day > lastDay) break;
        continue;
      }
      if (runStart < 0) runStart = index;
      if (index % rowWidth === rowWidth - 1) {
        segments.push(rowSegment(normalized, runStart, index, firstDay, lastDay, days));
        runStart = -1;
      }
    }
    if (runStart >= 0) segments.push(rowSegment(normalized, runStart, count - 1, firstDay, lastDay, days));
  }
  return segments;
}

function rowSegment<T>(
  normalized: SchedulerNormalizedEvent<T>,
  startIndex: number,
  endIndex: number,
  firstDay: number,
  lastDay: number,
  days: readonly number[],
): SchedulerRowSegment<T> {
  return {
    key: normalized.event.id + ":r" + startIndex,
    normalized,
    startIndex,
    endIndex,
    continuesBefore: firstDay < days[startIndex]!,
    continuesAfter: lastDay > days[endIndex]!,
  };
}

/** Slices timed (non-lane) events into per-day column segments clipped to `[minMinutes, maxMinutes]`. */
export function sliceColumns<T>(
  events: readonly SchedulerNormalizedEvent<T>[],
  days: readonly number[],
  minMinutes: number,
  maxMinutes: number,
): SchedulerColumnSegment<T>[] {
  const segments: SchedulerColumnSegment<T>[] = [];
  for (const normalized of events) {
    if (isLaneEvent(normalized)) continue;
    // The same "last day touched" the row slicer uses: an exclusive midnight end does not reach the next day, and
    // no segment is produced there.
    const lastDay = lastDayOf(normalized);
    const startDay = dayOf(normalized.start);
    const endDay = dayOf(normalized.end);
    for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
      const day = days[dayIndex]!;
      if (startDay > day || endDay < day) continue;
      const segStart = startDay === day ? normalized.start - day * MINUTES_PER_DAY : 0;
      const segEnd = endDay === day ? normalized.end - day * MINUTES_PER_DAY : MINUTES_PER_DAY;
      if (segEnd <= segStart) continue;
      const startMinutes = Math.max(segStart, minMinutes);
      const endMinutes = Math.min(segEnd, maxMinutes);
      if (endMinutes <= startMinutes) continue;
      segments.push({
        key: normalized.event.id + ":c" + dayIndex,
        normalized,
        dayIndex,
        startMinutes,
        endMinutes,
        continuesBefore: startDay < day || segStart < startMinutes,
        continuesAfter: lastDay > day || segEnd > endMinutes,
      });
    }
  }
  return segments;
}

/** A row segment with its lane assigned. */
export interface SchedulerLaneSegment<T = unknown> extends SchedulerRowSegment<T> {
  readonly lane: number;
}

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function laneSortKey<T>(a: SchedulerRowSegment<T>, b: SchedulerRowSegment<T>): number {
  if (a.startIndex !== b.startIndex) return a.startIndex - b.startIndex;
  const spanA = a.endIndex - a.startIndex;
  const spanB = b.endIndex - b.startIndex;
  if (spanA !== spanB) return spanB - spanA;
  if (a.normalized.allDay !== b.normalized.allDay) return a.normalized.allDay ? -1 : 1;
  const byStart = a.normalized.start - b.normalized.start;
  if (byStart !== 0) return byStart;
  return compareIds(a.normalized.event.id, b.normalized.event.id);
}

/**
 * First-fit lane packing. Segments are ordered by first day, then by **descending** span (the longest bar in a row
 * takes the top lane), then all-day before timed, then by start time, then by event id — so the result is
 * deterministic for any input order. The returned array is in that order, not the input's; the input is left
 * untouched.
 */
export function assignLanes<T>(segments: readonly SchedulerRowSegment<T>[]): SchedulerLaneSegment<T>[] {
  const sorted = [...segments].sort(laneSortKey);
  // Per lane: the last occupied day index. Segments arrive by ascending start, so a lane is free for a segment
  // exactly when its last occupied index lies before the segment's start (same verdict as malva's interval scan).
  const laneEnds: number[] = [];
  return sorted.map((segment) => {
    let lane = 0;
    while (lane < laneEnds.length && laneEnds[lane]! >= segment.startIndex) lane++;
    laneEnds[lane] = segment.endIndex;
    return { ...segment, lane };
  });
}

/** What a row renders once lanes past `visibleLanes` collapse into "+N more". */
export interface SchedulerRowLayout<T = unknown> {
  /** Segments the row draws, in `assignLanes` order. Empty when no lane fits. */
  readonly visible: readonly SchedulerLaneSegment<T>[];
  /** Day index → hidden segments covering that day (rendering order). Only days with hidden events are present. */
  readonly hiddenByDay: ReadonlyMap<number, readonly SchedulerLaneSegment<T>[]>;
  /** Lanes the row would need without a budget — `0` for an empty row. */
  readonly laneCount: number;
}

/**
 * Applies a per-row lane budget. When the row needs more lanes than `visibleLanes`, the last visible lane is given
 * to the "+N more" button, so lanes `>= visibleLanes − 1` are hidden everywhere in the row.
 *
 * Precondition: `segments` carries the `lane` numbers `assignLanes` produced for **one** row — the budget is applied
 * per row, and `hiddenByDay` is keyed by day index within that row. A `visibleLanes` of `1` or less hides
 * everything, leaving the row to its "+N more" button alone.
 */
export function layoutRow<T>(segments: readonly SchedulerLaneSegment<T>[], visibleLanes: number): SchedulerRowLayout<T> {
  let laneCount = 0;
  for (const segment of segments) if (segment.lane + 1 > laneCount) laneCount = segment.lane + 1;
  if (laneCount <= visibleLanes) return { visible: segments, hiddenByDay: new Map(), laneCount };
  const threshold = Math.max(0, visibleLanes - 1);
  const visible: SchedulerLaneSegment<T>[] = [];
  const hiddenByDay = new Map<number, SchedulerLaneSegment<T>[]>();
  for (const segment of segments) {
    if (segment.lane < threshold) {
      visible.push(segment);
      continue;
    }
    for (let day = segment.startIndex; day <= segment.endIndex; day++) {
      const list = hiddenByDay.get(day);
      if (list) list.push(segment);
      else hiddenByDay.set(day, [segment]);
    }
  }
  return { visible, hiddenByDay, laneCount };
}

/** A column segment with its side-by-side placement. */
export interface SchedulerClusteredSegment<T = unknown> extends SchedulerColumnSegment<T> {
  /** Zero-based column inside the overlap cluster. */
  readonly column: number;
  /** Column count of the cluster (width = 100% / columns). */
  readonly columns: number;
}

/**
 * Sweep-line overlap clustering per day column. Touching segments do not overlap.
 *
 * Drag-preview ghosts (`normalized.ghost`) take no part in the packing and are appended last with `column: 0,
 * columns: 1` — full width, over their siblings — so a preview never resizes the events it is dragged across, and
 * the event being dragged keeps the geometry it had before the drag started.
 */
export function clusterColumns<T>(segments: readonly SchedulerColumnSegment<T>[]): SchedulerClusteredSegment<T>[] {
  const ghosts: SchedulerColumnSegment<T>[] = [];
  const sorted: SchedulerColumnSegment<T>[] = [];
  for (const segment of segments) (segment.normalized.ghost ? ghosts : sorted).push(segment);
  sorted.sort(
    (a, b) =>
      a.dayIndex - b.dayIndex || a.startMinutes - b.startMinutes || b.endMinutes - a.endMinutes || compareIds(a.normalized.event.id, b.normalized.event.id),
  );
  const out: SchedulerClusteredSegment<T>[] = [];
  let cluster: Array<{ segment: SchedulerColumnSegment<T>; column: number }> = [];
  let columnEnds: number[] = [];
  let clusterDay = -1;
  let clusterEnd = -Infinity;
  const flush = (): void => {
    const columns = columnEnds.length;
    for (const { segment, column } of cluster) out.push({ ...segment, column, columns });
    cluster = [];
    columnEnds = [];
    clusterEnd = -Infinity;
  };
  for (const segment of sorted) {
    if (cluster.length && (segment.dayIndex !== clusterDay || segment.startMinutes >= clusterEnd)) flush();
    clusterDay = segment.dayIndex;
    let column = columnEnds.findIndex((end) => end <= segment.startMinutes);
    if (column < 0) {
      column = columnEnds.length;
      columnEnds.push(segment.endMinutes);
    } else {
      columnEnds[column] = segment.endMinutes;
    }
    cluster.push({ segment, column });
    if (segment.endMinutes > clusterEnd) clusterEnd = segment.endMinutes;
  }
  flush();
  for (const segment of ghosts) out.push({ ...segment, column: 0, columns: 1 });
  return out;
}

/** Where a drag ended. */
export interface SchedulerDropTarget {
  /** Index into the view's visible-days array; clamped into range by the resolvers. */
  readonly dayIndex: number;
  /**
   * Snapped minutes of day for a time-column target, `null` for a day cell (a month cell or the all-day row), which
   * keeps the event's own time of day.
   */
  readonly minutes: number | null;
  /** `true` / `false` convert the event's kind; `null` keeps the event's own kind. */
  readonly allDay: boolean | null;
}

/** Whole calendar days an all-day event covers. */
export function daySpan<T>(normalized: SchedulerNormalizedEvent<T>): number {
  return Math.max(1, dayOf(normalized.end) - dayOf(normalized.start));
}

function clampIndex(index: number, length: number): number {
  return Math.min(length - 1, Math.max(0, index));
}

/** Resolves a drop: keeps duration, converts kind when the target says so, keeps time-of-day for day-cell targets. */
export function resolveMove<T>(
  normalized: SchedulerNormalizedEvent<T>,
  target: SchedulerDropTarget,
  days: readonly number[],
  defaultEventDuration: number,
): SchedulerLayoutRange {
  const day = days[clampIndex(target.dayIndex, days.length)]! * MINUTES_PER_DAY;
  const allDay = target.allDay ?? normalized.allDay;
  if (allDay) {
    const span = normalized.allDay ? daySpan(normalized) : 1;
    return { start: day, end: day + span * MINUTES_PER_DAY, allDay: true };
  }
  if (normalized.allDay) {
    const start = day + (target.minutes ?? 0);
    return { start, end: start + defaultEventDuration, allDay: false };
  }
  const duration = normalized.end - normalized.start;
  const start = target.minutes === null ? day + (normalized.start - dayOf(normalized.start) * MINUTES_PER_DAY) : day + target.minutes;
  return { start, end: start + duration, allDay: false };
}

/** Which edge of an event a resize gesture drags. */
export type SchedulerResizeEdge = "start" | "end";

/**
 * Resolves a resize of one edge. Lane targets (`minutes === null`) resize by whole days; time targets by minutes. The
 * opposite edge never moves, and the result is clamped so the event keeps at least one snap step (one day for an
 * all-day bar).
 */
export function resolveResize<T>(
  normalized: SchedulerNormalizedEvent<T>,
  target: { readonly dayIndex: number; readonly minutes: number | null },
  days: readonly number[],
  snapDuration: number,
  edge: SchedulerResizeEdge = "end",
): SchedulerLayoutRange {
  const day = days[clampIndex(target.dayIndex, days.length)]! * MINUTES_PER_DAY;
  const step = Math.max(1, snapDuration);
  if (edge === "start") {
    if (normalized.allDay) {
      const maxStart = (dayOf(normalized.end) - 1) * MINUTES_PER_DAY;
      return { start: Math.min(day, maxStart), end: normalized.end, allDay: true };
    }
    const start = target.minutes === null ? day + (normalized.start - dayOf(normalized.start) * MINUTES_PER_DAY) : day + target.minutes;
    return { start: Math.min(start, normalized.end - step), end: normalized.end, allDay: false };
  }
  if (normalized.allDay) {
    const minEnd = (dayOf(normalized.start) + 1) * MINUTES_PER_DAY;
    return { start: normalized.start, end: Math.max(day + MINUTES_PER_DAY, minEnd), allDay: true };
  }
  let end: number;
  if (target.minutes === null) {
    const endMinutes = normalized.end - dayOf(normalized.end) * MINUTES_PER_DAY;
    end = endMinutes === 0 ? day + MINUTES_PER_DAY : day + endMinutes;
  } else {
    end = day + target.minutes;
  }
  return { start: normalized.start, end: Math.max(end, normalized.start + step), allDay: false };
}

/**
 * The next calendar day (day number) in `direction` that is not a hidden weekday (at most 7 steps away).
 * `hiddenDays` goes through `hiddenWeekdays()`, so this agrees with what the grid renders: an all-seven set is
 * ignored, out-of-range entries are dropped.
 */
export function nextVisibleDate(from: number, direction: -1 | 1, hiddenDays: readonly number[]): number {
  const hidden = hiddenWeekdays(hiddenDays);
  let date = from + direction;
  for (let step = 0; step < 7 && hidden.has(dayOfWeek(date)); step++) date += direction;
  return date;
}
