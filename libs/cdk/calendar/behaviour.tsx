// Ported from react-aria (react-spectrum) src/calendar/useCalendarBase.ts, useCalendar.ts,
// useRangeCalendar.ts, useCalendarGrid.ts, useCalendarCell.ts, useCalendarHeading.ts,
// useCalendarMonthPicker.ts, useCalendarYearPicker.ts and calendar/utils.ts, Apache-2.0, © Adobe.
// Rivet:
// - Naming: `useCalendar` → `calendarProps(props, state)` ({ calendarProps, prevButtonProps,
//   nextButtonProps, errorMessageProps, title }), `useRangeCalendar` → `rangeCalendarProps`,
//   `useCalendarGrid` → `calendarGridProps` ({ gridProps, headerProps, weekDays, weeksInMonth }),
//   `useCalendarCell` → `calendarCellProps` ({ cellProps, buttonProps, …states }),
//   `useCalendarHeading` → `calendarHeadingProps`, `useCalendarMonthPicker` / `YearPicker` →
//   `calendarMonthPickerProps` / `calendarYearPickerProps`. State-dependent values are accessors
//   (read by bindings / spreads); closures capture date keys (strings), never date objects.
// - `.tsx` so the accessor closures resume (only .tsx modules are resume-compiled).
// - RA's handlers are free functions taking `(event, state)`: the grid delegates one keydown /
//   focusin / pointer handler per `<table role="grid">` that finds the cell from `data-date`, so
//   cells carry no handlers and month changes only re-render rows.
// Deviation: `pageButtonPress` focus management (focus the focused cell when a page button becomes
// disabled) runs in `calendarPreviousPress` / `calendarNextPress` instead of a layout effect.
import { untrack } from "@rivetjs/reactivity";
import {
  CalendarDate,
  endOfMonth,
  isSameDay,
  isSameMonth,
  isSameYear,
  isToday as isTodayOf,
  startOfMonth,
  startOfWeek,
  toCalendarDate,
  today,
  type DateDuration,
} from "@rivetjs/cdk/date";
import { announce } from "@rivetjs/cdk/a11y";
import { dataBool } from "../utils/data-attrs.tsx";
import { direction } from "@rivetjs/cdk/bidi";
import { isRTL } from "@rivetjs/cdk/i18n";
import { getDateFormatter } from "../i18n/date-formatter.ts";
import { cachedIntl } from "../i18n/intl-cache.ts";
import { listFormatter } from "../i18n/list-formatter.ts";
import {
  anchorDate,
  calendarValue,
  commitSelection,
  clearSelection,
  focusNearestAvailableDate,
  focusNextDay,
  focusNextPage,
  focusNextRow,
  focusNextSection,
  focusPreviousDay,
  focusPreviousPage,
  focusPreviousRow,
  focusPreviousSection,
  focusSectionEnd,
  focusSectionStart,
  focusedDate,
  getDatesInWeek as getDatesInWeekOf,
  getWeeksInMonth as getWeeksInMonthOf,
  highlightDate,
  highlightedRange,
  isCalendarDisabled,
  isCalendarReadOnly,
  isCellDisabled,
  isCellUnavailable,
  isNextVisibleRangeInvalid,
  isPreviousVisibleRangeInvalid,
  isSelected as stateIsSelected,
  isValueInvalid,
  maxValueOf,
  message,
  minValueOf,
  rangeValue,
  readDate,
  selectDate,
  selectFocusedDate,
  setAnchorDate,
  setDragging,
  setFocused,
  setFocusedDate,
  visibleRange,
  type AnyCalendarState,
  type RangeCalendarState,
} from "../state/calendar.ts";
import { cssEscape } from "../utils/dom-core.ts";

/** Keys the grid handles (`data-rk`: held while the handler chunk loads). */
export const GRID_KEYS = "ArrowUp ArrowDown ArrowLeft ArrowRight Home End PageUp PageDown Enter Space";

export const gridId = (state: AnyCalendarState, offset = 0): string => state.id + "-grid" + (offset ? "-" + offset : "");
export const errorMessageId = (state: AnyCalendarState): string => state.id + "-error";
export const promptId = (state: AnyCalendarState, which: "start" | "finish"): string => state.id + "-" + which + "-prompt";

const DATE_ATTR = "data-date";
/** `data-date` of a cell: the date's ISO string (Gregorian). */
export const cellKey = (date: CalendarDate): string => toCalendarDate(date).toString();

// utils.ts ------------------------------------------------------------------------------------

export function getEraFormat(date: CalendarDate | undefined): "short" | undefined {
  return date?.calendar.identifier === "gregory" && date.era === "BC" ? "short" : undefined;
}

function formatRange(state: AnyCalendarState, formatter: ReturnType<typeof getDateFormatter>, start: CalendarDate, end: CalendarDate): string {
  const parts = formatter.formatRangeToParts(start.toDate(state.timeZone), end.toDate(state.timeZone));
  // The separator between the start and end date: the last shared literal before the end range.
  let separatorIndex = -1;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    if (part.source === "shared" && part.type === "literal") separatorIndex = i;
    else if (part.source === "endRange") break;
  }
  let startValue = "",
    endValue = "";
  for (let i = 0; i < parts.length; i++) {
    if (i < separatorIndex) startValue += parts[i]!.value;
    else if (i > separatorIndex) endValue += parts[i]!.value;
  }
  return message(state, "dateRange", { startDate: startValue, endDate: endValue });
}

/** Description of the selection ("Selected Date: …"), '' while selecting a range. Reads the selection. */
export function selectedDateDescription(state: AnyCalendarState): string {
  let start: CalendarDate | undefined, end: CalendarDate | undefined;
  if (state.mode === "range") ({ start, end } = highlightedRange(state) || ({} as { start?: CalendarDate; end?: CalendarDate }));
  else {
    const value = calendarValue(state);
    start = Array.isArray(value) ? value[0] : (value ?? undefined);
    end = Array.isArray(value) ? value.at(-1) : (value ?? undefined);
  }
  const formatter = getDateFormatter(state.locale, {
    weekday: "long",
    month: "long",
    year: "numeric",
    day: "numeric",
    era: getEraFormat(start) || getEraFormat(end),
    timeZone: state.timeZone,
  });
  const anchor = state.mode === "range" ? anchorDate(state) : null;
  // No message while selecting a range, or when nothing is highlighted.
  if (!anchor && start && end) {
    if (isSameDay(start, end)) return message(state, "selectedDateDescription", { date: formatter.format(start.toDate(state.timeZone)) });
    if (state.mode === "range") return message(state, "selectedRangeDescription", { dateRange: formatRange(state, formatter, start, end) });
    const value = calendarValue(state);
    if (Array.isArray(value)) {
      const dates = value.map((date) => formatter.format(date.toDate(state.timeZone)));
      return message(state, "selectedDateDescription", { date: listFormatter(state.locale).format(dates) });
    }
  }
  return "";
}

