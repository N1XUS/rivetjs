// Ported from @malva-ui/scheduler (src/lib/scheduler/scheduler.ts models, computeds and public methods,
// src/lib/scheduler/scheduler-context.ts `commitChange` / `announce`), MIT, © 2026 Malva UI.
// Rivet:
// - Angular `model()` / `input()` / `computed()` on a component class → `createSchedulerState(props)`: plain data
//   of `controllable` values (`events`, `view`, `date`), the caller's option values / accessors as
//   given (never wrapped: closures built in a `.ts` module do not resume) and interaction signals holding strings /
//   numbers only. Derived values are pure free functions over the state (`schedulerVisibleRange(state)`,
//   `schedulerTitle(state)`, `schedulerMonthLayout(…)`, …); components memoize them in `computed`s of their own
//   (`.tsx`, resumable), so the server-rendered layout is rebuilt from serialized inputs.
// - Methods → free functions: `next()` → `schedulerNext(state)`, `previous()` → `schedulerPrevious`, `goToToday()` →
//   `schedulerToday`, `goTo(d)` → `schedulerGoTo`, `setView(v)` → `schedulerSetView`, `scrollToTime(t)` →
//   `schedulerScrollToTime`; `commitChange(kind, normalized, next, source)` → `commitChange(state, change)`.
// - `MlvDateAdapter` → integer layout (`dates.ts`); written-back dates keep the form of the value they replace.
// - Announcements: malva's two alternating polite regions → `announcement` signal pair (`schedulerAnnounce`), the
//   root renders them (kept over the cdk `announcer`, T8 ruling: server-rendered regions exist before the first
//   message — no Safari 100 ms creation skip — and a repeat is still a change, the two-slot rule).
// Deviation: `onVisibleRangeChange` fires when a state function moves the range bounds (toolbar, keys, API) — not on
// init (the initial range belongs to the route loader: no client work at load) and not for writes the caller makes
// to its own `date` / `view` signal (the caller made that change).
import { signal, untrack, type Signal } from "@rivetjs/reactivity";
import { DEV, devWhere } from "#dev";
import { controllable, controlledValue, setControlledValue, type ControlledState } from "../interactions/controllable.ts";
import { CalendarDate } from "../date/CalendarDate.ts";
import { getDayOfWeek, getLocalTimeZone, isWeekend, type DayOfWeek } from "../date/queries.ts";
import {
  addCalendarMonths,
  civilFromDay,
  dayFromCivil,
  dayOf,
  dayOfWeek,
  formatDay,
  formatWall,
  fromLayout,
  minuteOf,
  todayDay,
  toWallMinutes,
  type SchedulerDate,
} from "./dates.ts";
import {
  assignLanes,
  clusterColumns,
  computeVisibleRange,
  layoutRow,
  nextVisibleDate,
  normalizeEvents,
  rowLength as computeRowLength,
  sliceColumns,
  sliceRows,
  visibleDays,
  type SchedulerBusinessHours,
  type SchedulerCanChange,
  type SchedulerChangeSource,
  type SchedulerClusteredSegment,
  type SchedulerDayRange,
  type SchedulerEvent,
  type SchedulerEventChange,
  type SchedulerEventInteraction,
  type SchedulerSlotEvent,
  type SchedulerExternalDropEvent,
  type SchedulerRangeSelectEvent,
  type SchedulerLaneSegment,
  type SchedulerLayoutRange,
  type SchedulerNormalizedEvent,
  type SchedulerRange,
  type SchedulerRowLayout,
  type SchedulerRowSegment,
  type SchedulerView,
  type SchedulerVisibleRange,
} from "./layout.ts";
import { schedulerString, schedulerStrings, type SchedulerMessageKey, type SchedulerStrings } from "./intl.ts";
import { MINUTES_PER_DAY, parseTime } from "./time.ts";
import { schedulerDaysKey, schedulerSelectionBounds, type SchedulerCell, type SchedulerSelection, type SchedulerSelectionBounds } from "./selection.ts";

export * from "./selection.ts";

/** A value, or an accessor read where it is used (live prop). */
export type MaybeAccessor<T> = T | (() => T);

const read = <T>(value: MaybeAccessor<T>): T => (typeof value === "function" ? (value as () => T)() : value);

/** Lanes per month row / all-day band when `visibleLanes` is `"auto"` (malva's fallback before measuring). */
export const DEFAULT_VISIBLE_LANES = 3;

