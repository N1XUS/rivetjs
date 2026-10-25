// Ported from HeroUI v3.2.6 packages/react/src/components/range-calendar/range-calendar.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components/RangeCalendar` → `@rivetjs/cdk/calendar` (accessor render
//   props), `Button` → `@rivetjs/cdk/button`, `useLocale` → `@rivetjs/cdk/i18n`, `@internationalized/date` → `@rivetjs/cdk/date`,
//   `useControlledState` → cdk `controllable` (`isYearPickerOpen`: a value, a Signal (two-way) or a live prop); `@heroui/styles` → vendored.
// - `RangeCalendarContext` carries plain data `{ inRangeCalendar, dayView? }` instead of `{ slots, dayView }` (one module-level
//   `rangeCalendarVariants()`), provided around the cdk `RangeCalendar` (upstream:
//   inside its render function; same readers). Day view parts = `../calendar/calendar.tsx` `CalendarDayViewGridHeader` / `Body`
//   (visible range / time zone from the cdk state).
// - Date props (`value` / `defaultValue` ranges, `focusedValue`, `defaultFocusedValue`, `minValue`, `maxValue`, default bounds) reach
//   the cdk `RangeCalendar` in their string form (`../../utils/date-value.ts`: date instances are not serializable resume captures).
//   A controlled `value` is a Signal of `{ start, end }` strings (cdk).
// - `NavButton` default icons: upstream inline `IconChevronLeft` / `IconChevronRight` → lucide `ChevronLeft` / `ChevronRight` (16px).
// - `Cell`: the inner `span.range-calendar__cell-button` takes its `data-*` from the cdk render-prop accessors (reactive in place);
//   `children` function gets the cdk render props (accessors), otherwise `children ?? formattedDate`.
// - cdk parts read `class` / `visibleDuration` / bounds once (cdk P5): a live `class` (root, NavButton, Cell) goes in as a render-prop
//   function (`hasLiveProp`).
import { Button as ButtonPrimitive } from "@rivetjs/cdk/button";
import type { ButtonProps as ButtonPrimitiveProps, ButtonRenderProps } from "@rivetjs/cdk/button";
import {
  CalendarCell as CalendarCellPrimitive,
  CalendarGridBody as CalendarGridBodyPrimitive,
  CalendarGridHeader as CalendarGridHeaderPrimitive,
  CalendarGrid as CalendarGridPrimitive,
  CalendarHeaderCell as CalendarHeaderCellPrimitive,
  CalendarHeading as CalendarHeadingPrimitive,
  RangeCalendar as RangeCalendarPrimitive,
} from "@rivetjs/cdk/calendar";
import type {
  CalendarCellProps as CalendarCellPrimitiveProps,
  CalendarCellRenderProps,
  CalendarGridBodyProps as CalendarGridBodyPrimitiveProps,
  CalendarGridHeaderProps as CalendarGridHeaderPrimitiveProps,
  CalendarGridProps as CalendarGridPrimitiveProps,
  CalendarHeaderCellProps as CalendarHeaderCellPrimitiveProps,
  CalendarHeadingProps as CalendarHeadingPrimitiveProps,
  RangeCalendarProps as RACRangeCalendarProps,
  RangeCalendarRenderProps,
} from "@rivetjs/cdk/calendar";
import type { DateValue } from "@rivetjs/cdk/date";
import { useLocale } from "@rivetjs/cdk/i18n";
import { controllable, setControlledValue } from "@rivetjs/cdk/interactions";
import { Icon } from "@rivetjs/kit/icon";
import { createContext, useContext } from "@rivetjs/reactivity";
import type { Signal } from "@rivetjs/reactivity";
import { Provider, ref } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { isSlot } from "@rivetjs/runtime/slot";
import { ChevronLeft, ChevronRight } from "lucide";
import { cx } from "../../../styles/src/utils/tv.ts";

