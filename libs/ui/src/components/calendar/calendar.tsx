// Ported from HeroUI v3.2.6 packages/react/src/components/calendar/calendar.tsx (+ calendar-day-view-grid-header.tsx,
// calendar-day-view-grid-body.tsx) (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components/Calendar` → `@rivetjs/cdk/calendar` (accessor render props),
//   `Button` → `@rivetjs/cdk/button`, `useLocale` → `@rivetjs/cdk/i18n`, `@internationalized/date` → `@rivetjs/cdk/date`,
//   `useControlledState` → cdk `controllable` (`isYearPickerOpen`: a value, a Signal (two-way) or a live prop); `@heroui/styles` → vendored.
// - `CalendarContext` carries plain data `{ inCalendar, dayView? }` instead of `{ slots, dayView }` (`calendarVariants()` has no
//   variants → one module-level slots object). `dayView` = `{ days, firstDayOfWeek,
//   weekdayStyle? }`: the day view parts read the visible range / time zone from the cdk calendar state (upstream copies them into the
//   context from the RAC render prop). It is provided around the cdk `Calendar` (upstream: inside its render function; same readers).
// - The day-view grid header / body (upstream `CalendarDayViewGridHeader` / `CalendarDayViewGridBody`, `React.cloneElement` for
//   keys) render the cells straight from the `children` function; rows / labels re-render when the visible range moves.
// - `YearPickerContext`: getter object over the controllable state (`../calendar-year-picker/year-picker-context.ts`); `calendarRef`
//   is a `ref()` signal. A user `ref` replaces it (as upstream: `{...rest}` after `ref`), which leaves the year grid unpositioned.
// - `NavButton` default icons: upstream inline `IconChevronLeft` / `IconChevronRight` svgs → lucide `ChevronLeft` / `ChevronRight`
//   via `@rivetjs/kit/icon` (16px). `children ||`: omit the children for the default icon (Rivet children are slots).
// - Date props (`value`, `defaultValue`, `focusedValue`, `defaultFocusedValue`, `minValue`, `maxValue`, default bounds) reach the
//   cdk `Calendar` in their string form (`../../utils/date-value.ts`): the cdk captures its props for resume and date instances are
//   not serializable. Values are read once (a controlled value is a Signal of the string form, cdk).
// - cdk parts read `class` / `visibleDuration` / bounds once (cdk P5): a live `class` (root, NavButton, Cell) goes in as a render-prop
//   function (`hasLiveProp`); Heading / Grid / GridHeader / GridBody / HeaderCell take string classes (cdk) read in the binding.
import { Button as ButtonPrimitive } from "@rivetjs/cdk/button";
import type { ButtonProps as ButtonPrimitiveProps, ButtonRenderProps } from "@rivetjs/cdk/button";
import {
  CalendarCell as CalendarCellPrimitive,
  CalendarGridBody as CalendarGridBodyPrimitive,
  CalendarGridHeader as CalendarGridHeaderPrimitive,
  CalendarGrid as CalendarGridPrimitive,
  CalendarHeaderCell as CalendarHeaderCellPrimitive,
  CalendarHeading as CalendarHeadingPrimitive,
  Calendar as CalendarPrimitive,
} from "@rivetjs/cdk/calendar";
import type {
  CalendarCellProps as CalendarCellPrimitiveProps,
  CalendarCellRenderProps,
  CalendarGridBodyProps as CalendarGridBodyPrimitiveProps,
  CalendarGridHeaderProps as CalendarGridHeaderPrimitiveProps,
  CalendarGridProps as CalendarGridPrimitiveProps,
  CalendarHeaderCellProps as CalendarHeaderCellPrimitiveProps,
  CalendarHeadingProps as CalendarHeadingPrimitiveProps,
  CalendarProps as RACCalendarProps,
  CalendarRenderProps,
  CalendarSelectionMode,
} from "@rivetjs/cdk/calendar";
import type { CalendarIdentifier, DateValue } from "@rivetjs/cdk/date";
import { CalendarDate, DateFormatter, createCalendar } from "@rivetjs/cdk/date";
import { useLocale } from "@rivetjs/cdk/i18n";
import { controllable, setControlledValue } from "@rivetjs/cdk/interactions";
import type { AnyCalendarState } from "@rivetjs/cdk/state/calendar";
import { visibleRange } from "@rivetjs/cdk/state/calendar";
import { Icon } from "@rivetjs/kit/icon";
import { computed, createContext, useContext } from "@rivetjs/reactivity";
import type { Signal } from "@rivetjs/reactivity";
import { Provider, ref } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { ChevronLeft, ChevronRight } from "lucide";
import { cx } from "tailwind-variants/lite";