/** Options read live (each a value or an accessor). */
export interface SchedulerOptions {
  /**
   * Wall clock of the layout. Default: the zone resolved when the state is created — `"UTC"` on the server (kept by
   * the resumed page, dev warning), the local zone for a client-only render. Pass it for local time on SSR pages.
   */
  timeZone?: MaybeAccessor<string | undefined>;
  /** Locale of labels, strings, first day of week and weekend. Default `"en-US"` (components pass `useLocale()`). */
  locale?: MaybeAccessor<string | undefined>;
  /** First day of the week. Default: locale. */
  firstDayOfWeek?: MaybeAccessor<DayOfWeek | undefined>;
  /** Weekdays (0 = Sunday) removed from every view. */
  hiddenDays?: MaybeAccessor<readonly number[] | undefined>;
  /** Weekdays (0 = Sunday) marked `data-weekend`. Default: locale weekend. */
  weekendDays?: MaybeAccessor<readonly number[] | undefined>;
  /** First visible time of the time grid (`"HH:mm"`). Default `"00:00"`. */
  minTime?: MaybeAccessor<string | undefined>;
  /** End of the time grid (`"HH:mm"`, `"24:00"` allowed). Default `"24:00"`. */
  maxTime?: MaybeAccessor<string | undefined>;
  /** Slot height unit, positive minutes. Default `30`. */
  slotDuration?: MaybeAccessor<number | undefined>;
  /** Drag / resize / selection granularity, positive minutes. Default: `slotDuration`. */
  snapDuration?: MaybeAccessor<number | undefined>;
  /** Minutes for all-day → timed drops, external drops and `end <= start` repair. Default `60`. */
  defaultEventDuration?: MaybeAccessor<number | undefined>;
  /** Working-hours shading; `null` = none. */
  businessHours?: MaybeAccessor<SchedulerBusinessHours | null | undefined>;
  /** Lane cap of month rows (the time grid's all-day band never collapses: it grows). `"auto"` = `DEFAULT_VISIBLE_LANES` (ui: density default). */
  visibleLanes?: MaybeAccessor<number | "auto" | undefined>;
  /** Disables move / resize / delete (pointer and keyboard). malva `editable` inverse. */
  isReadOnly?: MaybeAccessor<boolean | undefined>;
  /** Pointer + keyboard range selection. malva `selectable`. Default `true`. */
  allowsRangeSelection?: MaybeAccessor<boolean | undefined>;
  /** Now-line and today highlight. Default `true`. */
  showCurrentTime?: MaybeAccessor<boolean | undefined>;
  /** Centre the current time on the initial time-grid scroll. Default `false`. */
  scrollToCurrentTime?: MaybeAccessor<boolean | undefined>;
  /** Week-number column of the month grid. Default `false`. */
  showWeekNumbers?: MaybeAccessor<boolean | undefined>;
  /** String overrides on top of the locale table. */
  strings?: MaybeAccessor<Partial<SchedulerStrings> | undefined>;
}

/** `createSchedulerState` input. Handlers and veto hooks are read once. */
export interface SchedulerStateProps<T = unknown> extends SchedulerOptions {
  /** Events: a Signal (two-way), a value or an accessor (controlled: use `onEventsChange`). */
  events?: readonly SchedulerEvent<T>[] | Signal<readonly SchedulerEvent<T>[]> | (() => readonly SchedulerEvent<T>[]);
  defaultEvents?: readonly SchedulerEvent<T>[];
  onEventsChange?: (events: readonly SchedulerEvent<T>[]) => void;
  view?: SchedulerView | Signal<SchedulerView> | (() => SchedulerView);
  defaultView?: SchedulerView;
  onViewChange?: (view: SchedulerView) => void;
  /** Anchor date (any form; written back in the same form). Default: today in `timeZone`. */
  date?: SchedulerDate | Signal<SchedulerDate> | (() => SchedulerDate);
  defaultDate?: SchedulerDate;
  onDateChange?: (date: SchedulerDate) => void;
  /** Move veto (read once). */
  canMove?: SchedulerCanChange<T>;
  /** Resize veto (read once). */
  canResize?: SchedulerCanChange<T>;
  onEventMove?: (change: SchedulerEventChange<T>) => void;
  onEventResize?: (change: SchedulerEventChange<T>) => void;
  onVisibleRangeChange?: (range: SchedulerVisibleRange) => void;
  /** A pointer drag (or `Shift+Arrow` + `Enter`) over empty cells committed a range (malva `rangeSelect`). Read once at mount. */
  onRangeSelect?: (range: SchedulerRangeSelectEvent) => void;
  /** A cdk drag-drop item from a connected list was dropped on a cell (malva `externalDrop`); nothing is written. Read once at mount. */
  onExternalDrop?: (drop: SchedulerExternalDropEvent) => void;
  /** Chip click / `Enter` / `Space` (malva `eventClick`). Read once at mount. */
  onEventAction?: (interaction: SchedulerEventInteraction<T>) => void;
  /** Chip double click (malva `eventDoubleClick`). Read once at mount. */
  onEventDoubleClick?: (interaction: SchedulerEventInteraction<T>) => void;
  /** Chip right click, ContextMenu key / `Shift+F10` (malva `eventContextMenu`). Read once at mount. */
  onEventContextMenu?: (interaction: SchedulerEventInteraction<T>) => void;
  /** `Delete` / `Backspace` on a focused chip while editable (prevented; the caller removes the event). Read once at mount. */
  onEventDelete?: (interaction: SchedulerEventInteraction<T>) => void;
  /** Click / `Space` (or `Enter` without a chip) on a cell or slot (malva `slotClick`). Read once at mount. */
  onSlotAction?: (slot: SchedulerSlotEvent) => void;
  /** Double click on a cell or slot (malva `slotDoubleClick`). Read once at mount. */
  onSlotDoubleClick?: (slot: SchedulerSlotEvent) => void;
  /** Right click, ContextMenu key / `Shift+F10` on a cell or slot (malva `slotContextMenu`). Read once at mount. */
  onSlotContextMenu?: (slot: SchedulerSlotEvent) => void;
}