import type { RangeCalendarVariants } from "../../../styles/src/components/range-calendar/index.ts";
import { rangeCalendarVariants } from "../../../styles/src/components/range-calendar/index.ts";
import { CalendarDayViewGridBody, CalendarDayViewGridHeader, defaultBounds } from "../calendar/calendar.tsx";
import { useCalendarOrRangeState } from "../calendar-year-picker/use-calendar-state.ts";
import { YearPickerContext } from "../calendar-year-picker/year-picker-context.ts";
import type { YearPickerContextValue } from "../calendar-year-picker/year-picker-context.ts";
import type { DayOfWeek } from "../../utils/calendar.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { dateProp } from "../../utils/date-value.ts";
import { accessorIfLive, hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";

/* -------------------------------------------------------------------------------------------------
 * Calendar Context
 * -----------------------------------------------------------------------------------------------*/
interface RangeCalendarDayViewContext {
  days: number;
  firstDayOfWeek?: DayOfWeek;
  weekdayStyle?: "narrow" | "short" | "long";
}

interface RangeCalendarContext {
  dayView?: RangeCalendarDayViewContext;
  /** Rivet: set by `Calendar` (upstream: `slots`). */
  inRangeCalendar?: boolean;
}

const RangeCalendarContext = createContext<RangeCalendarContext>({});

type RangeCalendarSlots = ReturnType<typeof rangeCalendarVariants>;
let SLOTS: RangeCalendarSlots | undefined;
/** Upstream `use(RangeCalendarContext).slots`: `rangeCalendarVariants()` inside a `Calendar`, `undefined` outside. */
const slotsOf = (context: RangeCalendarContext): RangeCalendarSlots | undefined => (context.inRangeCalendar ? (SLOTS ??= rangeCalendarVariants()) : undefined);
const rootSlots = (): RangeCalendarSlots => (SLOTS ??= rangeCalendarVariants());

/* -------------------------------------------------------------------------------------------------
 * Calendar Root
 * -----------------------------------------------------------------------------------------------*/
interface RangeCalendarRootProps<T extends DateValue = DateValue> extends Omit<RACRangeCalendarProps<T>, "firstDayOfWeek">, RangeCalendarVariants {
  firstDayOfWeek?: DayOfWeek;
  /** Whether the year picker is open (a value, or a Signal: two-way). */
  isYearPickerOpen?: boolean | Signal<boolean>;
  onYearPickerOpenChange?: (isYearPickerOpen: boolean) => void;
  defaultYearPickerOpen?: boolean;
}

/** The cdk value props in their string form (`dateProp`); only the props that were passed (cdk tells controlled by `!== undefined`). */
function dateProps(local: Pick<RangeCalendarRootProps, "value" | "defaultValue" | "focusedValue" | "defaultFocusedValue">): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (local.value !== undefined) out.value = dateProp(local.value);
  if (local.defaultValue !== undefined) out.defaultValue = dateProp(local.defaultValue);
  if (local.focusedValue !== undefined) out.focusedValue = dateProp(local.focusedValue);
  if (local.defaultFocusedValue !== undefined) out.defaultFocusedValue = dateProp(local.defaultFocusedValue);
  return out;
}

