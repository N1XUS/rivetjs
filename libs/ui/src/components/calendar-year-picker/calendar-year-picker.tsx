// Ported from HeroUI v3.2.6 packages/react/src/components/calendar-year-picker/calendar-year-picker.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria/useCalendar` `useCalendarHeading` / `useCalendarYearPicker` → cdk
//   `calendarHeadingProps` / `calendarYearPickerProps` (`@rivetjs/cdk/calendar/behaviour`; `value` / `items` are accessors);
//   `react-aria-components/Button` → `@rivetjs/cdk/button`; `@heroui/styles` → vendored `styles/`.
// - Slots: `calendarYearPickerVariants()` has no variants → one module-level object (upstream `useMemo` per part).
// - Render-prop values (`{ isOpen, monthYear, toggle }`, cell `{ year, formattedYear, isSelected, isCurrentYear, isOpen, selectYear }`) are
//   getter objects: a function child reads them inside its bindings and updates in place (React: a new snapshot per render).
// - The trigger / grid contexts are getter objects over signals (`resumableContext` ids `rv-ui-calendar-year-picker-trigger` /
//   `rv-ui-calendar-year-picker-grid`); upstream memoized snapshot objects.
// - Grid effects (`useEffect` position + focus on open) → one `clientEffect` (runs on interaction on a resumed page; at load when the
//   picker is server-rendered open): positions the grid over the day grid and focuses the active year when the picker opens.
// - `CalendarYearPickerGridBody` renders a keyed `For` over the years (React `Fragment key={year}`).
// - Year cells: `excludeFromTabOrder` / `aria-selected` change while the picker is open; cdk Button reads `excludeFromTabOrder` once and
//   forwards no `aria-selected`, so the cell renders its `<button>` through the cdk `render` prop with `tabindex` / `aria-selected` bound
//   (a user `render` gets them in its attributes). `data-selected` / `aria-label` are accessors.
// - Default indicator icon: upstream inline `IconChevronRight` svg → lucide `ChevronRight` via `@rivetjs/kit/icon` (1em).
import { Button as ButtonPrimitive } from "@rivetjs/cdk/button";
import type { ButtonProps as ButtonPrimitiveProps, ButtonRenderProps } from "@rivetjs/cdk/button";
import { calendarHeadingProps, calendarYearPickerProps } from "@rivetjs/cdk/calendar/behaviour";
import type { CalendarHeadingFormatOptions } from "@rivetjs/cdk/calendar/behaviour";
import type { DateDuration } from "@rivetjs/cdk/date";
import { focusedDate, maxValueOf, minValueOf } from "@rivetjs/cdk/state/calendar";
import { Icon } from "@rivetjs/kit/icon";
import { computed, createContext, signal, untrack, useContext } from "@rivetjs/reactivity";
import { For, Provider, clientEffect, ref } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { resumableContext } from "@rivetjs/runtime/resume-format";
import { isSlot } from "@rivetjs/runtime/slot";
import { ChevronRight } from "lucide";

import type { CalendarYearPickerVariants } from "../../../styles/src/components/calendar-year-picker/index.ts";
import { calendarYearPickerVariants } from "../../../styles/src/components/calendar-year-picker/index.ts";
import { getYearRange } from "../../utils/calendar.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { renderClass, splitLive } from "../../utils/live.tsx";

import { useCalendarOrRangeState } from "./use-calendar-state.ts";
import { useYearPicker } from "./year-picker-context.ts";

type Slots = ReturnType<typeof calendarYearPickerVariants>;
let SLOTS: Slots | undefined;
const slotsOf = (): Slots => (SLOTS ??= calendarYearPickerVariants());

/** A function child (render props), not lazy JSX children (compiler slots are functions too). */
const isRenderFn = (children: unknown): children is (values: never) => Content => typeof children === "function" && !isSlot(children);

/* -------------------------------------------------------------------------------------------------
 * CalendarYearPickerTrigger
 *
 * Replaces Calendar.Heading. Shows "Month Year" with a chevron that rotates
 * when the year picker is open.  Toggles isYearPickerOpen from CalendarBaseContext.
 * -----------------------------------------------------------------------------------------------*/
interface CalendarYearPickerTriggerProps extends Omit<ButtonPrimitiveProps, "children">, CalendarYearPickerVariants {
  children: Content | ((values: CalendarYearPickerTriggerRenderProps) => Content);
}

interface CalendarYearPickerTriggerRenderProps {
  isOpen: boolean;
  monthYear: string;
  toggle: () => void;
}