/** The drag preview (ghost) of a pointer gesture in flight: wall minutes of the event's would-be dates. */
export interface SchedulerDragPreview extends SchedulerLayoutRange {
  readonly id: string;
}

/** A `schedulerScrollToTime` request waiting for the time grid (`sequence` guards `consumeScrollRequest`). */
export interface SchedulerScrollRequest {
  readonly time: string;
  readonly sequence: number;
}

/**
 * What the active view should focus after its next render (malva `MlvSchedulerFocusRequest`): a chip (`eventId`,
 * preferring its segment on `day`) or a cell (`eventId` `null`: the cell of `day`, `minutes` `null` = month cell /
 * all-day cell, else the slot owning that minute). Day numbers, not indexes: a request made before a navigation
 * names the day of the period that will render.
 */
export interface SchedulerFocusRequest {
  readonly eventId: string | null;
  readonly day: number | null;
  readonly minutes: number | null;
}

/** Scheduler state (serializable: controllable values, the caller's option values / accessors, plain signals). */
export interface SchedulerState<T = unknown> {
  readonly events: ControlledState<readonly SchedulerEvent<T>[]>;
  readonly view: ControlledState<SchedulerView>;
  readonly date: ControlledState<SchedulerDate>;
  readonly options: SchedulerOptions;
  /**
   * The zone resolved at creation when no `timeZone` is given (server: `"UTC"`, browser: the local zone). Region
   * state, so a resumed page keeps laying out in the zone the server rendered with (no chip jump, no `data-today`
   * move on the first recompute).
   */
  readonly zone: string;
  readonly canMove: SchedulerCanChange<T> | undefined;
  readonly canResize: SchedulerCanChange<T> | undefined;
  readonly onEventMove: ((change: SchedulerEventChange<T>) => void) | undefined;
  readonly onEventResize: ((change: SchedulerEventChange<T>) => void) | undefined;
  readonly onVisibleRangeChange: ((range: SchedulerVisibleRange) => void) | undefined;
  readonly onRangeSelect: ((range: SchedulerRangeSelectEvent) => void) | undefined;
  readonly onExternalDrop: ((drop: SchedulerExternalDropEvent) => void) | undefined;
  readonly onEventAction: ((interaction: SchedulerEventInteraction<T>) => void) | undefined;
  readonly onEventDoubleClick: ((interaction: SchedulerEventInteraction<T>) => void) | undefined;
  readonly onEventContextMenu: ((interaction: SchedulerEventInteraction<T>) => void) | undefined;
  readonly onEventDelete: ((interaction: SchedulerEventInteraction<T>) => void) | undefined;
  readonly onSlotAction: ((slot: SchedulerSlotEvent) => void) | undefined;
  readonly onSlotDoubleClick: ((slot: SchedulerSlotEvent) => void) | undefined;
  readonly onSlotContextMenu: ((slot: SchedulerSlotEvent) => void) | undefined;
  /** Pending range selection. */
  readonly selection: Signal<SchedulerSelection | null>;
  /** Drag preview of the gesture in flight. */
  readonly dragPreview: Signal<SchedulerDragPreview | null>;
  /** `true` while a pointer gesture owns the pointer (root `user-select: none`). */
  readonly dragging: Signal<boolean>;
  /** Latest `schedulerScrollToTime` request. */
  readonly scrollRequest: Signal<SchedulerScrollRequest | null>;
  /** Focus target after the next render (keyboard moves, removed chips). */
  readonly pendingFocus: Signal<SchedulerFocusRequest | null>;
  /** Day index of the open `+N more` popover. */
  readonly popoverDay: Signal<number | null>;
  /** The two polite live-region texts (exactly one non-empty after an announcement). */
  readonly announcement: Signal<readonly [string, string]>;
}

const isServer = (): boolean => typeof document === "undefined";