function RangeCalendarRoot<T extends DateValue = DateValue>(props: RangeCalendarRootProps<T>): JSX.Element {
  const [local, rest] = splitLive(props as RangeCalendarRootProps, [
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
  const calendarContext: RangeCalendarContext = {
    dayView: isDayView && visibleDays != null ? { days: visibleDays, firstDayOfWeek } : undefined,
    inRangeCalendar: true,
  };
  const yearPickerContext: YearPickerContextValue = {
    calendarGridSlot: "range-calendar-grid",
    get isYearPickerOpen() {
      return yearPickerOpen.value();
    },
    isOpen: () => yearPickerOpen.value(),
    setIsYearPickerOpen: (open: boolean) => setControlledValue(yearPickerOpen, open),
    calendarRef: () => calendarRef(),
  };
  const classOf = () =>
    composeTwRenderProps(local.class as never, cx(rootSlots().base(), isWeekView && "range-calendar--week-view", isDayView && "range-calendar--day-view"));
  const cls = hasLiveProp(local, ["class"]) ? (values: RangeCalendarRenderProps) => renderClass(classOf(), values) : classOf();
  const content = () => (
    <RangeCalendarPrimitive
      ref={calendarRef}
      data-slot="range-calendar"
      firstDayOfWeek={firstDayOfWeek}
      maxValue={maxValue}
      minValue={minValue}
      visibleDuration={visibleDuration}
      {...(rest as object)}
      {...dateProps(local)}
      class={cls as never}
    >
      {local.children as never}
    </RangeCalendarPrimitive>
  );

  return (
    <Provider token={YearPickerContext} value={yearPickerContext}>
      <Provider token={RangeCalendarContext} value={calendarContext}>
        {content()}
      </Provider>
    </Provider>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Calendar Header
 * -----------------------------------------------------------------------------------------------*/
interface RangeCalendarHeaderProps<E extends keyof JSX.IntrinsicElements = "header"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

type RangeCalendarHeaderElementProps = RangeCalendarHeaderProps & Omit<JSX.IntrinsicElements["header"], "children" | "class">;

const RangeCalendarHeader = <E extends keyof JSX.IntrinsicElements = "header">(props: RangeCalendarHeaderProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as RangeCalendarHeaderElementProps, ["children", "class"]);
  const context = useContext(RangeCalendarContext);

  return (
    <dom.header class={composeSlotClassName(slotsOf(context)?.header, local.class)} data-slot="range-calendar-header" {...(rest as object)}>
      {local.children}
    </dom.header>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Calendar Heading
 * -----------------------------------------------------------------------------------------------*/
interface RangeCalendarHeadingProps extends CalendarHeadingPrimitiveProps {}

const RangeCalendarHeading = (props: RangeCalendarHeadingProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const context = useContext(RangeCalendarContext);

  return (
    <CalendarHeadingPrimitive
      data-slot="range-calendar-heading"
      {...(rest as object)}
      class={composeSlotClassName(slotsOf(context)?.heading, local.class as string)}
    />
  );
};

/* -------------------------------------------------------------------------------------------------
 * Calendar Nav Button
 * -----------------------------------------------------------------------------------------------*/
interface RangeCalendarNavButtonProps extends ButtonPrimitiveProps {
  slot?: "previous" | "next";
}

const RangeCalendarNavButton = (props: RangeCalendarNavButtonProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "slot"]);
  const context = useContext(RangeCalendarContext);
  const slots = slotsOf(context);
  const slot = local.slot;
  // Strings only below: JSX children are resumable slots and a captured tv slots object (functions) is not serializable.
  const navButtonClass = slots?.navButton();
  const iconClass = slots?.navButtonIcon();
  const classOf = () => composeTwRenderProps(local.class as never, navButtonClass);
  const cls = hasLiveProp(local, ["class"]) ? (values: ButtonRenderProps) => renderClass(classOf(), values) : classOf();

  return (
    <ButtonPrimitive data-slot="range-calendar-nav-button" slot={slot} {...(rest as object)} class={cls as never}>
      {local.children === undefined ? (
        slot === "previous" ? (
          <Icon icon={ChevronLeft} size={16} class={iconClass} data-slot="range-calendar-nav-button-icon" />
        ) : (
          <Icon icon={ChevronRight} size={16} class={iconClass} data-slot="range-calendar-nav-button-icon" />
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
interface RangeCalendarGridProps extends CalendarGridPrimitiveProps {}

const RangeCalendarGrid = (props: RangeCalendarGridProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "weekdayStyle"]);
  const calendarContext = useContext(RangeCalendarContext);
  const weekdayStyle = local.weekdayStyle ?? "short";
  const dayView = calendarContext.dayView;
  const contextValue: RangeCalendarContext = {
    ...calendarContext,
    dayView: dayView ? { ...dayView, weekdayStyle } : undefined,
  };
  const content = () => (
    <CalendarGridPrimitive
      data-slot="range-calendar-grid"
      weekdayStyle={weekdayStyle}
      {...(rest as object)}
      class={composeSlotClassName(slotsOf(calendarContext)?.grid, local.class)}
    >
      {local.children}
    </CalendarGridPrimitive>
  );

  return (
    <Provider token={RangeCalendarContext} value={contextValue}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Calendar Grid Header
 * -----------------------------------------------------------------------------------------------*/
interface RangeCalendarGridHeaderProps extends CalendarGridHeaderPrimitiveProps {}

const RangeCalendarGridHeader = (props: RangeCalendarGridHeaderProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const { dayView, ...context } = useContext(RangeCalendarContext);
  const cls = () => composeSlotClassName(slotsOf(context)?.gridHeader, local.class);

  if (dayView && dayView.days >= 7 && typeof local.children === "function") {
    return (
      <CalendarDayViewGridHeader
        class={cls()}
        data-slot="range-calendar-grid-header"
        firstDayOfWeek={dayView.firstDayOfWeek}
        state={useCalendarOrRangeState()}
        weekdayStyle={dayView.weekdayStyle}
      >
        {local.children}
      </CalendarDayViewGridHeader>
    );
  }

  return (
    <CalendarGridHeaderPrimitive data-slot="range-calendar-grid-header" {...(rest as object)} class={cls()}>
      {local.children}
    </CalendarGridHeaderPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Calendar Grid Body
 * -----------------------------------------------------------------------------------------------*/
interface RangeCalendarGridBodyProps extends CalendarGridBodyPrimitiveProps {}

const RangeCalendarGridBody = (props: RangeCalendarGridBodyProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const { dayView, ...context } = useContext(RangeCalendarContext);
  const cls = () => composeSlotClassName(slotsOf(context)?.gridBody, local.class);

  if (dayView && dayView.days >= 7 && typeof local.children === "function") {
    return (
      <CalendarDayViewGridBody class={cls()} data-slot="range-calendar-grid-body" firstDayOfWeek={dayView.firstDayOfWeek} state={useCalendarOrRangeState()}>
        {local.children}
      </CalendarDayViewGridBody>
    );
  }

  return (
    <CalendarGridBodyPrimitive data-slot="range-calendar-grid-body" {...(rest as object)} class={cls()}>
      {local.children}
    </CalendarGridBodyPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Calendar Header Cell
 * -----------------------------------------------------------------------------------------------*/
interface RangeCalendarHeaderCellProps extends CalendarHeaderCellPrimitiveProps {}

const RangeCalendarHeaderCell = (props: RangeCalendarHeaderCellProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const context = useContext(RangeCalendarContext);

  return (
    <CalendarHeaderCellPrimitive
      data-slot="range-calendar-header-cell"
      {...(rest as object)}
      class={composeSlotClassName(slotsOf(context)?.headerCell, local.class)}
    />
  );
};

/* -------------------------------------------------------------------------------------------------
 * Calendar Cell
 * -----------------------------------------------------------------------------------------------*/
interface RangeCalendarCellProps extends CalendarCellPrimitiveProps {}

const RangeCalendarCell = (props: RangeCalendarCellProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(RangeCalendarContext);
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(context)?.cell());
  const cls = hasLiveProp(local, ["class"]) ? (values: CalendarCellRenderProps) => renderClass(classOf(), values) : classOf();

  const children = local.children as unknown;

  return (
    <CalendarCellPrimitive data-slot="range-calendar-cell" {...(rest as CalendarCellPrimitiveProps)} class={cls as never}>
      {(values: CalendarCellRenderProps) => (
        <span
          class="range-calendar__cell-button"
          data-disabled={values.isDisabled() ? "true" : undefined}
          data-hovered={values.isHovered() ? "true" : undefined}
          data-pressed={values.isPressed() ? "true" : undefined}
          data-selected={values.isSelectionStart() || values.isSelectionEnd() ? "true" : undefined}
          data-slot="range-calendar-cell-button"
        >
          {typeof children === "function" && !isSlot(children)
            ? (children as (values: CalendarCellRenderProps) => Content)(values)
            : children === undefined
              ? values.formattedDate
              : (children as Content)}
        </span>
      )}
    </CalendarCellPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Calendar Cell Indicator
 * -----------------------------------------------------------------------------------------------*/
interface RangeCalendarCellIndicatorProps<E extends keyof JSX.IntrinsicElements = "span"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

type RangeCalendarCellIndicatorSpanProps = RangeCalendarCellIndicatorProps & Omit<JSX.IntrinsicElements["span"], "children" | "class">;

const RangeCalendarCellIndicator = <E extends keyof JSX.IntrinsicElements = "span">(
  props: RangeCalendarCellIndicatorProps<E> & JSX.IntrinsicElements[E],
): JSX.Element => {
  const [local, rest] = splitLive(props as RangeCalendarCellIndicatorSpanProps, ["class"]);
  const context = useContext(RangeCalendarContext);

  return (
    <dom.span
      aria-hidden="true"
      class={composeSlotClassName(slotsOf(context)?.cellIndicator, local.class)}
      data-slot="range-calendar-cell-indicator"
      {...(rest as object)}
    />
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export {
  RangeCalendarContext,
  RangeCalendarRoot,
  RangeCalendarHeader,
  RangeCalendarHeading,
  RangeCalendarNavButton,
  RangeCalendarGrid,
  RangeCalendarGridHeader,
  RangeCalendarGridBody,
  RangeCalendarHeaderCell,
  RangeCalendarCell,
  RangeCalendarCellIndicator,
};
export type {
  RangeCalendarRootProps,
  RangeCalendarHeaderProps,
  RangeCalendarHeadingProps,
  RangeCalendarNavButtonProps,
  RangeCalendarGridProps,
  RangeCalendarGridHeaderProps,
  RangeCalendarGridBodyProps,
  RangeCalendarHeaderCellProps,
  RangeCalendarCellProps,
  RangeCalendarCellIndicatorProps,
  RangeCalendarRenderProps,
};