interface CalendarYearPickerTriggerHeadingProps<E extends keyof JSX.IntrinsicElements = "span">
  extends DOMRenderProps<E, undefined>, CalendarYearPickerVariants {
  /** An offset from the beginning of the visible date range (multi-month calendars). */
  offset?: DateDuration;
  /** The format of the heading. */
  format?: CalendarHeadingFormatOptions;
  children?: Content | ((values: CalendarYearPickerTriggerRenderProps) => Content);
  class?: string;
}

interface CalendarYearPickerTriggerIndicatorProps<E extends keyof JSX.IntrinsicElements = "span">
  extends DOMRenderProps<E, undefined>, CalendarYearPickerVariants {
  children?: Content | ((values: CalendarYearPickerTriggerRenderProps) => Content);
  class?: string;
}

type CalendarYearPickerTriggerHeadingSpanProps = CalendarYearPickerTriggerHeadingProps & Omit<JSX.IntrinsicElements["span"], "children" | "class">;
type CalendarYearPickerTriggerIndicatorSpanProps = CalendarYearPickerTriggerIndicatorProps & Omit<JSX.IntrinsicElements["span"], "children" | "class">;

/** Rivet: `{ isOpen, monthYear, toggle }` getters (upstream adds `slots`: one module-level object here). */
type CalendarYearPickerTriggerContextValue = CalendarYearPickerTriggerRenderProps;

const CalendarYearPickerTriggerContext = resumableContext(
  createContext<CalendarYearPickerTriggerContextValue | null>(null, { id: "rv-ui-calendar-year-picker-trigger" }),
);

function useCalendarYearPickerTriggerContext(): CalendarYearPickerTriggerContextValue {
  const context = useContext(CalendarYearPickerTriggerContext);

  if (!context) {
    throw new Error("CalendarYearPicker trigger components must be used within <CalendarYearPicker.Trigger>.");
  }

  return context;
}