/** Creates the scheduler state. */
export function createSchedulerState<T = unknown>(props: SchedulerStateProps<T> = {}): SchedulerState<T> {
  const {
    events,
    defaultEvents,
    onEventsChange,
    view,
    defaultView,
    onViewChange,
    date,
    defaultDate,
    onDateChange,
    canMove,
    canResize,
    onEventMove,
    onEventResize,
    onVisibleRangeChange,
    onRangeSelect,
    onExternalDrop,
    onEventAction,
    onEventDoubleClick,
    onEventContextMenu,
    onEventDelete,
    onSlotAction,
    onSlotDoubleClick,
    onSlotContextMenu,
    ...options
  } = props;
  const given = untrack(() => read(options.timeZone));
  const zone = defaultTimeZone();
  if (DEV && given === undefined && isServer() && !warnedZone) {
    warnedZone = true;
    console.warn(
      '[rivet:cdk] scheduler: no `timeZone` on a server-rendered Scheduler: the page lays out in "UTC" (the server\'s ' +
        "default, kept on the resumed page). Pass `timeZone` (e.g. the user's zone from a cookie) for local time." +
        devWhere(),
    );
  }
  const timeZone = given ?? zone;
  return {
    events: controllable<readonly SchedulerEvent<T>[]>(events, defaultEvents ?? [], onEventsChange),
    view: controllable<SchedulerView>(view, defaultView ?? "month", onViewChange),
    date: controllable<SchedulerDate>(date, defaultDate ?? todayString(timeZone), onDateChange),
    options,
    zone,
    canMove,
    canResize,
    onEventMove,
    onEventResize,
    onVisibleRangeChange,
    onRangeSelect,
    onExternalDrop,
    onEventAction,
    onEventDoubleClick,
    onEventContextMenu,
    onEventDelete,
    onSlotAction,
    onSlotDoubleClick,
    onSlotContextMenu,
    selection: signal<SchedulerSelection | null>(null),
    dragPreview: signal<SchedulerDragPreview | null>(null),
    dragging: signal(false),
    scrollRequest: signal<SchedulerScrollRequest | null>(null),
    pendingFocus: signal<SchedulerFocusRequest | null>(null),
    popoverDay: signal<number | null>(null),
    announcement: signal<readonly [string, string]>(["", ""]),
  };
}

let warnedZone = false;

function defaultTimeZone(): string {
  return isServer() ? "UTC" : getLocalTimeZone();
}

function todayString(timeZone: string): string {
  const [y, m, d] = civilFromDay(todayDay(timeZone));
  return new CalendarDate(y, m, d).toString();
}

// ─── Options ───────────────────────────────────────────────────────────────

/** The layout zone: `timeZone`, else the zone resolved when the state was created (`state.zone`). */
export function schedulerTimeZone(state: SchedulerState<any>): string {
  return read(state.options.timeZone) ?? state.zone;
}

/** The locale. */
export function schedulerLocale(state: SchedulerState<any>): string {
  return read(state.options.locale) ?? "en-US";
}

const DAY_OF_WEEK: Record<DayOfWeek, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const localeWeek = new Map<string, { first: number; weekend: readonly number[] }>();

function weekInfo(locale: string): { first: number; weekend: readonly number[] } {
  let info = localeWeek.get(locale);
  if (!info) {
    // 1970-01-04 is a Sunday (weekday 0).
    const sunday = new CalendarDate(1970, 1, 4);
    const first = (7 - getDayOfWeek(sunday, locale)) % 7;
    const weekend: number[] = [];
    for (let i = 0; i < 7; i++) if (isWeekend(sunday.add({ days: i }), locale)) weekend.push(i);
    if (localeWeek.size >= 64) localeWeek.clear();
    localeWeek.set(locale, (info = { first, weekend }));
  }
  return info;
}

/** First day of the week, 0 = Sunday (`firstDayOfWeek` or the locale's). */
export function schedulerFirstDay(state: SchedulerState<any>): number {
  const first = read(state.options.firstDayOfWeek);
  return first ? DAY_OF_WEEK[first] : weekInfo(schedulerLocale(state)).first;
}

/** Weekend weekdays (`weekendDays` or the locale's). */
export function schedulerWeekendDays(state: SchedulerState<any>): readonly number[] {
  return read(state.options.weekendDays) ?? weekInfo(schedulerLocale(state)).weekend;
}

/** `hiddenDays` (raw; layout functions repair it). */
export function schedulerHiddenDays(state: SchedulerState<any>): readonly number[] {
  return read(state.options.hiddenDays) ?? [];
}

/** Slot duration in minutes. */
export function schedulerSlotDuration(state: SchedulerState<any>): number {
  return read(state.options.slotDuration) ?? 30;
}

/** Effective snap: `snapDuration` or `slotDuration`. */
export function schedulerSnap(state: SchedulerState<any>): number {
  return read(state.options.snapDuration) ?? schedulerSlotDuration(state);
}

/** `defaultEventDuration` in minutes. */
export function schedulerDefaultDuration(state: SchedulerState<any>): number {
  return read(state.options.defaultEventDuration) ?? 60;
}

/** Lane cap of month rows (the time grid's all-day band never collapses: it passes `Infinity`). */
export function schedulerVisibleLanes(state: SchedulerState<any>): number {
  const lanes = read(state.options.visibleLanes);
  return lanes === undefined || lanes === "auto" ? DEFAULT_VISIBLE_LANES : lanes;
}

/** Whether move / resize / delete are allowed (scheduler level). */
export function schedulerEditable(state: SchedulerState<any>): boolean {
  return !read(state.options.isReadOnly);
}