/** Visible range description (`title`: Intl range format; `isAria`: "{start} to {end}" message). */
export function visibleRangeDescription(state: AnyCalendarState, startDate: CalendarDate, endDate: CalendarDate, isAria: boolean): string {
  const era = getEraFormat(startDate) || getEraFormat(endDate);
  const monthFormatter = getDateFormatter(state.locale, {
    month: "long",
    year: "numeric",
    era,
    calendar: startDate.calendar.identifier,
    timeZone: state.timeZone,
  });
  const dateFormatter = getDateFormatter(state.locale, {
    month: "long",
    year: "numeric",
    day: "numeric",
    era,
    calendar: startDate.calendar.identifier,
    timeZone: state.timeZone,
  });
  // Month granularity: one month, or a range of months.
  if (isSameDay(startDate, startOfMonth(startDate))) {
    let startMonth = startDate,
      endMonth = endDate;
    if (startDate.calendar.getFormattableMonth) startMonth = startDate.calendar.getFormattableMonth(startDate);
    if (endDate.calendar.getFormattableMonth) endMonth = endDate.calendar.getFormattableMonth(endDate);
    if (isSameDay(endDate, endOfMonth(startDate))) return monthFormatter.format(startMonth.toDate(state.timeZone));
    if (isSameDay(endDate, endOfMonth(endDate)))
      return isAria
        ? formatRange(state, monthFormatter, startMonth, endMonth)
        : monthFormatter.formatRange(startMonth.toDate(state.timeZone), endMonth.toDate(state.timeZone));
  }
  return isAria
    ? formatRange(state, dateFormatter, startDate, endDate)
    : dateFormatter.formatRange(startDate.toDate(state.timeZone), endDate.toDate(state.timeZone));
}

// useCalendarBase -----------------------------------------------------------------------------

/** Calendar title (heading text). Reads the visible range. */
export function calendarTitle(state: AnyCalendarState): string {
  const range = visibleRange(state);
  return visibleRangeDescription(state, range.start, range.end, false);
}

/** `aria-label` of the calendar: the label plus the visible range. */
export function calendarAriaLabel(state: AnyCalendarState, label?: string): string {
  const range = visibleRange(state);
  return [label, visibleRangeDescription(state, range.start, range.end, true)].filter(Boolean).join(", ");
}

/** The previous button is disabled. */
export const previousDisabled = (state: AnyCalendarState): boolean => isCalendarDisabled(state) || isPreviousVisibleRangeInvalid(state);
/** The next button is disabled. */
export const nextDisabled = (state: AnyCalendarState): boolean => isCalendarDisabled(state) || isNextVisibleRangeInvalid(state);

const rangeText = (state: AnyCalendarState): string =>
  untrack(() => {
    const range = visibleRange(state);
    return visibleRangeDescription(state, range.start, range.end, true);
  });

/** The previous button's `onPress` (useCalendarBase `prevButtonProps.onPress`): previous page. `event.target`: the button. */
export const calendarPreviousPress = (event: { target: EventTarget | null } | null | undefined, state: AnyCalendarState): void =>
  pagePress(state, -1, event?.target as Element | null | undefined);
/** The next button's `onPress` (useCalendarBase `nextButtonProps.onPress`): next page. */
export const calendarNextPress = (event: { target: EventTarget | null } | null | undefined, state: AnyCalendarState): void =>
  pagePress(state, 1, event?.target as Element | null | undefined);

/** Previous / next button press: page, announce the new range (focus not in the grid), and move focus into the grid when the button got disabled. */
function pagePress(state: AnyCalendarState, dir: 1 | -1, button?: Element | null): void {
  if (untrack(() => (dir > 0 ? nextDisabled(state) : previousDisabled(state)))) return;
  const before = rangeText(state);
  if (dir > 0) focusNextPage(state);
  else focusPreviousPage(state);
  const after = rangeText(state);
  // Announce when the visible date range changes (only when pressing the buttons).
  if (after !== before && !untrack(state.isFocused)) announce(after);
  // If the button became disabled while focused, move focus to the calendar body.
  if (button && button.ownerDocument.activeElement === button && untrack(() => (dir > 0 ? nextDisabled(state) : previousDisabled(state)))) {
    setFocused(state, true);
    focusCell(state, button.closest("[data-rv-calendar]"));
  }
}

// useCalendarGrid -----------------------------------------------------------------------------

/**
 * First date of grid `offset` (RAC CalendarGrid: `state.visibleRange.start.add(offset)`). Reads the
 * visible range (`start` + `focused`: an outside `focusedValue` write moves it); components read it
 * through a computed of `visibleStartKey` so grid bodies re-render only when the range moves.
 */
export function gridStartDate(state: AnyCalendarState, offset?: DateDuration, startKey?: string): CalendarDate {
  let start = startKey ? readDate(state, startKey) : visibleRange(state).start;
  if (offset) start = start.add(offset);
  return start;
}

/** `aria-label` of a grid: calendar label + the grid's month. */
export function gridAriaLabel(state: AnyCalendarState, startDate: CalendarDate, label?: string): string {
  return [label, visibleRangeDescription(state, startDate, endOfMonth(startDate), true)].filter(Boolean).join(", ");
}

/** Weekday names of the grid header (locale + firstDayOfWeek). */
export function weekDays(state: AnyCalendarState, weekdayStyle: "narrow" | "short" | "long" = "narrow", startDate?: CalendarDate): string[] {
  const formatter = getDateFormatter(state.locale, { weekday: weekdayStyle, timeZone: state.timeZone });
  const d = state.visibleDuration;
  const isDayView = !!d.days && d.days < 7;
  const weekStart = isDayView
    ? (startDate ?? untrack(() => visibleRange(state).start))
    : startOfWeek(today(state.timeZone), state.locale, state.firstDayOfWeek);
  const days = isDayView ? d.days! : 7;
  return [...new Array(days).keys()].map((index) => formatter.format(weekStart.add({ days: index }).toDate(state.timeZone)));
}

const cellOf = (event: Event): HTMLElement | null => (event.target as Element | null)?.closest?.<HTMLElement>("[" + DATE_ATTR + "]") ?? null;
const dateOfCell = (state: AnyCalendarState, cell: Element): CalendarDate => readDate(state, cell.getAttribute(DATE_ATTR)!);

/**
 * Move DOM focus to the focused cell after the state update rendered (React Aria's cell effect).
 * A page change re-creates the grid body (possibly after its chunk loads), so focus is retried on
 * the next frames until the connected cell holds it twice in a row.
 */