import type { CalendarVariants } from "../../../styles/src/components/calendar/index.ts";
import { calendarVariants } from "../../../styles/src/components/calendar/index.ts";
import { useCalendarOrRangeState } from "../calendar-year-picker/use-calendar-state.ts";
import { YearPickerContext } from "../calendar-year-picker/year-picker-context.ts";
import type { YearPickerContextValue } from "../calendar-year-picker/year-picker-context.ts";
import { getDayViewGridRows, getDayViewWeekDayLabels, getGregorianYearOffset } from "../../utils/calendar.ts";
import type { DayOfWeek } from "../../utils/calendar.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { dateProp } from "../../utils/date-value.ts";
import { accessorIfLive, hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";

/* -------------------------------------------------------------------------------------------------
 * Calendar Context
 * -----------------------------------------------------------------------------------------------*/
interface CalendarDayViewContext {
  days: number;
  firstDayOfWeek?: DayOfWeek;
  weekdayStyle?: "narrow" | "short" | "long";
}

interface CalendarContext {
  dayView?: CalendarDayViewContext;
  /** Rivet: set by `Calendar` (upstream: `slots`). */
  inCalendar?: boolean;
}

const CalendarContext = createContext<CalendarContext>({});

type CalendarSlots = ReturnType<typeof calendarVariants>;
let SLOTS: CalendarSlots | undefined;
/** Upstream `use(CalendarContext).slots`: `calendarVariants()` inside a `Calendar`, `undefined` outside. */
const slotsOf = (context: CalendarContext): CalendarSlots | undefined => (context.inCalendar ? (SLOTS ??= calendarVariants()) : undefined);
const rootSlots = (): CalendarSlots => (SLOTS ??= calendarVariants());

/* -------------------------------------------------------------------------------------------------
 * Calendar Root
 * -----------------------------------------------------------------------------------------------*/
interface CalendarRootProps<T extends DateValue = DateValue, M extends CalendarSelectionMode = "single">
  extends Omit<RACCalendarProps<T, M>, "firstDayOfWeek">, CalendarVariants {
  firstDayOfWeek?: DayOfWeek;
  /** Whether the year picker is open (a value, or a Signal: two-way). */
  isYearPickerOpen?: boolean | Signal<boolean>;
  onYearPickerOpenChange?: (isYearPickerOpen: boolean) => void;
  defaultYearPickerOpen?: boolean;
}

/** Shared by Calendar / RangeCalendar: default bounds 1900-01-01 … 2099-12-31 in the locale's calendar system (+ era offset). */
function defaultBounds(locale: string): { min: CalendarDate; max: CalendarDate } {
  const calendarIdentifier = new DateFormatter(locale).resolvedOptions().calendar as CalendarIdentifier;
  const calendarProp = createCalendar(calendarIdentifier);
  const gregorianYearOffset = getGregorianYearOffset(calendarProp.identifier);

  return {
    min: new CalendarDate(calendarProp, 1900 + gregorianYearOffset, 1, 1),
    max: new CalendarDate(calendarProp, 2099 + gregorianYearOffset, 12, 31),
  };
}

/** The cdk value props in their string form (`dateProp`); only the props that were passed (cdk tells controlled by `!== undefined`). */
function dateProps(local: Pick<CalendarRootProps, "value" | "defaultValue" | "focusedValue" | "defaultFocusedValue">): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (local.value !== undefined) out.value = dateProp(local.value);
  if (local.defaultValue !== undefined) out.defaultValue = dateProp(local.defaultValue);
  if (local.focusedValue !== undefined) out.focusedValue = dateProp(local.focusedValue);
  if (local.defaultFocusedValue !== undefined) out.defaultFocusedValue = dateProp(local.defaultFocusedValue);
  return out;
}