/** Whether the now-line / today highlight shows. */
export function schedulerShowsCurrentTime(state: SchedulerState<any>): boolean {
  return read(state.options.showCurrentTime) ?? true;
}

/**
 * `[minTime, maxTime)` as minutes of day, validated as one pair: a window that is not strictly ascending would write
 * `NaN%` / `Infinity%` geometry, so it fails loudly (malva text).
 */
export function schedulerTimeWindow(state: SchedulerState<any>): { min: number; max: number } {
  const minTime = read(state.options.minTime) ?? "00:00";
  const maxTime = read(state.options.maxTime) ?? "24:00";
  const min = parseTime(minTime);
  const max = parseTime(maxTime);
  if (max <= min) throw new Error(`[rivet:cdk] scheduler: Invalid scheduler time window "${minTime}"–"${maxTime}". minTime must be earlier than maxTime.`);
  return { min, max };
}

/** Resolved strings (locale table + `strings` overrides). */
export function schedulerStringTable(state: SchedulerState<any>): SchedulerStrings {
  return schedulerStrings(schedulerLocale(state), read(state.options.strings));
}

/** One translated message (`schedulerString` over the resolved table). */
export function schedulerTranslate(
  state: SchedulerState<any>,
  key: SchedulerMessageKey | "moreEvents" | "moreEventsLabel",
  vars?: Record<string, string | number | boolean>,
): string {
  return schedulerString(schedulerStringTable(state), key, vars, schedulerLocale(state));
}

// ─── Derived values (pure; components memoize them) ────────────────────────

/** Day number of the anchor date (today when it does not parse). */
export function schedulerAnchorDay(state: SchedulerState<any>, date: SchedulerDate = state.date.value()): number {
  const wall = toWallMinutes(date, schedulerTimeZone(state));
  return wall === null ? todayDay(schedulerTimeZone(state)) : dayOf(wall);
}

/** The rendered period in day numbers. */
export function schedulerDayRange(state: SchedulerState<any>, view: SchedulerView = state.view.value(), date?: SchedulerDate): SchedulerDayRange {
  return computeVisibleRange(view, schedulerAnchorDay(state, date ?? state.date.value()), schedulerFirstDay(state));
}

/** The rendered period, dates in the form of the anchor date (malva public `visibleRange`). */
export function schedulerVisibleRange(state: SchedulerState<any>): SchedulerVisibleRange {
  return toDateRange(state, schedulerDayRange(state), state.date.value());
}

function toDateRange(state: SchedulerState<any>, range: SchedulerDayRange, like: SchedulerDate): SchedulerVisibleRange {
  const timeZone = schedulerTimeZone(state);
  return { view: range.view, start: fromLayout(range.start, 0, like, timeZone, true), end: fromLayout(range.end, 0, like, timeZone, true) };
}

/**
 * Days rendered by the active view, after `hiddenDays`. In the day view `hiddenDays` steers navigation but never
 * blanks the grid: an anchor on a hidden weekday renders that day as asked.
 */
export function schedulerDays(state: SchedulerState<any>, range: SchedulerDayRange = schedulerDayRange(state)): readonly number[] {
  const days = visibleDays(range, schedulerHiddenDays(state));
  return days.length === 0 && range.view === "day" ? visibleDays(range, []) : days;
}

/** Visible days per month week row. */
export function schedulerRowLength(state: SchedulerState<any>): number {
  return computeRowLength(schedulerHiddenDays(state));
}