export function focusCell(state: AnyCalendarState, from: Element | null | undefined, scroll = true): void {
  if (!from) return;
  const doc = from.ownerDocument;
  let root: Element | null = from,
    frames = 0,
    stable = 0;
  const attempt = () => {
    // A resumed page may re-create the whole calendar region on its first change: find the root again.
    if (!root?.isConnected) root = doc.querySelector(`[data-rv-calendar="${cssEscape(state.id)}"]`);
    if (!untrack(state.isFocused) || !root) return;
    const key = cellKey(untrack(() => focusedDate(state)));
    const cell = root.querySelector<HTMLElement>(`[${DATE_ATTR}="${key}"]:not([data-outside-month])`);
    if (cell && cell === cell.ownerDocument.activeElement) stable++;
    else if (cell) {
      stable = 0;
      cell.focus({ preventScroll: true });
      if (scroll && cell.ownerDocument.activeElement === cell) cell.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    }
    if (stable < 2 && ++frames < 30) requestAnimationFrame(attempt);
  };
  queueMicrotask(attempt);
}

const rootOf = (el: Element): Element | null => el.closest("[data-rv-calendar]");

/** keydown on a grid (useCalendarGrid shortcuts + the cell's keyboard press). */
export function calendarGridKeyDown(event: KeyboardEvent & { currentTarget: Element }, state: AnyCalendarState): void {
  if (event.isComposing) return;
  modality = "keyboard";
  const shift = event.shiftKey,
    other = event.altKey || event.ctrlKey || event.metaKey;
  const key = event.key;
  // React Aria: the locale's direction; an explicit `dir` ancestor wins (Rivet: DOM direction).
  const explicit = event.currentTarget.closest?.("[dir]") != null;
  const rtl = explicit ? direction(event.currentTarget) === "rtl" : isRTL(state.locale);
  let handled = true;
  if (other) return;
  if (shift && key !== "PageUp" && key !== "PageDown") return;
  switch (key) {
    case "End":
      focusSectionEnd(state);
      break;
    case "Home":
      focusSectionStart(state);
      break;
    case "Escape":
      // Cancel the range selection; the event keeps propagating (an enclosing popover closes).
      if (state.mode === "range") setAnchorDate(state, null);
      return;
    case "Enter":
    case " ":
      if (event.repeat) break;
      cellKeyPress(state);
      break;
    case "PageUp":
      focusPreviousSection(state, shift);
      break;
    case "PageDown":
      focusNextSection(state, shift);
      break;
    case "ArrowLeft":
      if (rtl) focusNextDay(state);
      else focusPreviousDay(state);
      break;
    case "ArrowUp":
      focusPreviousRow(state);
      break;
    case "ArrowRight":
      if (rtl) focusPreviousDay(state);
      else focusNextDay(state);
      break;
    case "ArrowDown":
      focusNextRow(state);
      break;
    default:
      handled = false;
  }
  if (!handled) return;
  event.preventDefault();
  event.stopPropagation();
  setFocused(state, true);
  focusCell(state, rootOf(event.currentTarget));
}

/** Enter / Space on the focused cell (usePress keyboard: onPress / onPressUp). */
function cellKeyPress(state: AnyCalendarState): void {
  const date = untrack(() => focusedDate(state));
  const selectable = untrack(() => !isCellDisabled(state, date) && !isCellUnavailable(state, date));
  if (!selectable || isCalendarReadOnly(state)) {
    // Press disabled: the grid shortcut selects the focused date (a no-op for unavailable / read-only).
    selectFocusedDate(state);
    return;
  }
  if (state.mode !== "range") {
    selectDate(state, date);
    setFocusedDate(state, date);
    announceSelection(state);
    return;
  }
  if (untrack(state.anchor)) {
    selectDate(state, date);
    setFocusedDate(state, date);
  } else {
    // Keyboard range selection auto-advances focus by one day.
    selectDate(state, date);
    focusNearestAvailableDate(state, date);
  }
  announceSelection(state);
}

/** focusin on a grid: the focused cell becomes the focused date; focus is within. */
export function calendarGridFocusIn(event: FocusEvent, state: AnyCalendarState): void {
  setFocused(state, true);
  const cell = cellOf(event);
  if (!cell) return;
  // RAC `data-focus-visible` (useFocusRing: keyboard modality).
  if (modality === "keyboard" && cell.matches(":focus-visible")) state.focusVisibleCell.set(cell.getAttribute(DATE_ATTR));
  if (cell.hasAttribute("data-disabled")) return;
  const date = dateOfCell(state, cell);
  if (!untrack(() => isSameDay(focusedDate(state), date))) setFocusedDate(state, date);
}

/**
 * A blur to nowhere of a cell that is no longer the focused date: the calendar moved focus itself and
 * the old cell lost focusability first (paged out of the visible range → disabled, no `tabindex`, while
 * the body re-renders, possibly after its chunk loads) — focus moves on (`focusCell`), it did not leave.
 */
const movedAway = (state: AnyCalendarState, target: Element): boolean => {
  const date = target.getAttribute?.(DATE_ATTR);
  return date != null && date !== untrack(() => cellKey(focusedDate(state)));
};

/** focusout on a grid. */
export function calendarGridFocusOut(event: FocusEvent & { currentTarget: Element }, state: AnyCalendarState): void {
  const grid = event.currentTarget,
    target = event.target as Element;
  if (target.getAttribute?.(DATE_ATTR) === untrack(state.focusVisibleCell)) state.focusVisibleCell.set(null);
  const next = event.relatedTarget as Node | null;
  if (next && grid.contains(next)) return;
  if (next) modality = "keyboard";
  const moved = next === null && movedAway(state, target);
  // A page change re-creates the body: the focused cell blurs as it is removed; focus moves on.
  queueMicrotask(() => {
    if ((!target.isConnected || moved) && grid.isConnected) return;
    const root = rootOf(grid) ?? grid;
    if (!root.querySelector("[role=grid]:focus-within")) setFocused(state, false);
  });
}

let lastAnnounced = new WeakMap<object, string>();
function announceSelection(state: AnyCalendarState): void {
  const text = untrack(() => selectedDateDescription(state));
  if (text && lastAnnounced.get(state) !== text) {
    lastAnnounced.set(state, text);
    announce(text, "polite");
  }
}

// Pointer interaction (usePress on cells, range dragging) -------------------------------------

interface Press {
  state: AnyCalendarState;
  date: CalendarDate;
  pointerType: string;
  anchorPressed: boolean;
  boundaryPressed: boolean;
  timer?: ReturnType<typeof setTimeout>;
  root: Element;
  cleanup: () => void;
}
let press: Press | null = null;
// Interaction modality for `data-focus-visible` (React Aria useFocusVisible: pointer vs keyboard).
let modality: "pointer" | "keyboard" = "keyboard";
// Virtual clicks (screen readers) report zero-size pointers.
let virtualClick = false;