function CalendarRoot<T extends DateValue = DateValue, M extends CalendarSelectionMode = "single">(props: CalendarRootProps<T, M>): JSX.Element {
  const [local, rest] = splitLive(props as CalendarRootProps, [
    "children",
    "class",
    "defaultFocusedValue",
    "defaultValue",
    "defaultYearPickerOpen",
    "firstDayOfWeek",
    "focusedValue",
    "isYearPickerOpen",
    "maxValue",
    "minValue",
    "onYearPickerOpenChange",
    "value",
    "visibleDuration",
  ]);
  const visibleDuration = local.visibleDuration;
  const isWeekView = visibleDuration?.weeks != null;
  const isDayView = visibleDuration?.days != null;
  const visibleDays = visibleDuration?.days;
  const { locale } = useLocale();
  const calendarRef = ref<HTMLDivElement>();
  const yearPickerOpen = controllable<boolean>(
    accessorIfLive(local, "isYearPickerOpen") as boolean | Signal<boolean> | undefined,
    local.defaultYearPickerOpen ?? false,
    local.onYearPickerOpenChange,
  );
  // React Aria memoizes calendar state against minValue/maxValue identity (the cdk state reads them once).
  const bounds = local.minValue == null || local.maxValue == null ? defaultBounds(locale) : undefined;
  const minValue = dateProp(local.minValue ?? bounds!.min);
  const maxValue = dateProp(local.maxValue ?? bounds!.max);
  const firstDayOfWeek = local.firstDayOfWeek;
  const calendarContext: CalendarContext = {
    dayView: isDayView && visibleDays != null ? { days: visibleDays, firstDayOfWeek } : undefined,
    inCalendar: true,
  };
  const yearPickerContext: YearPickerContextValue = {
    calendarGridSlot: "calendar-grid",
    get isYearPickerOpen() {
      return yearPickerOpen.value();
    },
    isOpen: () => yearPickerOpen.value(),
    setIsYearPickerOpen: (open: boolean) => setControlledValue(yearPickerOpen, open),
    calendarRef: () => calendarRef(),
  };
  const classOf = () =>
    composeTwRenderProps(local.class as never, cx(rootSlots().base(), isWeekView && "calendar--week-view", isDayView && "calendar--day-view"));
  const cls = hasLiveProp(local, ["class"]) ? (values: CalendarRenderProps) => renderClass(classOf(), values) : classOf();
  const content = () => (
    <CalendarPrimitive
      ref={calendarRef}
      data-slot="calendar"
      firstDayOfWeek={firstDayOfWeek}
      maxValue={maxValue}
      minValue={minValue}
      visibleDuration={visibleDuration}
      {...(rest as object)}
      {...dateProps(local)}
      class={cls as never}
    >
      {local.children as never}
    </CalendarPrimitive>
  );

  return (
    <Provider token={YearPickerContext} value={yearPickerContext}>
      <Provider token={CalendarContext} value={calendarContext}>
        {content()}
      </Provider>
    </Provider>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Calendar Header
 * -----------------------------------------------------------------------------------------------*/
interface CalendarHeaderProps<E extends keyof JSX.IntrinsicElements = "header"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

type CalendarHeaderElementProps = CalendarHeaderProps & Omit<JSX.IntrinsicElements["header"], "children" | "class">;

const CalendarHeader = <E extends keyof JSX.IntrinsicElements = "header">(props: CalendarHeaderProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as CalendarHeaderElementProps, ["children", "class"]);
  const context = useContext(CalendarContext);

  return (
    <dom.header class={composeSlotClassName(slotsOf(context)?.header, local.class)} data-slot="calendar-header" {...(rest as object)}>
      {local.children}
    </dom.header>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Calendar Heading
 * -----------------------------------------------------------------------------------------------*/
interface CalendarHeadingProps extends CalendarHeadingPrimitiveProps {}

const CalendarHeading = (props: CalendarHeadingProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const context = useContext(CalendarContext);

  return (
    <CalendarHeadingPrimitive
      data-slot="calendar-heading"
      {...(rest as object)}
      class={composeSlotClassName(slotsOf(context)?.heading, local.class as string)}
    />
  );
};

/* -------------------------------------------------------------------------------------------------
 * Calendar Nav Button
 * -----------------------------------------------------------------------------------------------*/
interface CalendarNavButtonProps extends ButtonPrimitiveProps {
  slot?: "previous" | "next";
}

const CalendarNavButton = (props: CalendarNavButtonProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "slot"]);
  const context = useContext(CalendarContext);
  const slots = slotsOf(context);
  const slot = local.slot;
  // Strings only below: JSX children are resumable slots and a captured tv slots object (functions) is not serializable.
  const navButtonClass = slots?.navButton();
  const iconClass = slots?.navButtonIcon();
  const classOf = () => composeTwRenderProps(local.class as never, navButtonClass);
  const cls = hasLiveProp(local, ["class"]) ? (values: ButtonRenderProps) => renderClass(classOf(), values) : classOf();

  return (
    <ButtonPrimitive data-slot="calendar-nav-button" slot={slot} {...(rest as object)} class={cls as never}>
      {local.children === undefined ? (
        slot === "previous" ? (
          <Icon icon={ChevronLeft} size={16} class={iconClass} data-slot="calendar-nav-button-icon" />
        ) : (
          <Icon icon={ChevronRight} size={16} class={iconClass} data-slot="calendar-nav-button-icon" />
        )
      ) : (
        local.children
      )}
    </ButtonPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Calendar Grid
 * -----------------------------------------------------------------------------------------------*/
interface CalendarGridProps extends CalendarGridPrimitiveProps {}

const CalendarGrid = (props: CalendarGridProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "weekdayStyle"]);
  const calendarContext = useContext(CalendarContext);
  const weekdayStyle = local.weekdayStyle ?? "short";
  const dayView = calendarContext.dayView;
  const contextValue: CalendarContext = {
    ...calendarContext,
    dayView: dayView ? { ...dayView, weekdayStyle } : undefined,
  };
  const content = () => (
    <CalendarGridPrimitive
      data-slot="calendar-grid"
      weekdayStyle={weekdayStyle}
      {...(rest as object)}
      class={composeSlotClassName(slotsOf(calendarContext)?.grid, local.class)}
    >
      {local.children}
    </CalendarGridPrimitive>
  );

  return (
    <Provider token={CalendarContext} value={contextValue}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Calendar Day View Grid Header / Body (upstream calendar-day-view-grid-header.tsx / -body.tsx)
 * -----------------------------------------------------------------------------------------------*/
interface CalendarDayViewGridHeaderProps {
  children: (day: string) => Content;
  class?: string;
  "data-slot"?: string;
  firstDayOfWeek?: DayOfWeek;
  weekdayStyle?: "narrow" | "short" | "long";
  /** Rivet: the visible range / time zone come from the calendar state. */
  state: AnyCalendarState;
}

function CalendarDayViewGridHeader(props: CalendarDayViewGridHeaderProps): JSX.Element {
  const { children, firstDayOfWeek, state } = props;
  const dataSlot = props["data-slot"] ?? "calendar-grid-header";
  const weekdayStyle = props.weekdayStyle ?? "short";
  const weekDays = computed(() => getDayViewWeekDayLabels(visibleRange(state).start, state.locale, firstDayOfWeek, weekdayStyle, state.timeZone ?? "UTC"));

  return (
    <dom.thead aria-hidden="true" class={props.class} data-slot={dataSlot}>
      <tr>{weekDays().map((day) => children(day))}</tr>
    </dom.thead>
  );
}

interface CalendarDayViewGridBodyProps {
  children: (date: CalendarDate) => Content;
  class?: string;
  "data-slot"?: string;
  firstDayOfWeek?: DayOfWeek;
  state: AnyCalendarState;
}

function CalendarDayViewGridBody(props: CalendarDayViewGridBodyProps): JSX.Element {
  const { children, firstDayOfWeek, state } = props;
  const dataSlot = props["data-slot"] ?? "calendar-grid-body";
  const rows = computed(() => {
    const range = visibleRange(state);
    return getDayViewGridRows(range.start, range.end, state.locale, firstDayOfWeek);
  });

  return (
    <dom.tbody class={props.class} data-slot={dataSlot}>
      {rows().map((row) => (
        <tr>{row.map((date) => (date ? children(date as CalendarDate) : <td />))}</tr>
      ))}
    </dom.tbody>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Calendar Grid Header
 * -----------------------------------------------------------------------------------------------*/
interface CalendarGridHeaderProps extends CalendarGridHeaderPrimitiveProps {}

const CalendarGridHeader = (props: CalendarGridHeaderProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const { dayView, ...context } = useContext(CalendarContext);
  const cls = () => composeSlotClassName(slotsOf(context)?.gridHeader, local.class);

  if (dayView && dayView.days >= 7 && typeof local.children === "function") {
    return (
      <CalendarDayViewGridHeader
        class={cls()}
        data-slot="calendar-grid-header"
        firstDayOfWeek={dayView.firstDayOfWeek}
        state={useCalendarOrRangeState()}
        weekdayStyle={dayView.weekdayStyle}
      >
        {local.children}
      </CalendarDayViewGridHeader>
    );
  }

  return (
    <CalendarGridHeaderPrimitive data-slot="calendar-grid-header" {...(rest as object)} class={cls()}>
      {local.children}
    </CalendarGridHeaderPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Calendar Grid Body
 * -----------------------------------------------------------------------------------------------*/
interface CalendarGridBodyProps extends CalendarGridBodyPrimitiveProps {}

const CalendarGridBody = (props: CalendarGridBodyProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const { dayView, ...context } = useContext(CalendarContext);
  const cls = () => composeSlotClassName(slotsOf(context)?.gridBody, local.class);

  if (dayView && dayView.days >= 7 && typeof local.children === "function") {
    return (
      <CalendarDayViewGridBody class={cls()} data-slot="calendar-grid-body" firstDayOfWeek={dayView.firstDayOfWeek} state={useCalendarOrRangeState()}>
        {local.children}
      </CalendarDayViewGridBody>
    );
  }

  return (
    <CalendarGridBodyPrimitive data-slot="calendar-grid-body" {...(rest as object)} class={cls()}>
      {local.children}
    </CalendarGridBodyPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Calendar Header Cell
 * -----------------------------------------------------------------------------------------------*/
interface CalendarHeaderCellProps extends CalendarHeaderCellPrimitiveProps {}

const CalendarHeaderCell = (props: CalendarHeaderCellProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const context = useContext(CalendarContext);

  return (
    <CalendarHeaderCellPrimitive
      data-slot="calendar-header-cell"
      {...(rest as object)}
      class={composeSlotClassName(slotsOf(context)?.headerCell, local.class)}
    />
  );
};

/* -------------------------------------------------------------------------------------------------
 * Calendar Cell
 * -----------------------------------------------------------------------------------------------*/
interface CalendarCellProps extends CalendarCellPrimitiveProps {}

const CalendarCell = (props: CalendarCellProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(CalendarContext);
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(context)?.cell());
  const cls = hasLiveProp(local, ["class"]) ? (values: CalendarCellRenderProps) => renderClass(classOf(), values) : classOf();

  // The cdk cell renders `formattedDate` when no children are given (upstream `children || formattedDate`).
  return (
    <CalendarCellPrimitive data-slot="calendar-cell" {...(rest as CalendarCellPrimitiveProps)} class={cls as never}>
      {local.children}
    </CalendarCellPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Calendar Cell Indicator
 * -----------------------------------------------------------------------------------------------*/
interface CalendarCellIndicatorProps<E extends keyof JSX.IntrinsicElements = "span"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

type CalendarCellIndicatorSpanProps = CalendarCellIndicatorProps & Omit<JSX.IntrinsicElements["span"], "children" | "class">;

const CalendarCellIndicator = <E extends keyof JSX.IntrinsicElements = "span">(
  props: CalendarCellIndicatorProps<E> & JSX.IntrinsicElements[E],
): JSX.Element => {
  const [local, rest] = splitLive(props as CalendarCellIndicatorSpanProps, ["class"]);
  const context = useContext(CalendarContext);

  return (
    <dom.span
      aria-hidden="true"
      class={composeSlotClassName(slotsOf(context)?.cellIndicator, local.class)}
      data-slot="calendar-cell-indicator"
      {...(rest as object)}
    />
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export {
  CalendarContext,
  CalendarRoot,
  CalendarHeader,
  CalendarHeading,
  CalendarNavButton,
  CalendarGrid,
  CalendarGridHeader,
  CalendarGridBody,
  CalendarHeaderCell,
  CalendarCell,
  CalendarCellIndicator,
  CalendarDayViewGridBody,
  CalendarDayViewGridHeader,
  defaultBounds,
};
export type {
  CalendarRootProps,
  CalendarHeaderProps,
  CalendarHeadingProps,
  CalendarNavButtonProps,
  CalendarGridProps,
  CalendarGridHeaderProps,
  CalendarGridBodyProps,
  CalendarHeaderCellProps,
  CalendarCellProps,
  CalendarCellIndicatorProps,
  CalendarRenderProps,
};