/** Localized title: month-year, "Aug 31 – Sep 6, 2026", or the full day label. */
export function schedulerTitle(state: SchedulerState<any>): string {
  const locale = schedulerLocale(state);
  const range = schedulerDayRange(state);
  const anchor = schedulerAnchorDay(state);
  switch (range.view) {
    case "month":
      return formatDay(anchor, locale, { month: "long", year: "numeric" });
    case "week":
      return (
        formatDay(range.start, locale, { day: "numeric", month: "short" }) +
        " – " +
        formatDay(range.end - 1, locale, { day: "numeric", month: "short", year: "numeric" })
      );
    case "day":
      return formatDay(anchor, locale, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  }
}

/** `events` normalized (wall minutes in `timeZone`; unparsable dates dropped, dev warning once per event object). */
export function schedulerNormalizedEvents<T>(state: SchedulerState<T>): SchedulerNormalizedEvent<T>[] {
  const events = state.events.value();
  const normalized = normalizeEvents(events, schedulerDefaultDuration(state), schedulerTimeZone(state));
  if (DEV && normalized.length < events.length) warnUnplaced(events, normalized);
  return normalized;
}

let warned: WeakSet<object> | undefined;

function warnUnplaced<T>(events: readonly SchedulerEvent<T>[], normalized: readonly SchedulerNormalizedEvent<T>[]): void {
  const placed = new Set<object>(normalized.map((n) => n.event));
  for (const event of events) {
    if (placed.has(event) || (warned ??= new WeakSet()).has(event)) continue;
    warned.add(event);
    console.warn(
      `[rivet:cdk] scheduler: event "${event.id}" is not shown: its start / end does not parse as a date (${String(event.start)} – ${String(event.end)}).` +
        devWhere(),
    );
  }
}

/** Ghost id suffix of the drag preview copy. */
export const GHOST_SUFFIX = "__rv-ghost";

/**
 * `normalized` plus the drag preview ghost (a copy of the dragged event at its would-be dates, `ghost: true`, id
 * suffixed with `GHOST_SUFFIX`) while a gesture is in flight.
 */
export function schedulerWithPreview<T>(state: SchedulerState<T>, normalized: readonly SchedulerNormalizedEvent<T>[]): readonly SchedulerNormalizedEvent<T>[] {
  const preview = state.dragPreview();
  if (!preview) return normalized;
  const source = normalized.find((n) => n.event.id === preview.id);
  if (!source) return normalized;
  const ghost: SchedulerNormalizedEvent<T> = {
    event: { ...source.event, id: source.event.id + GHOST_SUFFIX },
    start: preview.start,
    end: preview.end,
    allDay: preview.allDay,
    ghost: true,
  };
  return [...normalized, ghost];
}

/** One month week row. */
export interface SchedulerMonthRow<T = unknown> {
  readonly index: number;
  /** First and last (inclusive) visible-day index of the row. */
  readonly startIndex: number;
  readonly endIndex: number;
  /** Every segment of the row (popover lists). */
  readonly segments: readonly SchedulerRowSegment<T>[];
  /** Lanes + `+N more` overflow. */
  readonly layout: SchedulerRowLayout<T>;
}

/** Month rows → lane-packed segments with the lane budget applied (server-exact: no measurement). */
export function schedulerMonthLayout<T>(
  events: readonly SchedulerNormalizedEvent<T>[],
  days: readonly number[],
  rowLength: number,
  visibleLanes: number,
): SchedulerMonthRow<T>[] {
  const segments = sliceRows(events, days, rowLength, "all");
  const byRow: SchedulerRowSegment<T>[][] = [];
  for (const segment of segments) (byRow[Math.floor(segment.startIndex / rowLength)] ??= []).push(segment);
  const rows: SchedulerMonthRow<T>[] = [];
  for (let row = 0; row * rowLength < days.length; row++) {
    const rowSegments = byRow[row] ?? [];
    rows.push({
      index: row,
      startIndex: row * rowLength,
      endIndex: Math.min(days.length, (row + 1) * rowLength) - 1,
      segments: rowSegments,
      layout: layoutRow(assignLanes(rowSegments), visibleLanes),
    });
  }
  return rows;
}

/** Week / day time grid: the all-day band (lanes) and per-day clustered timed segments. */
export interface SchedulerTimeGridLayout<T = unknown> {
  readonly allDay: SchedulerRowLayout<T>;
  readonly allDaySegments: readonly SchedulerLaneSegment<T>[];
  /** `columns[dayIndex]` = clustered segments of that day. */
  readonly columns: readonly (readonly SchedulerClusteredSegment<T>[])[];
}

/** Time-grid layout (lanes for all-day / ≥ 24 h events, clusters for timed ones). */
export function schedulerTimeGridLayout<T>(
  events: readonly SchedulerNormalizedEvent<T>[],
  days: readonly number[],
  window: { min: number; max: number },
  visibleLanes: number,
): SchedulerTimeGridLayout<T> {
  const lanes = assignLanes(sliceRows(events, days, Math.max(1, days.length), "lane"));
  const columns: SchedulerClusteredSegment<T>[][] = days.map(() => []);
  for (const segment of clusterColumns(sliceColumns(events, days, window.min, window.max))) columns[segment.dayIndex]!.push(segment);
  return { allDay: layoutRow(lanes, visibleLanes), allDaySegments: lanes, columns };
}

/** ISO week number (Monday-based) of a day number — month grid week-number column. */
export function isoWeekNumber(day: number): number {
  const thursday = day - ((dayOfWeek(day) + 6) % 7) + 3;
  const [year] = civilFromDay(thursday);
  return Math.floor((thursday - dayFromCivil(year, 1, 1)) / 7) + 1;
}

// ─── Mutations (free functions) ────────────────────────────────────────────

function emitRange(state: SchedulerState<any>, before: SchedulerDayRange): void {
  const view = controlledValue(state.view);
  const date = controlledValue(state.date);
  const after = schedulerDayRange(state, view, date);
  if (after.view === before.view && after.start === before.start && after.end === before.end) return;
  state.onVisibleRangeChange?.(toDateRange(state, after, date));
  // The single place a period change is announced (malva `_announceRange`): title of the range that just won.
  schedulerAnnounce(state, schedulerTranslate(state, "rangeChanged", { period: titleFor(state, after, date) }));
}

function titleFor(state: SchedulerState<any>, range: SchedulerDayRange, date: SchedulerDate): string {
  const locale = schedulerLocale(state);
  const anchor = schedulerAnchorDay(state, date);
  return range.view === "month"
    ? formatDay(anchor, locale, { month: "long", year: "numeric" })
    : range.view === "week"
      ? formatDay(range.start, locale, { day: "numeric", month: "short" }) +
        " – " +
        formatDay(range.end - 1, locale, { day: "numeric", month: "short", year: "numeric" })
      : formatDay(anchor, locale, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function withRange(state: SchedulerState<any>, change: () => void): void {
  const before = untrack(() => schedulerDayRange(state, controlledValue(state.view), controlledValue(state.date)));
  change();
  untrack(() => emitRange(state, before));
}

/** Jumps to `date` (the period containing it becomes visible). */
export function schedulerGoTo(state: SchedulerState<any>, date: SchedulerDate): void {
  withRange(state, () => setControlledValue(state.date, date));
}

/** Switches the view. A switch to the month drops a pending `schedulerScrollToTime` request (no grid to apply it). */
export function schedulerSetView(state: SchedulerState<any>, view: SchedulerView): void {
  withRange(state, () => setControlledValue(state.view, view));
  if (view === "month" && untrack(state.scrollRequest)) state.scrollRequest.set(null);
}

/** Jumps to today (written in the form of the current anchor). */
export function schedulerToday(state: SchedulerState<any>): void {
  const like = untrack(() => controlledValue(state.date));
  schedulerGoTo(state, fromLayout(todayDay(schedulerTimeZone(state)), 0, like, schedulerTimeZone(state), true));
}

/** Moves one period forward (month / week / day per `view`). */
export function schedulerNext(state: SchedulerState<any>): void {
  step(state, 1);
}

/** Moves one period back. */
export function schedulerPrevious(state: SchedulerState<any>): void {
  step(state, -1);
}

function step(state: SchedulerState<any>, direction: -1 | 1): void {
  untrack(() => {
    const date = controlledValue(state.date);
    const timeZone = schedulerTimeZone(state);
    const wall = toWallMinutes(date, timeZone) ?? todayDay(timeZone) * MINUTES_PER_DAY;
    const day = dayOf(wall);
    let next: number;
    switch (controlledValue(state.view)) {
      case "month":
        next = addCalendarMonths(day, direction);
        break;
      case "week":
        next = day + 7 * direction;
        break;
      case "day":
        // A single-day range on a hidden weekday would render nothing, so the day view steps over them.
        next = nextVisibleDate(day, direction, schedulerHiddenDays(state));
        break;
    }
    schedulerGoTo(state, fromLayout(next, minuteOf(wall), date, timeZone));
  });
}

/**
 * Scrolls the time grid so `time` (`"HH:mm"`) sits at the top. No-op in the settled month view: a request still
 * standing at the end of the task while the month shows is dropped (malva rule); a switch to week / day in the same
 * task still wins.
 */
export function schedulerScrollToTime(state: SchedulerState<any>, time: string): void {
  const sequence = (untrack(state.scrollRequest)?.sequence ?? 0) + 1;
  state.scrollRequest.set({ time, sequence });
  // The settled view decides (malva constructor effect), not the view at call time: a switch to week / day written
  // after this call in the same task still wins, a month that is still showing once the task settles drops it — a
  // request left standing would beat the next time grid's documented initial scroll. No load-time effect: the month
  // view stays boot-free.
  queueMicrotask(() =>
    untrack(() => {
      if (controlledValue(state.view) === "month" && state.scrollRequest()?.sequence === sequence) state.scrollRequest.set(null);
    }),
  );
}

/** Time grid → state: clears the request it applied (a newer request survives). */
export function consumeScrollRequest(state: SchedulerState<any>, sequence: number): void {
  const current = untrack(state.scrollRequest);
  if (current && current.sequence === sequence) state.scrollRequest.set(null);
}

// ─── Range selection ───────────────────────────────────────────────────────

/**
 * The selection as a half-open wall-minute range (malva `_selectionRange`): all-day = midnight of the first day →
 * midnight after the last; timed = first slot start → end of the last slot, capped at `maxTime` (24:00 = the next
 * day's midnight).
 */
export function schedulerSelectionRange(state: SchedulerState<any>, bounds: SchedulerSelectionBounds): SchedulerLayoutRange {
  return untrack(() => {
    const days = schedulerDays(state);
    const first = days[Math.max(0, Math.min(days.length - 1, bounds.dayFrom))]!;
    const last = days[Math.max(0, Math.min(days.length - 1, bounds.dayTo))]!;
    if (bounds.allDay) return { start: first * MINUTES_PER_DAY, end: (last + 1) * MINUTES_PER_DAY, allDay: true };
    const end = Math.min(bounds.to + schedulerSlotDuration(state), schedulerTimeWindow(state).max);
    return { start: first * MINUTES_PER_DAY + bounds.from, end: last * MINUTES_PER_DAY + end, allDay: false };
  });
}

/** Wall minutes → the caller's date form (the anchor date's: string in → string out). */
export function schedulerDateOf(state: SchedulerState<any>, wall: number, allDay: boolean): SchedulerDate {
  return untrack(() => fromLayout(dayOf(wall), minuteOf(wall), state.date.value(), schedulerTimeZone(state), allDay));
}

/** Commits the pending selection as `onRangeSelect` and clears it (malva `_commitSelection`). */
export function commitSelection(state: SchedulerState<any>, source: SchedulerChangeSource): void {
  untrack(() => {
    const bounds = schedulerSelectionBounds(state.selection(), schedulerDays(state));
    state.selection.set(null);
    if (!bounds) return;
    const range = schedulerSelectionRange(state, bounds);
    state.onRangeSelect?.({
      start: schedulerDateOf(state, range.start, range.allDay),
      end: schedulerDateOf(state, range.end, range.allDay),
      allDay: range.allDay,
      source,
    });
  });
}

/** Per-state live-region bookkeeping (runtime only): next slot + messages of this task. */
const liveSlots = new WeakMap<SchedulerState<any>, { slot: 0 | 1; batch: number }>();

/**
 * Announces `message` politely (malva `announce`): written into the region the previous message did not use, the
 * other one emptied, so a repeat of the same text is a change the screen reader speaks (two-slot rule). The second and
 * further messages of one task keep the other region (they share one render: a keyboard move that also leaves the
 * period announces the move and the new period, and clearing would drop the move).
 */
export function schedulerAnnounce(state: SchedulerState<any>, message: string): void {
  const [first, second] = untrack(state.announcement);
  let live = liveSlots.get(state);
  if (!live) liveSlots.set(state, (live = { slot: first ? 1 : 0, batch: 0 }));
  const slot = live.slot;
  const keepOther = live.batch > 0;
  live.slot = slot === 0 ? 1 : 0;
  if (live.batch++ === 0) queueMicrotask(() => (live.batch = 0));
  state.announcement.set(slot === 0 ? [message, keepOther ? second : ""] : [keepOther ? first : "", message]);
}

/** A move / resize request (`commitChange`). */
export interface SchedulerCommit<T = unknown> {
  readonly kind: "move" | "resize";
  readonly normalized: SchedulerNormalizedEvent<T>;
  /** Would-be dates (wall minutes). */
  readonly next: SchedulerLayoutRange;
  readonly source: SchedulerChangeSource;
}

/**
 * Applies a move / resize: the veto hook decides (`false` → `moveRejected` announced, nothing written), else the
 * event is replaced in a new array (`onEventsChange` / the Signal), `onEventMove` / `onEventResize` fire and the
 * change is announced. Dates are written in the form of the values they replace. Returns whether it was applied.
 */
export function commitChange<T>(state: SchedulerState<T>, change: SchedulerCommit<T>): boolean {
  return untrack(() => {
    const list = controlledValue(state.events);
    const current = list.find((event) => event.id === change.normalized.event.id);
    if (!current) return false;
    const timeZone = schedulerTimeZone(state);
    const { next } = change;
    const range: SchedulerRange = {
      start: fromLayout(dayOf(next.start), minuteOf(next.start), current.start, timeZone, next.allDay),
      end: fromLayout(dayOf(next.end), minuteOf(next.end), current.end, timeZone, next.allDay),
      allDay: next.allDay,
    };
    const hook = change.kind === "move" ? state.canMove : state.canResize;
    if (hook && !hook(current, range)) {
      schedulerAnnounce(state, schedulerTranslate(state, "moveRejected", { title: current.title }));
      return false;
    }
    const updated: SchedulerEvent<T> = { ...current, start: range.start, end: range.end, allDay: range.allDay };
    setControlledValue(
      state.events,
      list.map((event) => (event.id === updated.id ? updated : event)),
    );
    const previous: SchedulerRange = { start: current.start, end: current.end, allDay: change.normalized.allDay };
    const payload: SchedulerEventChange<T> = { event: updated, previous, source: change.source };
    const locale = schedulerLocale(state);
    if (change.kind === "move") {
      state.onEventMove?.(payload);
      const start = next.allDay ? dateLabel(dayOf(next.start), locale) : dateTimeLabel(next.start, locale);
      schedulerAnnounce(state, schedulerTranslate(state, "eventMoved", { title: updated.title, start }));
    } else {
      state.onEventResize?.(payload);
      const end = next.allDay ? dateLabel(dayOf(next.end) - 1, locale) : dateTimeLabel(next.end, locale);
      schedulerAnnounce(state, schedulerTranslate(state, "eventResized", { title: updated.title, end }));
    }
    return true;
  });
}

/** Full date label (malva `getDateLabel`). */
export function dateLabel(day: number, locale: string): string {
  return formatDay(day, locale, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

/** Time of day (malva `formatTime`, e.g. "9:30 AM"). */
export function timeLabel(wall: number, locale: string): string {
  return formatWall(wall, locale, { hour: "numeric", minute: "2-digit" });
}

/** Date + time (malva `formatDateTime`), used whenever a label crosses a day boundary. */
export function dateTimeLabel(wall: number, locale: string): string {
  return formatWall(wall, locale, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