const selectable = (state: AnyCalendarState, date: CalendarDate): boolean => untrack(() => !isCellDisabled(state, date) && !isCellUnavailable(state, date));

/** mousedown on a grid: cells do not take focus from the pointer (usePress `preventFocusOnPress`). */
export function calendarGridMouseDown(event: MouseEvent): void {
  if (cellOf(event)) event.preventDefault();
}

/** pointerdown on a grid (usePress onPressStart). */
export function calendarGridPointerDown(event: PointerEvent & { currentTarget: Element }, state: AnyCalendarState): void {
  virtualClick = event.width === 0 && event.height === 0;
  modality = "pointer";
  const cell = cellOf(event);
  if (!cell || event.button !== 0) return;
  // Touch: release the implicit capture so dragging can leave the pressed cell.
  if (cell.hasPointerCapture?.(event.pointerId)) cell.releasePointerCapture(event.pointerId);
  const date = dateOfCell(state, cell);
  if (!selectable(state, date)) return;
  // RAC `data-pressed` (usePress), until the press ends.
  const readOnly = isCalendarReadOnly(state);
  if (!readOnly) state.pressedCell.set(cell.getAttribute(DATE_ATTR));
  if (readOnly) {
    setFocusedDate(state, date);
    setFocused(state, true);
    focusCell(state, rootOf(event.currentTarget), false);
    return;
  }
  const root = rootOf(event.currentTarget) ?? event.currentTarget;
  const p: Press = { state, date, pointerType: event.pointerType, anchorPressed: false, boundaryPressed: false, root, cleanup: () => {} };
  press = p;
  if (state.mode === "range" && !untrack(state.anchor) && (event.pointerType === "mouse" || event.pointerType === "touch")) {
    const range = untrack(() => highlightedRange(state));
    const invalid = untrack(() => isCellInvalid(state, date));
    // Dragging the start or end of an existing range modifies it.
    if (range && !invalid && (isSameDay(date, range.start) || isSameDay(date, range.end))) {
      setAnchorDate(state, isSameDay(date, range.start) ? range.end : range.start);
      setFocusedDate(state, date);
      setFocused(state, true);
      setDragging(state, true);
      p.boundaryPressed = true;
    } else {
      const startDragging = () => {
        setDragging(state, true);
        p.timer = undefined;
        selectDate(state, date);
        setFocusedDate(state, date);
        setFocused(state, true);
        p.anchorPressed = true;
        focusCell(state, root, false);
      };
      // On touch, delay dragging to tell scrolling from selecting.
      if (event.pointerType === "touch") p.timer = setTimeout(startDragging, 200);
      else startDragging();
    }
  }
  const doc = event.currentTarget.ownerDocument;
  const up = (e: PointerEvent) => windowPointerUp(e);
  const move = (e: Event) => {
    if (state.mode === "range" && untrack(state.dragging)) e.preventDefault();
  };
  doc.addEventListener("pointerup", up, true);
  doc.addEventListener("pointercancel", up, true);
  root.addEventListener("touchmove", move, { passive: false, capture: true });
  p.cleanup = () => {
    doc.removeEventListener("pointerup", up, true);
    doc.removeEventListener("pointercancel", up, true);
    root.removeEventListener("touchmove", move, true);
  };
}

function isCellInvalid(state: AnyCalendarState, date: CalendarDate): boolean {
  if (!isValueInvalid(state)) return false;
  if (state.mode === "range") {
    const range = highlightedRange(state);
    return !anchorDate(state) && range != null && date.compare(range.start) >= 0 && date.compare(range.end) <= 0;
  }
  const value = calendarValue(state);
  if (Array.isArray(value)) return value.some((v) => isSameDay(v, date));
  return value ? isSameDay(value, date) : false;
}

/** pointerup on a grid (delegated: also runs in order after a cold pointerdown replay). */
export function calendarGridPointerUp(event: PointerEvent): void {
  windowPointerUp(event);
}

/** Window pointerup during a press: onPressUp / onPress / onPressEnd + useRangeCalendar's endDragging. */
function windowPointerUp(event: PointerEvent): void {
  const p = press;
  if (!p) return;
  press = null;
  p.cleanup();
  const { state } = p;
  state.pressedCell.set(null);
  const cell = cellOf(event);
  const overDate = cell && p.root.contains(cell) ? dateOfCell(state, cell) : null;
  const releasedOnPressed = overDate != null && isSameDay(overDate, p.date);
  if (event.type !== "pointercancel" && !isCalendarReadOnly(state)) {
    if (state.mode !== "range") {
      // Single / multiple: select on press up over the pressed cell.
      if (releasedOnPressed) {
        selectDate(state, p.date);
        setFocusedDate(state, p.date);
        setFocused(state, true);
        focusCell(state, p.root, false);
        announceSelection(state);
      }
    } else if (overDate && selectable(state, overDate)) {
      if (p.timer) {
        // Quick tap: start the range now (the drag timer never fired). Do not also complete it below.
        clearTimeout(p.timer);
        p.timer = undefined;
        if (releasedOnPressed) {
          selectDate(state, overDate);
          setFocusedDate(state, overDate);
          setFocused(state, true);
        }
      } else if (p.boundaryPressed && releasedOnPressed) {
        // Pressing the start / end of a range starts a new selection on press up.
        setAnchorDate(state, overDate);
      } else if (untrack(state.anchor) && !(p.anchorPressed && releasedOnPressed)) {
        // Releasing a drag (or pressing the end date) selects it.
        selectDate(state, overDate);
        setFocusedDate(state, overDate);
        setFocused(state, true);
      } else if (event.pointerType === "pen" || virtualClick) {
        selectDate(state, overDate);
        setFocusedDate(state, overDate);
        setFocused(state, true);
      }
      focusCell(state, p.root, false);
      announceSelection(state);
    }
  }
  if (p.timer) clearTimeout(p.timer);
  if (state.mode === "range") endDragging(state, event, p.root, overDate != null);
}

/** useRangeCalendar endDragging: pointer released outside the calendar body mid-selection. */
function endDragging(state: RangeCalendarState, event: PointerEvent, root: Element, overCell: boolean): void {
  if (virtualClick) {
    virtualClick = false;
    return;
  }
  setDragging(state, false);
  if (!untrack(state.anchor)) return;
  const target = event.target as Element;
  if (!overCell && root.contains(root.ownerDocument.activeElement) && (!root.contains(target) || !target.closest?.('button, [role="button"]')))
    commitBehavior(state, root.getAttribute("data-commit-behavior"));
}