const CalendarYearPickerTrigger = (props: CalendarYearPickerTriggerProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "onKeyDown", "onPress"]);
  const yearPicker = useYearPicker();
  const state = useCalendarOrRangeState();
  const monthYear = () => calendarHeadingProps({}, state);
  const slots = slotsOf();

  const handleToggle = () => {
    yearPicker.setIsYearPickerOpen(!untrack(yearPicker.isOpen));
  };

  const values: CalendarYearPickerTriggerRenderProps = {
    get isOpen() {
      return yearPicker.isOpen();
    },
    get monthYear() {
      return monthYear();
    },
    toggle: handleToggle,
  };

  const cls = composeTwRenderProps(local.class as never, slots.trigger());
  const content = () => (
    <ButtonPrimitive
      aria-expanded={() => yearPicker.isOpen()}
      aria-label={() => `${monthYear()}, year selector`}
      class={(typeof cls === "function" ? (v: ButtonRenderProps) => renderClass(cls, v) : cls) as never}
      data-open={(() => (yearPicker.isOpen() ? "true" : undefined)) as never}
      data-slot="calendar-year-picker-trigger"
      slot={null}
      onKeyDown={(e) => {
        local.onKeyDown?.(e);

        if (e.defaultPrevented) {
          return;
        }

        if (e.key === "Escape" && untrack(yearPicker.isOpen)) {
          e.preventDefault();
          yearPicker.setIsYearPickerOpen(false);
        }
      }}
      onPress={(event) => {
        local.onPress?.(event);
        handleToggle();
      }}
      {...(rest as object)}
    >
      {isRenderFn(local.children) ? local.children(values as never) : local.children}
    </ButtonPrimitive>
  );

  return (
    <Provider token={CalendarYearPickerTriggerContext} value={values}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * CalendarYearPickerTriggerHeading
 * -----------------------------------------------------------------------------------------------*/
const CalendarYearPickerTriggerHeading = <E extends keyof JSX.IntrinsicElements = "span">(
  props: CalendarYearPickerTriggerHeadingProps<E> & JSX.IntrinsicElements[E],
): JSX.Element => {
  const [local, rest] = splitLive(props as CalendarYearPickerTriggerHeadingSpanProps, ["children", "class", "format", "offset"]);
  const values = useCalendarYearPickerTriggerContext();
  const state = useCalendarOrRangeState();
  const heading = () => calendarHeadingProps({ format: local.format, offset: local.offset }, state);

  return (
    <dom.span class={composeSlotClassName(slotsOf().triggerHeading, local.class)} data-slot="calendar-year-picker-trigger-heading" {...(rest as object)}>
      {isRenderFn(local.children) ? local.children(values as never) : local.children === undefined ? heading : local.children}
    </dom.span>
  );
};

/* -------------------------------------------------------------------------------------------------
 * CalendarYearPickerTriggerIndicator
 * -----------------------------------------------------------------------------------------------*/
const CalendarYearPickerTriggerIndicator = <E extends keyof JSX.IntrinsicElements = "span">(
  props: CalendarYearPickerTriggerIndicatorProps<E> & JSX.IntrinsicElements[E],
): JSX.Element => {
  const [local, rest] = splitLive(props as CalendarYearPickerTriggerIndicatorSpanProps, ["children", "class"]);
  const values = useCalendarYearPickerTriggerContext();

  return (
    <dom.span
      aria-hidden="true"
      class={composeSlotClassName(slotsOf().triggerIndicator, local.class)}
      data-slot="calendar-year-picker-trigger-indicator"
      {...(rest as object)}
    >
      {isRenderFn(local.children) ? (
        local.children(values as never)
      ) : local.children === undefined ? (
        <Icon icon={ChevronRight} height="1em" width="1em" />
      ) : (
        local.children
      )}
    </dom.span>
  );
};

/* -------------------------------------------------------------------------------------------------
 * CalendarYearPickerGrid
 *
 * Renders a 3-column grid of year buttons. Hidden via CSS opacity when closed,
 * visible when data-open="true".  tabIndex is toggled so only the active view
 * receives keyboard focus.
 * -----------------------------------------------------------------------------------------------*/
interface CalendarYearPickerGridProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined>, CalendarYearPickerVariants {
  /** The format of the year. */
  format?: { year?: "numeric" | "2-digit"; era?: "long" | "short" | "narrow" };
  /** The number of years to display. */
  visibleYears?: number;
  children?: Content;
  class?: string;
}

type CalendarYearPickerGridDivProps = CalendarYearPickerGridProps & Omit<JSX.IntrinsicElements["div"], "children" | "class">;

interface CalendarYearPickerCellRenderProps {
  year: number;
  formattedYear: string;
  isSelected: boolean;
  isCurrentYear: boolean;
  isOpen: boolean;
  selectYear: () => void;
}

interface CalendarYearPickerGridBodyProps {
  children?: (values: CalendarYearPickerCellRenderProps) => Content;
}

interface CalendarYearPickerCellProps extends Omit<ButtonPrimitiveProps, "children">, CalendarYearPickerVariants {
  year: number;
  children?: Content | ((values: CalendarYearPickerCellRenderProps) => Content);
}

/** Rivet: getters over the grid's signals (upstream memoized snapshot) + accessor `years` for the keyed list. */
interface CalendarYearPickerGridContextValue {
  isYearPickerOpen: boolean;
  activeYear: number;
  currentYear: number;
  focusedYear: number;
  years: number[];
  getFormattedYear: (year: number) => string;
  selectYear: (year: number) => void;
  setActiveYear: (year: number) => void;
}

const CalendarYearPickerGridContext = resumableContext(
  createContext<CalendarYearPickerGridContextValue | null>(null, { id: "rv-ui-calendar-year-picker-grid" }),
);

function useCalendarYearPickerGridContext(): CalendarYearPickerGridContextValue {
  const context = useContext(CalendarYearPickerGridContext);

  if (!context) {
    throw new Error("CalendarYearPicker components must be used within <CalendarYearPicker.Grid>.");
  }

  return context;
}

const CalendarYearPickerGrid = <E extends keyof JSX.IntrinsicElements = "div">(
  props: CalendarYearPickerGridProps<E> & JSX.IntrinsicElements[E],
): JSX.Element => {
  const [local, rest] = splitLive(props as CalendarYearPickerGridDivProps, ["children", "class", "format", "onKeyDown", "visibleYears", "render"]);
  const yearPicker = useYearPicker();
  const state = useCalendarOrRangeState();
  const gridRef = ref<HTMLDivElement>();

  const visibleYears = (): number => {
    if (local.visibleYears != null) {
      return local.visibleYears;
    }

    const minValue = minValueOf(state);
    const maxValue = maxValueOf(state);

    if (!minValue || !maxValue) {
      return 20;
    }

    return getYearRange(minValue, maxValue).length;
  };

  // `useCalendarYearPicker` per render → a computed over the (live) options; its `items` / `value` are accessors.
  const picker = computed(() => calendarYearPickerProps({ format: local.format, visibleYears: visibleYears() }, state));
  const items = () => picker().items();
  const years = computed(() => items().map((item) => item.date.year));
  const itemByYear = computed(() => new Map(items().map((item) => [item.date.year, item])));
  const focusedYear = computed(() => items()[picker().value()]?.date.year ?? focusedDate(state).year);

  const getFormattedYear = (year: number) => itemByYear().get(year)?.formatted ?? String(year);

  const activeYear = signal(untrack(focusedYear));

  const focusYearCell = (year: number) => {
    const yearGrid = gridRef();

    if (!yearGrid) return;

    const yearCell = yearGrid.querySelector<HTMLElement>(`[data-year='${year}']`);

    if (yearCell) {
      yearCell.focus();
    }
  };

  const wasYearPickerOpen = { current: false };
  // Position the year grid to overlay the day grid; anchor keyboard focus to the selected year only when the picker opens.
  const onOpen = () => {
    const isYearPickerOpen = yearPicker.isOpen();
    const yearGrid = gridRef();

    if (yearGrid && isYearPickerOpen) {
      focusedDate(state);
      const calendarGrid = yearPicker.calendarRef()?.querySelector(`[data-slot='${yearPicker.calendarGridSlot}']`) as HTMLElement | null;

      if (calendarGrid) {
        yearGrid.style.top = `${calendarGrid.offsetTop}px`;
        yearGrid.style.height = `${calendarGrid.offsetHeight}px`;
      }
    }

    const justOpened = isYearPickerOpen && !wasYearPickerOpen.current;

    wasYearPickerOpen.current = isYearPickerOpen;

    const list = untrack(years);

    if (!justOpened || list.length === 0) return;

    const [firstYear] = list;

    if (firstYear == null) return;

    const focused = untrack(focusedYear);
    const nextActiveYear = list.includes(focused) ? focused : firstYear;

    activeYear.set(nextActiveYear);

    const rafId = requestAnimationFrame(() => {
      focusYearCell(nextActiveYear);
    });

    return () => {
      cancelAnimationFrame(rafId);
    };
  };

  if (untrack(yearPicker.isOpen)) clientEffect(onOpen, { when: "load" });
  else clientEffect(onOpen, { when: "interaction" });

  const handleYearSelect = (year: number) => {
    const item = untrack(itemByYear).get(year);

    if (item == null) {
      return;
    }

    yearPicker.setIsYearPickerOpen(false);
    untrack(picker).onChange(item.id);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    (local.onKeyDown as ((e: KeyboardEvent) => void) | undefined)?.(e);

    if (e.defaultPrevented) {
      return;
    }

    const isYearPickerOpen = untrack(yearPicker.isOpen);

    if (e.key === "Escape" && isYearPickerOpen) {
      e.preventDefault();
      yearPicker.setIsYearPickerOpen(false);

      return;
    }

    const list = untrack(years);

    if (!isYearPickerOpen || list.length === 0) {
      return;
    }

    const currentIndex = list.indexOf(untrack(activeYear));

    if (currentIndex === -1) {
      return;
    }

    let nextIndex = currentIndex;

    switch (e.key) {
      case "ArrowRight":
        nextIndex = Math.min(currentIndex + 1, list.length - 1);
        break;
      case "ArrowLeft":
        nextIndex = Math.max(currentIndex - 1, 0);
        break;
      case "ArrowDown":
        nextIndex = Math.min(currentIndex + 3, list.length - 1);
        break;
      case "ArrowUp":
        nextIndex = Math.max(currentIndex - 3, 0);
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = list.length - 1;
        break;
      default:
        return;
    }

    if (nextIndex !== currentIndex) {
      const nextYear = list[nextIndex];

      if (nextYear == null) return;

      e.preventDefault();
      activeYear.set(nextYear);
      focusYearCell(nextYear);
    }
  };

  // Read per access (not memoized) so it stays correct across midnight on Dec 31 (upstream: per render).
  const contextValue: CalendarYearPickerGridContextValue = {
    get activeYear() {
      // When the years move (paged by a year selection) and the active one left them, fall back to the first (upstream effect).
      const list = years();
      const active = activeYear();
      return list.length && !list.includes(active) ? list[0]! : active;
    },
    get currentYear() {
      return new Date().getFullYear();
    },
    get focusedYear() {
      return focusedYear();
    },
    getFormattedYear: (year: number) => getFormattedYear(year),
    get isYearPickerOpen() {
      return yearPicker.isOpen();
    },
    selectYear: (year: number) => handleYearSelect(year),
    setActiveYear: (year: number) => activeYear.set(year),
    get years() {
      return years();
    },
  };

  const cls = () => composeSlotClassName(slotsOf().yearGrid, local.class);
  const content = () =>
    local.render ? (
      <dom.div
        ref={gridRef}
        aria-hidden={() => String(!yearPicker.isOpen())}
        aria-label={() => picker()["aria-label"]}
        class={cls()}
        data-open={() => (yearPicker.isOpen() ? "true" : undefined)}
        data-slot="calendar-year-picker-grid"
        role="listbox"
        tabIndex={-1}
        onKeyDown={(e: KeyboardEvent) => handleKeyDown(e)}
        render={local.render as never}
        {...(rest as object)}
      >
        {local.children}
      </dom.div>
    ) : (
      <div
        ref={gridRef}
        aria-hidden={String(!yearPicker.isOpen())}
        aria-label={picker()["aria-label"]}
        class={cls()}
        data-open={yearPicker.isOpen() ? "true" : undefined}
        data-slot="calendar-year-picker-grid"
        role="listbox"
        tabIndex={-1}
        onKeyDown={(e) => handleKeyDown(e)}
        {...(rest as object)}
      >
        {local.children}
      </div>
    );

  return (
    <Provider token={CalendarYearPickerGridContext} value={contextValue}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * CalendarYearPickerGridBody
 * -----------------------------------------------------------------------------------------------*/
const CalendarYearPickerGridBody = (props: CalendarYearPickerGridBodyProps): JSX.Element => {
  const context = useCalendarYearPickerGridContext();
  const children = props.children;

  return (
    <For each={() => context.years} by={(year) => year}>
      {(year) => {
        const values: CalendarYearPickerCellRenderProps = {
          get formattedYear() {
            return context.getFormattedYear(year());
          },
          get isCurrentYear() {
            return year() === context.currentYear;
          },
          get isOpen() {
            return context.isYearPickerOpen;
          },
          get isSelected() {
            return year() === context.focusedYear;
          },
          selectYear: () => context.selectYear(untrack(year)),
          get year() {
            return year();
          },
        };

        return typeof children === "function" ? children(values) : <CalendarYearPickerCell year={untrack(year)} />;
      }}
    </For>
  ) as JSX.Element;
};

/* -------------------------------------------------------------------------------------------------
 * CalendarYearPickerCell
 * -----------------------------------------------------------------------------------------------*/
const CalendarYearPickerCell = (props: CalendarYearPickerCellProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "excludeFromTabOrder", "onFocus", "onPress", "year", "render"]);
  const context = useCalendarYearPickerGridContext();
  const year = local.year;
  const isSelected = () => year === context.focusedYear;
  const isActive = () => year === context.activeYear;
  const formattedYear = () => context.getFormattedYear(year);
  const values: CalendarYearPickerCellRenderProps = {
    get formattedYear() {
      return formattedYear();
    },
    get isCurrentYear() {
      return year === context.currentYear;
    },
    get isOpen() {
      return context.isYearPickerOpen;
    },
    get isSelected() {
      return isSelected();
    },
    selectYear: () => context.selectYear(year),
    year,
  };
  const excluded = () => local.excludeFromTabOrder ?? !(context.isYearPickerOpen && isActive());
  const userRender = local.render;
  const cls = composeTwRenderProps(local.class as never, slotsOf().yearCell());

  return (
    <ButtonPrimitive
      aria-label={() => formattedYear()}
      class={(typeof cls === "function" ? (v: ButtonRenderProps) => renderClass(cls, v) : cls) as never}
      data-selected={(() => (isSelected() ? "true" : undefined)) as never}
      data-slot="calendar-year-picker-year-cell"
      data-year={year}
      slot={null}
      onFocus={(event) => {
        local.onFocus?.(event);
        context.setActiveYear(year);
      }}
      onPress={(event) => {
        local.onPress?.(event);
        context.selectYear(year);
      }}
      render={(attrs, renderProps) =>
        userRender ? (
          userRender({ ...attrs, "aria-selected": () => String(isSelected()), tabindex: () => (excluded() ? -1 : undefined) } as never, renderProps)
        ) : (
          <button {...(attrs as object)} aria-selected={isSelected() ? "true" : "false"} tabIndex={excluded() ? -1 : undefined} />
        )
      }
      {...(rest as object)}
    >
      {isRenderFn(local.children) ? local.children(values as never) : local.children === undefined ? formattedYear : local.children}
    </ButtonPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export {
  CalendarYearPickerTrigger,
  CalendarYearPickerTriggerHeading,
  CalendarYearPickerTriggerIndicator,
  CalendarYearPickerGrid,
  CalendarYearPickerGridBody,
  CalendarYearPickerCell,
};
export type {
  CalendarYearPickerTriggerProps,
  CalendarYearPickerTriggerHeadingProps,
  CalendarYearPickerTriggerIndicatorProps,
  CalendarYearPickerTriggerRenderProps,
  CalendarYearPickerGridProps,
  CalendarYearPickerGridBodyProps,
  CalendarYearPickerCellProps,
  CalendarYearPickerCellRenderProps,
};