function commitBehavior(state: RangeCalendarState, behavior: string | null): void {
  if (behavior === "clear") clearSelection(state);
  else if (behavior === "reset") setAnchorDate(state, null);
  else commitSelection(state);
}

/** pointerover on a grid: highlight the hovered date while selecting a range. */
export function calendarGridPointerOver(event: PointerEvent, state: AnyCalendarState): void {
  const cell = cellOf(event);
  if (!cell) return;
  // RAC `data-hovered` (useHover: no touch emulation, not on disabled / unavailable cells).
  if (event.pointerType !== "touch" && !cell.hasAttribute("data-disabled") && !cell.hasAttribute("data-unavailable"))
    state.hoveredCell.set(cell.getAttribute(DATE_ATTR));
  if (state.mode !== "range") return;
  if (event.pointerType === "touch" && !untrack(state.dragging)) return;
  const date = dateOfCell(state, cell);
  if (!selectable(state, date)) return;
  highlightDate(state, date);
  if (untrack(state.anchor)) focusCell(state, rootOf(cell), false);
}

/** pointerout on a grid: the cell is no longer hovered. */
export function calendarGridPointerOut(event: PointerEvent, state: AnyCalendarState): void {
  const cell = cellOf(event);
  if (cell && !cell.contains(event.relatedTarget as Node | null) && cell.getAttribute(DATE_ATTR) === untrack(state.hoveredCell)) state.hoveredCell.set(null);
}

/** click on a grid (virtual clicks from assistive tech: no pointerdown before it). */
export function calendarGridClick(event: MouseEvent, state: AnyCalendarState): void {
  const cell = cellOf(event);
  if (!cell || press) return;
  // A click with no preceding pointer press: screen-reader activation (usePress "virtual").
  if (event.detail !== 0 && !virtualClick) return;
  virtualClick = false;
  const date = dateOfCell(state, cell);
  if (!selectable(state, date) || isCalendarReadOnly(state)) return;
  selectDate(state, date);
  setFocusedDate(state, date);
  setFocused(state, true);
  focusCell(state, rootOf(cell), false);
  announceSelection(state);
}

/** contextmenu on a grid: no context menu on long press over cells. */
export function calendarGridContextMenu(event: MouseEvent): void {
  if (cellOf(event)) event.preventDefault();
}

/** focusout on a range calendar: commit (commitBehavior) when focus leaves mid-selection. */
export function rangeCalendarFocusOut(event: FocusEvent & { currentTarget: Element }, state: AnyCalendarState): void {
  if (state.mode !== "range") return;
  const root = event.currentTarget,
    target = event.target as Element;
  const next = event.relatedTarget as Node | null;
  if (next && root.contains(next)) return;
  const moved = next === null && movedAway(state, target);
  queueMicrotask(() => {
    // Blur of a cell removed (or disabled) by a page change: focus stays in the calendar.
    if ((!target.isConnected || moved) && root.isConnected) return;
    if (!root.contains(root.ownerDocument.activeElement) && untrack(state.anchor)) commitBehavior(state, root.getAttribute("data-commit-behavior"));
  });
}

// useCalendarCell -----------------------------------------------------------------------------

export interface CalendarCellState {
  date: CalendarDate;
  formattedDate: string;
  isSelected: boolean;
  isSelectionStart: boolean;
  isSelectionEnd: boolean;
  isFocused: boolean;
  isDisabled: boolean;
  isUnavailable: boolean;
  isOutsideVisibleRange: boolean;
  isOutsideMonth: boolean;
  isInvalid: boolean;
  isToday: boolean;
  tabIndex: number | undefined;
  label: string;
  describedBy: string | undefined;
}

/** RAC CalendarCell `isOutsideMonth`: the date is not in the month starting at `monthStart` (never for day / week views). */
export function isOutsideMonthOf(state: AnyCalendarState, date: CalendarDate, monthStart: CalendarDate): boolean {
  const d = state.visibleDuration;
  return d.days || d.weeks ? false : !isSameMonth(monthStart, date);
}

/** The cell's aria-label: weekday, month, day and year (no time) + selection / today / min / max. Reads. */
export function cellLabel(state: AnyCalendarState, date: CalendarDate, isSelected: boolean): string {
  const formatter = getDateFormatter(state.locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    era: getEraFormat(date),
    timeZone: state.timeZone,
  });
  let label = "";
  if (state.mode === "range" && !anchorDate(state)) {
    const value = rangeValue(state);
    if (value && (isSameDay(date, value.start) || isSameDay(date, value.end))) label = selectedDateDescription(state) + ", ";
  }
  label += formatter.format(date.toDate(state.timeZone));
  if (isTodayOf(date, state.timeZone)) label = message(state, isSelected ? "todayDateSelected" : "todayDate", { date: label });
  else if (isSelected) label = message(state, "dateSelected", { date: label });
  const min = minValueOf(state),
    max = maxValueOf(state);
  if (min && isSameDay(date, min)) label += ", " + message(state, "minimumDate");
  else if (max && isSameDay(date, max)) label += ", " + message(state, "maximumDate");
  return label;
}

/** The cell's aria-describedby: the error message when invalid + the range prompt on the focused cell. Reads. */
export function cellDescribedBy(state: AnyCalendarState, isInvalid: boolean, isFocusedSelectable: boolean): string | undefined {
  let prompt: string | undefined;
  if (state.mode === "range" && isFocusedSelectable && !isCalendarReadOnly(state)) prompt = promptId(state, anchorDate(state) ? "finish" : "start");
  return [isInvalid ? errorMessageId(state) : undefined, prompt].filter(Boolean).join(" ") || undefined;
}

/** The cell's day number in the calendar system. */
export function cellFormattedDate(state: AnyCalendarState, date: CalendarDate): string {
  const dayFormatter = getDateFormatter(state.locale, { day: "numeric", timeZone: state.timeZone, calendar: date.calendar.identifier });
  return dayFormatter.formatToParts(date.toDate(state.timeZone)).find((part) => part.type === "day")!.value;
}

/** Everything a cell renders (useCalendarCell states) as a snapshot. Reads focus, selection and the visible range. */
export function cellState(state: AnyCalendarState, date: CalendarDate, isOutsideMonth = false, isDisabledProp = false): CalendarCellState {
  const cell = calendarCellProps({ date, isOutsideMonth, isDisabled: isDisabledProp }, state);
  const isDisabled = cell.isDisabled();
  const isFocused = cell.isFocused();
  const isInvalid = cell.isInvalid();
  const isSelected = cell.isSelected();
  const selectable = !isDisabled && !cell.isUnavailable();
  return {
    date,
    formattedDate: cell.formattedDate(),
    isSelected,
    isSelectionStart: cell.isSelectionStart(),
    isSelectionEnd: cell.isSelectionEnd(),
    isFocused,
    isDisabled,
    isUnavailable: cell.isUnavailable(),
    isOutsideVisibleRange: cell.isOutsideVisibleRange(),
    isOutsideMonth,
    isInvalid,
    isToday: cell.isToday(),
    tabIndex: isDisabled ? undefined : isSameDay(date, focusedDate(state)) ? 0 : -1,
    label: cellLabel(state, date, isSelected),
    describedBy: cellDescribedBy(state, isInvalid, isFocused && selectable),
  };
}

/** Grid weeks: the dates (null placeholders) of each row of the grid starting at `startDate`. */
export { getDatesInWeek, getWeeksInMonth } from "../state/calendar.ts";

// useCalendarHeading / month & year pickers ----------------------------------------------------

export interface CalendarHeadingFormatOptions {
  day?: "numeric" | "2-digit";
  month?: "numeric" | "2-digit" | "long" | "short" | "narrow";
  year?: "numeric" | "2-digit";
  era?: "long" | "short" | "narrow";
}

/** useCalendarHeading props. */
export interface CalendarHeadingProps {
  /** Offset from the visible range start (multi-month calendars). */
  offset?: DateDuration;
  /** Format of the heading. */
  format?: CalendarHeadingFormatOptions;
}

/** useCalendarHeading: the heading text of the month at `offset`. Reads the visible range. */
export function calendarHeadingProps(options: CalendarHeadingProps, state: AnyCalendarState): string {
  const range = visibleRange(state);
  let startDate = range.start;
  if (options.offset) startDate = startDate.add(options.offset);
  const isDays = state.visibleDuration.days || state.visibleDuration.weeks;
  const format = options.format;
  const formatter = getDateFormatter(state.locale, {
    day: format?.day || (isDays ? "numeric" : undefined),
    month: format?.month || "long",
    year: format?.year || "numeric",
    era: format?.era || (startDate.calendar.identifier === "gregory" && startDate.era === "BC" ? "short" : undefined),
    calendar: range.start.calendar.identifier,
    timeZone: state.timeZone,
  });
  if (isDays) return formatter.formatRange(startDate.toDate(state.timeZone), range.end.toDate(state.timeZone));
  const displayDate = startDate.calendar.getFormattableMonth ? startDate.calendar.getFormattableMonth(startDate) : startDate;
  return formatter.format(displayDate.toDate(state.timeZone));
}

export interface CalendarPickerItem {
  id: number;
  date: CalendarDate;
  formatted: string;
}

/** useCalendarMonthPicker / useCalendarYearPicker result (`value` / `items` are accessors: read them in bindings). */
export interface CalendarPickerAria {
  "aria-label": string;
  value: () => number;
  onChange: (key: number | string | null) => void;
  items: () => CalendarPickerItem[];
}

export interface CalendarMonthPickerProps {
  /** The format of the month. @default "short" */
  format?: "numeric" | "2-digit" | "long" | "short" | "narrow";
}

function monthItems(props: CalendarMonthPickerProps, state: AnyCalendarState): CalendarPickerItem[] {
  const focused = focusedDate(state);
  const formatter = getDateFormatter(state.locale, { month: props.format || "short", calendar: focused.calendar.identifier, timeZone: state.timeZone });
  // Format the name of each month in the year according to the current locale and calendar system. Note that in
  // some calendar systems, such as the Hebrew, the number of months may differ between years.
  const months: CalendarPickerItem[] = [];
  const numMonths = focused.calendar.getMonthsInYear(focused);
  for (let i = 1; i <= numMonths; i++) {
    const date = focused.set({ month: i });
    // Calendars like the 4-5-4 fiscal calendar use getFormattableMonth to map their internal month back to the
    // Gregorian month that should be displayed.
    const displayDate = date.calendar.getFormattableMonth ? date.calendar.getFormattableMonth(date) : date;
    months.push({ id: i, date, formatted: formatter.format(displayDate.toDate(state.timeZone)) });
  }
  return months;
}

/** useCalendarMonthPicker: the months of the focused year (a Select's props). */
export function calendarMonthPickerProps(props: CalendarMonthPickerProps, state: AnyCalendarState): CalendarPickerAria {
  // A plain copy: the closures must not capture the caller's (component) props object.
  const options: CalendarMonthPickerProps = { format: props.format };
  return {
    "aria-label": cachedIntl(Intl.DisplayNames, state.locale, { type: "dateTimeField" }).of("month")!,
    value: () => focusedDate(state).month,
    onChange: (key) => {
      if (key != null) setFocusedDate(state, untrack(() => monthItems(options, state))[Number(key) - 1]!.date);
    },
    items: () => monthItems(options, state),
  };
}

export interface CalendarYearPickerProps {
  /** The format of the year. */
  format?: { year?: "numeric" | "2-digit"; era?: "long" | "short" | "narrow" };
  /** The number of years to display. @default 20 */
  visibleYears?: number;
}

type YearItems = { items: CalendarPickerItem[]; value: number };
/** Rivet: `yearItems` of the same inputs (focused date, locale, time zone, min / max) once per picker, not once per read — its
 * `items` / `value` / `onChange` accessors each rebuilt (formatted) the whole year list: 4 builds of 20 `Intl` formats per
 * server render of a year picker (ZERO W6). The inputs are read on every call (tracking unchanged). */
function yearItemsMemo(options: CalendarYearPickerProps, state: AnyCalendarState): () => YearItems {
  let key: string | undefined, last: YearItems | undefined;
  return () => {
    const focused = focusedDate(state);
    const k =
      focused.calendar.identifier +
      " " +
      String(focused) +
      " " +
      state.locale +
      " " +
      state.timeZone +
      " " +
      String(minValueOf(state)) +
      " " +
      String(maxValueOf(state));
    if (k !== key || last === undefined) ((last = yearItems(options, state, focused)), (key = k));
    return last;
  };
}

function yearItems(options: CalendarYearPickerProps, state: AnyCalendarState, focused = focusedDate(state)): YearItems {
  const formatter = getDateFormatter(state.locale, {
    year: options.format?.year || "numeric",
    era: options.format?.era || (focused.calendar.identifier === "gregory" && focused.era === "BC" ? "short" : undefined),
    calendar: focused.calendar.identifier,
    timeZone: state.timeZone,
  });
  const visibleYears = options.visibleYears || 20;
  let minDate = focused.subtract({ years: Math.floor(visibleYears / 2) });
  let maxDate = focused.add({ years: Math.ceil(visibleYears / 2) - 1 });
  const min = minValueOf(state),
    max = maxValueOf(state);
  if (max && maxDate.compare(max) > 0) {
    maxDate = toCalendarDate(max);
    minDate = maxDate.subtract({ years: visibleYears - 1 });
  }
  if (min && minDate.compare(min) < 0) {
    minDate = toCalendarDate(min);
    maxDate = minDate.add({ years: visibleYears - 1 });
    if (max && maxDate.compare(max) > 0) maxDate = toCalendarDate(max);
  }
  const items: CalendarPickerItem[] = [];
  let date = minDate,
    value = 0;
  while (date.compare(maxDate) <= 0 || isSameYear(date, maxDate)) {
    const itemDate = date.compare(maxDate) > 0 ? maxDate : date;
    if (isSameYear(itemDate, focused)) value = items.length;
    // The index is the id: in some calendars (Japanese) the era changes too.
    items.push({ id: items.length, date: itemDate, formatted: formatter.format(itemDate.toDate(state.timeZone)) });
    date = date.add({ years: 1 });
  }
  return { items, value };
}

/** useCalendarYearPicker: the years around the focused date (a Select's props). */
export function calendarYearPickerProps(props: CalendarYearPickerProps, state: AnyCalendarState): CalendarPickerAria {
  // A plain copy: the closures must not capture the caller's (component) props object.
  const options: CalendarYearPickerProps = { format: props.format, visibleYears: props.visibleYears };
  const years = yearItemsMemo(options, state);
  return {
    "aria-label": cachedIntl(Intl.DisplayNames, state.locale, { type: "dateTimeField" }).of("year")!,
    value: () => years().value,
    onChange: (key) => {
      if (key != null) setFocusedDate(state, untrack(years).items[Number(key)]!.date);
    },
    items: () => years().items,
  };
}

export { isValueInvalid };

const flag = dataBool;
type Accessor<T> = () => T;

// Live props (P5): a Calendar flag given as an accessor (`isDisabled={d()}`) stays live on the state (`state.disabled`,
// `state.readOnly`). The creation value on the static path (unchanged), else a returned arrow (resumable; a conditional
// bare arrow is not). `which`: 0 disabled, 1 read-only.
/** A calendar flag as a `"true"` / absent attribute: the creation value, or an accessor while live. */
export function calendarFlagAttr(state: AnyCalendarState, which: 0 | 1): Accessor<"true" | undefined> | "true" | undefined {
  return (which === 0 ? state.disabled : state.readOnly) ? calendarFlagReader(state, which) : flag(which === 0 ? state.isDisabled : state.isReadOnly);
}
function calendarFlagReader(state: AnyCalendarState, which: 0 | 1): Accessor<"true" | undefined> {
  return () => flag(which === 0 ? isCalendarDisabled(state) : isCalendarReadOnly(state));
}

/** useCalendarCell props (`date`: a date or its `cellKey`; closures capture the key, never the date object). */
export interface AriaCalendarCellProps {
  date: CalendarDate | string;
  /** Whether the cell is disabled (on top of min / max / outside the visible range). */
  isDisabled?: boolean;
  /** Whether the cell is outside the current month (RAC CalendarCell computes it from its grid). */
  isOutsideMonth?: boolean;
}

/** useCalendarCell result: RA's bags (accessor values, read by the spread binding) + states as accessors. */
export interface CalendarCellAria {
  /** `<td role="gridcell">` attributes. */
  cellProps: Record<string, unknown>;
  /** The cell button's attributes (role, roving tabindex, label, RAC `data-*` states). */
  buttonProps: Record<string, unknown>;
  formattedDate: Accessor<string>;
  /** Rivet: RAC CalendarCell's useHover / usePress / useFocusRing states (from the grid's delegated handlers). */
  isHovered: Accessor<boolean>;
  isPressed: Accessor<boolean>;
  isFocusVisible: Accessor<boolean>;
  isSelected: Accessor<boolean>;
  isSelectionStart: Accessor<boolean>;
  isSelectionEnd: Accessor<boolean>;
  isFocused: Accessor<boolean>;
  isDisabled: Accessor<boolean>;
  isUnavailable: Accessor<boolean>;
  isOutsideVisibleRange: Accessor<boolean>;
  isInvalid: Accessor<boolean>;
  isToday: Accessor<boolean>;
}

/**
 * useCalendarCell: attribute bags and states of the cell for `date`. Values are accessors, each reading
 * only what it depends on (a focus move re-runs only the focus bindings of each cell). Rivet: the cell's
 * press / focus / hover handlers are delegated on its grid (`calendarGrid*` handlers), which also write
 * `data-pressed` / `data-hovered` / `data-focus-visible`.
 */
export function calendarCellProps(props: AriaCalendarCellProps, state: AnyCalendarState): CalendarCellAria {
  const key = typeof props.date === "string" ? props.date : cellKey(props.date);
  const isOutsideMonth = !!props.isOutsideMonth,
    isDisabledProp = !!props.isDisabled;
  const date = () => readDate(state, key);
  const isDisabled = () => isDisabledProp || isOutsideMonth || isCellDisabled(state, date());
  const isUnavailable = () => isCellUnavailable(state, date());
  const notSelectable = () => isDisabled() || isUnavailable();
  const isInvalid = () => isCellInvalid(state, date());
  const isSelected = () => (isInvalid() && !isDisabled()) || (stateIsSelected(state, date()) && !notSelectable());
  const isFocused = () => !isOutsideMonth && state.isFocused() && isSameDay(date(), focusedDate(state));
  const isToday = () => isTodayOf(date(), state.timeZone);
  const isSelectionStart = () => {
    const range = highlightedRange(state);
    return !!range && isSameDay(date(), range.start);
  };
  const isSelectionEnd = () => {
    const range = highlightedRange(state);
    return !!range && isSameDay(date(), range.end);
  };
  const isOutsideVisibleRange = () => {
    const range = visibleRange(state);
    return date().compare(range.start) < 0 || date().compare(range.end) > 0;
  };
  const isHovered = () => state.hoveredCell() === key && !notSelectable();
  const isPressed = () => state.pressedCell() === key;
  const isFocusVisible = () => state.focusVisibleCell() === key && isFocused();
  return {
    isHovered,
    isPressed,
    isFocusVisible,
    formattedDate: () => cellFormattedDate(state, date()),
    isSelected,
    isSelectionStart,
    isSelectionEnd,
    isFocused,
    isDisabled,
    isUnavailable,
    isOutsideVisibleRange,
    isInvalid,
    isToday,
    cellProps: {
      role: "gridcell",
      "aria-disabled": () => flag(notSelectable()),
      "aria-selected": () => flag(isSelected()),
      "aria-invalid": () => flag(isInvalid()),
    },
    buttonProps: {
      role: "button",
      tabIndex: () => (isDisabled() ? undefined : isSameDay(date(), focusedDate(state)) ? 0 : -1),
      "aria-disabled": () => flag(notSelectable()),
      "aria-label": () => cellLabel(state, date(), isSelected()),
      "aria-invalid": () => flag(isInvalid()),
      "aria-describedby": () => cellDescribedBy(state, isInvalid(), isFocused() && !notSelectable()),
      "data-date": key,
      "data-focused": () => flag(isFocused()),
      "data-hovered": () => flag(isHovered()),
      "data-pressed": () => flag(isPressed()),
      "data-focus-visible": () => flag(isFocusVisible()),
      "data-unavailable": () => flag(isUnavailable()),
      "data-disabled": () => flag(isDisabled()),
      "data-outside-visible-range": () => flag(isOutsideVisibleRange()),
      "data-outside-month": flag(isOutsideMonth),
      "data-selected": () => flag(isSelected()),
      "data-selection-start": () => flag(isSelectionStart()),
      "data-selection-end": () => flag(isSelectionEnd()),
      "data-invalid": () => flag(isInvalid()),
      "data-today": () => flag(isToday()),
    },
  };
}

// useCalendarBase / useCalendar / useRangeCalendar ----------------------------------------------

/** useCalendar / useRangeCalendar props read by the attribute bags (labelling). */
export interface AriaCalendarLabelProps {
  "aria-label"?: string | undefined;
  "aria-labelledby"?: string | undefined;
  "aria-describedby"?: string | undefined;
  "aria-details"?: string | undefined;
}

export interface CalendarAria {
  /** The calendar root (`role="application"`, labelled by the visible range). */
  calendarProps: Record<string, unknown>;
  /** The previous button (`onPress` = `calendarPreviousPress`, set by the component). */
  prevButtonProps: { "aria-label": Accessor<string>; isDisabled: Accessor<boolean> };
  /** The next button (`onPress` = `calendarNextPress`). */
  nextButtonProps: { "aria-label": Accessor<string>; isDisabled: Accessor<boolean> };
  /** The error message element. */
  errorMessageProps: { id: string };
  /** The visible range as a heading. */
  title: Accessor<string>;
}

/** useCalendar (useCalendarBase): the calendar's attribute bags (accessor values: read in bindings). */
export function calendarProps(props: AriaCalendarLabelProps, state: AnyCalendarState): CalendarAria {
  // React Aria hookData: the grids are labelled like the calendar.
  // Locals: a resumable closure reading `props.x` would capture the whole props object.
  const ariaLabel = props["aria-label"];
  state.aria = { label: ariaLabel, labelledBy: props["aria-labelledby"] };
  return {
    calendarProps: {
      role: "application",
      id: state.id,
      "aria-label": () => calendarAriaLabel(state, ariaLabel),
      "aria-labelledby": props["aria-labelledby"],
      "aria-describedby": props["aria-describedby"],
      "aria-details": props["aria-details"],
    },
    prevButtonProps: { "aria-label": () => message(state, "previous"), isDisabled: () => previousDisabled(state) },
    nextButtonProps: { "aria-label": () => message(state, "next"), isDisabled: () => nextDisabled(state) },
    errorMessageProps: { id: errorMessageId(state) },
    title: () => calendarTitle(state),
  };
}

/** useRangeCalendar: the range calendar's attribute bags (+ `rangeCalendarFocusOut`, range press in the grid handlers). */
export const rangeCalendarProps = calendarProps;

// useCalendarGrid --------------------------------------------------------------------------------

export interface AriaCalendarGridProps {
  /** The first date displayed in the grid as a key or an accessor of one (default: the visible range start). */
  startDate?: string | Accessor<string>;
  /** The last date displayed in the grid (default: the end of its month). */
  endDate?: string | Accessor<string>;
  /** @default "narrow" */
  weekdayStyle?: "narrow" | "short" | "long";
  firstDayOfWeek?: string;
}

export interface CalendarGridAria {
  /** The `<table role="grid">` attributes (handlers: `calendarGridKeyDown` / `FocusIn` / `FocusOut`). */
  gridProps: Record<string, unknown>;
  /** The `<thead>` attributes. */
  headerProps: { "aria-hidden": "true" };
  /** Localized weekday names. */
  weekDays: Accessor<string[]>;
  /** Number of weeks in the month. */
  weeksInMonth: Accessor<number>;
}

/** useCalendarGrid: the grid's attribute bags (accessor values: read in bindings). */
export function calendarGridProps(props: AriaCalendarGridProps, state: AnyCalendarState): CalendarGridAria {
  const keyOf = (value: string | Accessor<string> | undefined) => (typeof value === "function" ? value() : value);
  // Locals: a resumable closure reading `props.x` would capture the whole props object.
  const { startDate: startProp, endDate: endProp } = props;
  const weekdayStyle = props.weekdayStyle ?? "narrow";
  const startDate = () => {
    const key = keyOf(startProp);
    return key ? readDate(state, key) : visibleRange(state).start;
  };
  const endDate = () => {
    const key = keyOf(endProp);
    return key ? readDate(state, key) : endOfMonth(startDate());
  };
  const multiselectable = state.mode === "range" || state.selectionMode === "multiple";
  return {
    gridProps: {
      role: "grid",
      "aria-label": () => [state.aria?.label, visibleRangeDescription(state, startDate(), endDate(), true)].filter(Boolean).join(", "),
      "aria-labelledby": state.aria?.labelledBy,
      "aria-readonly": calendarFlagAttr(state, 1),
      "aria-disabled": calendarFlagAttr(state, 0),
      "aria-multiselectable": flag(multiselectable),
    },
    headerProps: { "aria-hidden": "true" },
    weekDays: () => weekDays(state, weekdayStyle, startDate()),
    weeksInMonth: () => getWeeksInMonthOf(state, startDate()),
  };
}

/** The visible range start as a key (computed by components; changes only when the range moves). Reads. */
export const visibleStartKey = (state: AnyCalendarState): string => cellKey(visibleRange(state).start);

/** Weeks of the grid at `offset` (from the visible start `startKey`): rows of cell keys (null: no date). */
export function gridWeeks(state: AnyCalendarState, offset: DateDuration | undefined, startKey?: string): { month: string; weeks: (string | null)[][] } {
  const start = gridStartDate(state, offset, startKey);
  const weeks: (string | null)[][] = [];
  const count = getWeeksInMonthOf(state, start);
  for (let i = 0; i < count; i++) weeks.push(getDatesInWeekOf(state, i, start).map((date) => (date ? cellKey(date) : null)));
  return { month: cellKey(start), weeks };
}
