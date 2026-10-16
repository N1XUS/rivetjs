// Ported from react-aria-components (react-spectrum) src/Calendar.tsx, Apache-2.0, © Adobe.
// Rivet:
// - RAC parts 1:1: Calendar / RangeCalendar provide `ButtonContext` (slots `previous` / `next`),
//   `HeadingContext` (`children: () => title`), `TextContext` (slot `errorMessage`) and the state
//   contexts; CalendarGrid, CalendarGridHeader, CalendarHeaderCell, CalendarGridBody, CalendarCell,
//   CalendarHeading, CalendarMonthPicker, CalendarYearPicker read them.
// - Preset: a Calendar without children renders RAC's documented anatomy (header with the previous
//   button, heading and next button, then one CalendarGrid per visible month). The buttons have no
//   icon (headless: pass `<Button slot="previous"><ChevronLeft /></Button>` children for icons).
// - Dates live in signals as strings; cells capture date keys only (resumable). Each grid body
//   re-renders when its first date moves (a computed key), cells patch attributes otherwise.
// - Grid interaction is delegated: one keydown / focus / pointer handler per `<table>` finds the
//   cell from `data-date`; RAC's per-cell useHover / usePress / useFocusRing states are signals of
//   the hovered / pressed / focus-visible cell key in the state.
// - Render props are accessors (`class={({ isSelected }) => isSelected() ? … }`); CalendarCell's
//   `date` render prop is an accessor too (date objects are not serializable).
// `render` (RAC DOMRenderProps): given, the attributes object (reactive entries are accessors) goes to `render(attrs, renderProps)` instead of the default element. Parts: Calendar, RangeCalendar, CalendarGrid, CalendarGridHeader, CalendarHeaderCell, CalendarGridBody, CalendarCell
// (the `<td>` stays; `render` replaces its inner `<div>`).
// Deviations: CalendarCell takes no HoverEvents (`isHovered` render prop only);
// no `locale` prop (I18nProvider); CalendarContext provides `{ firstDayOfWeek }` only (RAC: all props).
import { computed, createContext, untrack, useContext, type Signal } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { isSlot } from "@rivetjs/runtime/slot";
import type { CalendarDate, CalendarIdentifier, Calendar as ICalendar, DateDuration, DateValue } from "@rivetjs/cdk/date";
import { visuallyHidden } from "@rivetjs/cdk/a11y";
import { globalDOMProps, type GlobalDOMAttributes } from "@rivetjs/cdk/dom-props";
import { type DOMRenderProps } from "../utils/render.ts";
import { ButtonContext, Button } from "../button/index.tsx";
import { Heading, HeadingContext, type HeadingProps } from "../heading/index.tsx";
import { TextContext } from "../text/index.tsx";
import {
  Provider,
  contextProps,
  renderProps,
  renderPropsOf,
  resumableContext,
  type ClassNameOrFunction,
  type ContextValue,
  type RefValue,
  type RenderProps,
  type SlotProps,
  type StyleObject,
} from "../slots/index.tsx";
import {
  createCalendarState,
  createRangeCalendarState,
  getDatesInWeek,
  isCalendarDisabled,
  isValueInvalid,
  message,
  readDate,
  visibleRange,
  type AnyCalendarState,
  type CalendarSelectionMode,
  type CalendarState,
  type CalendarStateOptions,
  type RangeCalendarState,
  type RangeCalendarStateOptions,
} from "../state/calendar.ts";
import {
  GRID_KEYS,
  calendarCellProps,
  calendarGridClick,
  calendarGridContextMenu,
  calendarGridFocusIn,
  calendarGridFocusOut,
  calendarGridKeyDown,
  calendarGridMouseDown,
  calendarGridPointerDown,
  calendarGridPointerOut,
  calendarGridPointerOver,
  calendarGridPointerUp,
  calendarGridProps,
  calendarHeadingProps,
  calendarMonthPickerProps,
  calendarNextPress,
  calendarPreviousPress,
  calendarProps,
  calendarYearPickerProps,
  calendarFlagAttr,
  cellKey,
  focusCell,
  isOutsideMonthOf,
  promptId,
  rangeCalendarFocusOut,
  rangeCalendarProps,
  visibleStartKey,
  type AriaCalendarLabelProps,
  type CalendarHeadingFormatOptions,
  type CalendarMonthPickerProps as AriaCalendarMonthPickerProps,
  type CalendarPickerAria,
  type CalendarYearPickerProps as AriaCalendarYearPickerProps,
} from "./behaviour.tsx";
import { liveDateProps } from "../date-field/live-value.tsx";
import { hasLive, isLive, liveOptions } from "../utils/live.tsx";

export type { CalendarSelectionMode, DateInput, DateValueString, FirstDayOfWeek, PageBehavior, RangeValue } from "../state/calendar.ts";
export type { CalendarPickerAria, CalendarPickerItem } from "./behaviour.tsx";

export interface CalendarRenderProps {
  /** Whether the calendar is disabled. @selector [data-disabled] */
  isDisabled: () => boolean;
  /** State of the calendar. */
  state: CalendarState;
  /** Whether the calendar is invalid. @selector [data-invalid] */
  isInvalid: () => boolean;
}

export interface RangeCalendarRenderProps extends Omit<CalendarRenderProps, "state"> {
  /** State of the range calendar. */
  state: RangeCalendarState;
}

interface CalendarRootProps extends SlotProps, AriaCalendarLabelProps {
  /** The amount of days that will be displayed at once. This affects how pagination works. @default { months: 1 } */
  visibleDuration?: DateDuration;
  /** Creates a Calendar object for a calendar identifier (default: `createCalendar` of `@rivetjs/cdk/date`). */
  createCalendar?: (identifier: CalendarIdentifier) => ICalendar;
  ref?: RefValue<HTMLDivElement>;
}

export interface CalendarProps<T extends DateValue = DateValue, M extends CalendarSelectionMode = "single">
  extends
    Omit<CalendarStateOptions<T, M>, "locale">,
    CalendarRootProps,
    RenderProps<CalendarRenderProps>,
    DOMRenderProps<"div", CalendarRenderProps>,
    Omit<GlobalDOMAttributes<HTMLDivElement>, "style"> {
  /** The CSS class of the element (a function of the render props). @default "rv-Calendar" */
  class?: ClassNameOrFunction<CalendarRenderProps>;
}

export interface RangeCalendarProps<T extends DateValue = DateValue>
  extends
    Omit<RangeCalendarStateOptions<T>, "locale">,
    CalendarRootProps,
    RenderProps<RangeCalendarRenderProps>,
    DOMRenderProps<"div", RangeCalendarRenderProps>,
    Omit<GlobalDOMAttributes<HTMLDivElement>, "style"> {
  /** The CSS class of the element (a function of the render props). @default "rv-RangeCalendar" */
  class?: ClassNameOrFunction<RangeCalendarRenderProps>;
  /** Rivet: what happens when focus leaves (or the pointer is released outside) mid-selection (useRangeCalendar `commitBehavior`). @default "select" */
  commitBehavior?: "select" | "clear" | "reset";
}

export const CalendarContext = resumableContext(createContext<ContextValue<Partial<CalendarProps<any, any>>, HTMLDivElement>>({}, { id: "rv-calendar" }));
export const RangeCalendarContext = resumableContext(
  createContext<ContextValue<Partial<RangeCalendarProps<any>>, HTMLDivElement>>({}, { id: "rv-range-calendar" }),
);
export const CalendarStateContext = resumableContext(createContext<CalendarState | null>(null, { id: "rv-calendar-state" }));
export const RangeCalendarStateContext = resumableContext(createContext<RangeCalendarState | null>(null, { id: "rv-range-calendar-state" }));

/** Handlers the Calendar root / CalendarGrid own (the user's run after them). */
const ROOT_OWNED = ["onFocusOut", "style", "render"] as const;
const GRID_OWNED = [
  "onKeyDown",
  "onFocusIn",
  "onFocusOut",
  "onMouseDown",
  "onPointerDown",
  "onPointerUp",
  "onPointerOver",
  "onPointerOut",
  "onClick",
  "onContextMenu",
  "style",
  "render",
] as const;

type Handler = ((event: any) => void) | undefined;

/** Number of month grids of a visible duration (preset). */
const monthCount = (duration: DateDuration): number => (duration.months && !duration.days && !duration.weeks && !duration.years ? duration.months : 1);

/** The preset anatomy (no children): header (previous, heading, next) + one grid per visible month. */
function defaultChildren(state: AnyCalendarState): Content {
  const months = [...Array(monthCount(state.visibleDuration)).keys()];
  return (
    <>
      <header>
        <Button slot="previous" />
        <Heading />
        <Button slot="next" />
      </header>
      {months.map((offset) => (
        <CalendarGrid offset={offset ? { months: offset } : undefined}>{(date: CalendarDate) => <CalendarCell date={date} />}</CalendarGrid>
      ))}
    </>
  );
}

/** Shared Calendar / RangeCalendar root (RAC: two copies of the same markup). */
function calendarRoot(
  props: (CalendarProps<any, any> | RangeCalendarProps<any>) & { commitBehavior?: "select" | "clear" | "reset" },
  ref: RefValue<HTMLDivElement> | undefined,
  state: AnyCalendarState,
): Content {
  const isRange = state.mode === "range";
  const aria = isRange ? rangeCalendarProps(props, state) : calendarProps(props, state);
  const values = {
    state,
    isDisabled: () => isCalendarDisabled(state),
    isInvalid: () => isValueInvalid(state),
  };
  // Lazy: the preset renders inside the Provider; an object-literal
  // function value (resumable wherever the children accessor is encoded).
  const preset = { content: () => defaultChildren(state) };
  const childrenUnset = untrack(() => props.children) === undefined;
  // Options hoisted: no function in the `rp` initializer (spread sites capture `rp.class` / `rp.style`, not the
  // children accessor: per-key live views).
  const rpOptions = {
    values,
    defaultClassName: isRange ? "rv-RangeCalendar" : "rv-Calendar",
    defaultChildren: childrenUnset ? (preset.content as unknown as Content) : undefined,
  };
  const rp = renderPropsOf(props as never, rpOptions);
  // Live props (P5): a live `isDisabled` is an accessor in the spread bag `dom` (default element and
  // `render` attrs); a static one is the plain value.
  const isDisabled = calendarFlagAttr(state, 0);
  const dom = globalDOMProps(props, ROOT_OWNED);
  // Only in the spread bag (a plain JSX attribute after a spread takes the key out of it).
  dom["data-disabled"] = isDisabled;
  const userFocusOut = (props as { onFocusOut?: Handler }).onFocusOut;
  const commitBehavior = isRange ? (props.commitBehavior ?? "select") : undefined;
  const slot = props.slot || undefined;
  const { calendarProps: rootProps, prevButtonProps, nextButtonProps, errorMessageProps, title } = aria;
  const ariaLabel = rootProps["aria-label"] as () => string;
  const firstDayOfWeek = props.firstDayOfWeek;
  if (props.render) {
    const attrs = {
      ...dom,
      ...rootProps,
      ref: ref as never,
      class: () => rp.class(),
      style: () => rp.style(),
      slot,
      "data-rv-calendar": state.id,
      "data-commit-behavior": commitBehavior,
      "data-invalid": () => (isValueInvalid(state) ? "true" : undefined),
      onFocusOut: (event: FocusEvent) => {
        rangeCalendarFocusOut(event as never, state);
        userFocusOut?.(event);
      },
      children: () => (
        <Provider
          values={[
            [
              ButtonContext,
              {
                slots: {
                  previous: {
                    "aria-label": prevButtonProps["aria-label"](),
                    isDisabled: prevButtonProps.isDisabled,
                    onPress: (event: { target: EventTarget | null }) => calendarPreviousPress(event, state),
                  },
                  next: {
                    "aria-label": nextButtonProps["aria-label"](),
                    isDisabled: nextButtonProps.isDisabled,
                    onPress: (event: { target: EventTarget | null }) => calendarNextPress(event, state),
                  },
                },
              },
            ],
            [HeadingContext, { "aria-hidden": "true", level: 2, children: title }],
            isRange ? [RangeCalendarStateContext, state] : [CalendarStateContext, state],
            isRange ? [RangeCalendarContext, { firstDayOfWeek }] : [CalendarContext, { firstDayOfWeek }],
            [TextContext, { slots: { errorMessage: errorMessageProps } }],
          ]}
        >
          <div style={visuallyHidden}>
            <h2>{ariaLabel()}</h2>
          </div>
          {rp.children()}
          {isRange ? (
            <>
              <span id={promptId(state, "start")} hidden>
                {message(state, "startRangeSelectionPrompt")}
              </span>
              <span id={promptId(state, "finish")} hidden>
                {message(state, "finishRangeSelectionPrompt")}
              </span>
            </>
          ) : null}
          <div style={visuallyHidden}>
            <button
              type="button"
              aria-label={nextButtonProps["aria-label"]()}
              disabled={nextButtonProps.isDisabled()}
              onClick={() => calendarNextPress(null, state)}
              tabIndex={-1}
            ></button>
          </div>
        </Provider>
      ),
    };
    return props.render(attrs as never, values as never);
  }
  return (
    <div
      {...dom}
      {...rootProps}
      ref={ref as never}
      class={rp.class()}
      style={rp.style()}
      slot={slot}
      data-rv-calendar={state.id}
      data-commit-behavior={commitBehavior}
      data-invalid={isValueInvalid(state) ? "true" : undefined}
      onFocusOut={(event) => {
        rangeCalendarFocusOut(event, state);
        userFocusOut?.(event);
      }}
    >
      <Provider
        values={[
          [
            ButtonContext,
            {
              slots: {
                previous: {
                  "aria-label": prevButtonProps["aria-label"](),
                  isDisabled: prevButtonProps.isDisabled,
                  onPress: (event: { target: EventTarget | null }) => calendarPreviousPress(event, state),
                },
                next: {
                  "aria-label": nextButtonProps["aria-label"](),
                  isDisabled: nextButtonProps.isDisabled,
                  onPress: (event: { target: EventTarget | null }) => calendarNextPress(event, state),
                },
              },
            },
          ],
          [HeadingContext, { "aria-hidden": "true", level: 2, children: title }],
          isRange ? [RangeCalendarStateContext, state] : [CalendarStateContext, state],
          isRange ? [RangeCalendarContext, { firstDayOfWeek }] : [CalendarContext, { firstDayOfWeek }],
          [TextContext, { slots: { errorMessage: errorMessageProps } }],
        ]}
      >
        {/* A screen reader only description of the entire visible range rather than a separate heading above each grid. */}
        <div style={visuallyHidden}>
          <h2>{ariaLabel()}</h2>
        </div>
        {rp.children()}
        {isRange ? (
          <>
            <span id={promptId(state, "start")} hidden>
              {message(state, "startRangeSelectionPrompt")}
            </span>
            <span id={promptId(state, "finish")} hidden>
              {message(state, "finishRangeSelectionPrompt")}
            </span>
          </>
        ) : null}
        {/* For touch screen readers, a visually hidden next button after the month grid so it's easy to navigate after reaching the end without going all the way to the top. */}
        <div style={visuallyHidden}>
          <button
            type="button"
            aria-label={nextButtonProps["aria-label"]()}
            disabled={nextButtonProps.isDisabled()}
            onClick={() => calendarNextPress(null, state)}
            tabIndex={-1}
          ></button>
        </div>
      </Provider>
    </div>
  );
}

/**
 * Rivet: a picker provides `defaultValue` / `defaultFocusedValue` / `isInvalid` as accessors through
 * CalendarContext (read when the popover creates the calendar, ACCESSOR RULE); resolve them once.
 */
function resolveAccessors<P extends object>(props: P, liveInvalid: boolean): P {
  // Live props: a controlled `value={date()}` stays live (string-form accessor; read, never written); so does a live
  // `isInvalid={x()}` (an accessor from `liveOptions`).
  const out = { ...liveDateProps(props as { value?: unknown }) } as Record<string, unknown>;
  for (const key of liveInvalid ? ["defaultValue", "defaultFocusedValue"] : ["defaultValue", "defaultFocusedValue", "isInvalid"]) {
    const value = out[key];
    // These options are never signals, so any function is an accessor.
    if (typeof value === "function") out[key] = untrack(value as () => unknown);
  }
  return out as P;
}

/** Shared state setup: `autoFocus` focuses the focused cell once mounted (RAC useCalendarCell `autoFocus`). */
function autoFocusCell(props: { autoFocus?: boolean }, state: AnyCalendarState): void {
  if (props.autoFocus) clientEffect(() => focusCell(state, document.querySelector(`[data-rv-calendar="${state.id}"]`)), { when: "load" });
}

/** A calendar displays one or more date grids and allows users to select a single date. */
export function Calendar<T extends DateValue = DateValue, M extends CalendarSelectionMode = "single">(inProps: CalendarProps<T, M>) {
  // Live props (P5): `isDisabled` / `isReadOnly` / `isInvalid` and a controlled `value` stay live (accessors into the
  // state); the rest of the body is read once (untracked: a prop change never re-creates the calendar).
  return untrack(() => calendarPart(inProps));
}

/** Calendar flags that stay live (accessors the state reads at use). */
const CALENDAR_LIVE = ["isDisabled", "isReadOnly", "isInvalid"] as const;

function calendarPart<T extends DateValue, M extends CalendarSelectionMode>(inProps: CalendarProps<T, M>) {
  const [ctxProps, ref] = contextProps(inProps, inProps.ref, CalendarContext);
  const props = hasLive(ctxProps) ? liveOptions(ctxProps, CALENDAR_LIVE as never) : ctxProps;
  const state = createCalendarState(resolveAccessors(props, isLive(ctxProps, "isInvalid")) as CalendarStateOptions<T, M>);
  autoFocusCell(props, state);
  return calendarRoot(props as never, ref, state);
}

/** A range calendar displays one or more date grids and allows users to select a contiguous range of dates. */
export function RangeCalendar<T extends DateValue = DateValue>(inProps: RangeCalendarProps<T>) {
  // Live props (P5): as Calendar.
  return untrack(() => rangeCalendarPart(inProps));
}

function rangeCalendarPart<T extends DateValue>(inProps: RangeCalendarProps<T>) {
  const [ctxProps, ref] = contextProps(inProps, inProps.ref, RangeCalendarContext);
  const props = hasLive(ctxProps) ? liveOptions(ctxProps, CALENDAR_LIVE as never) : ctxProps;
  const state = createRangeCalendarState(resolveAccessors(props, isLive(ctxProps, "isInvalid")) as RangeCalendarStateOptions<T>);
  autoFocusCell(props, state);
  return calendarRoot(props as never, ref, state);
}

/** The calendar state of the enclosing Calendar / RangeCalendar. */
const calendarStateOf = (): AnyCalendarState => (useContext(CalendarStateContext) ?? useContext(RangeCalendarStateContext))!;

// CalendarGrid ----------------------------------------------------------------------------------

export interface CalendarCellRenderProps {
  /** The date that the cell represents. */
  date: () => CalendarDate;
  /** The day number formatted according to the current locale. */
  formattedDate: string;
  /** Whether the cell is currently hovered with a mouse. @selector [data-hovered] */
  isHovered: () => boolean;
  /** Whether the cell is currently being pressed. @selector [data-pressed] */
  isPressed: () => boolean;
  /** Whether the cell is selected. @selector [data-selected] */
  isSelected: () => boolean;
  /** Whether the cell is the first date in a range selection. @selector [data-selection-start] */
  isSelectionStart: () => boolean;
  /** Whether the cell is the last date in a range selection. @selector [data-selection-end] */
  isSelectionEnd: () => boolean;
  /** Whether the cell is focused. @selector [data-focused] */
  isFocused: () => boolean;
  /** Whether the cell is keyboard focused. @selector [data-focus-visible] */
  isFocusVisible: () => boolean;
  /** Whether the cell is disabled (min / max, outside the visible range, or the calendar is disabled). @selector [data-disabled] */
  isDisabled: () => boolean;
  /** Whether the cell is outside the visible range of the calendar. @selector [data-outside-visible-range] */
  isOutsideVisibleRange: () => boolean;
  /** Whether the cell is outside the current month. @selector [data-outside-month] */
  isOutsideMonth: () => boolean;
  /** Whether the cell is unavailable (`isDateUnavailable`). @selector [data-unavailable] */
  isUnavailable: () => boolean;
  /** Whether the cell is part of an invalid selection. @selector [data-invalid] */
  isInvalid: () => boolean;
  /** Whether the cell is today. @selector [data-today] */
  isToday: () => boolean;
}

export interface CalendarGridProps extends DOMRenderProps<"table", Record<string, never>>, Omit<GlobalDOMAttributes<HTMLTableElement>, "style"> {
  /** @default "rv-CalendarGrid" */
  class?: string;
  style?: StyleObject;
  /**
   * Either a function to render calendar cells for each date in the month, or children containing a
   * `<CalendarGridHeader>` and `<CalendarGridBody>` when additional customization is needed.
   */
  children?: Content | ((date: CalendarDate) => Content);
  /** An offset from the beginning of the visible date range that this CalendarGrid should display (multi-month calendars). */
  offset?: DateDuration;
  /** The style of weekday names to display in the calendar grid header. @default "narrow" */
  weekdayStyle?: "narrow" | "short" | "long";
  ref?: RefValue<HTMLTableElement>;
}

interface InternalCalendarGridContextValue {
  headerProps: { "aria-hidden": "true" };
  weekDays: () => string[];
  /** The grid's first date (key). */
  startDate: () => string;
  weeksInMonth: () => number;
}

const InternalCalendarGridContext = resumableContext(createContext<InternalCalendarGridContextValue | null>(null, { id: "rv-calendar-grid" }));

/** A render function (not lazy JSX children, which are functions too). */
const isRenderFunction = (children: unknown): children is (date: CalendarDate) => Content => typeof children === "function" && !isSlot(children);

/** A calendar grid displays a single grid of days within a calendar or range calendar (a month by default). */
export function CalendarGrid(props: CalendarGridProps) {
  const state = calendarStateOf();
  const offset = props.offset;
  // The first date: re-renders the body only when it moves (an outside `focusedValue` write included).
  const startDate = computed(() => (offset ? cellKey(visibleRange(state).start.add(offset)) : visibleStartKey(state)));
  const grid = calendarGridProps({ startDate, weekdayStyle: props.weekdayStyle }, state);
  const dom = globalDOMProps(props, GRID_OWNED) as Record<string, unknown>;
  // Locals: a resumable closure reading `props.x` would capture the whole props object.
  const {
    onKeyDown: userKeyDown,
    onFocusIn: userFocusIn,
    onFocusOut: userFocusOut,
    onMouseDown: userMouseDown,
    onPointerDown: userPointerDown,
    onPointerUp: userPointerUp,
    onPointerOver: userPointerOver,
    onPointerOut: userPointerOut,
    onClick: userClick,
    onContextMenu: userContextMenu,
  } = props as Record<(typeof GRID_OWNED)[number], Handler>;
  const children = props.children;
  const className = props.class ?? "rv-CalendarGrid";
  const style = props.style;
  const ref = props.ref;
  if (props.render) {
    const attrs = {
      ...dom,
      ...grid.gridProps,
      ref: ref as never,
      style,
      class: className,
      "data-rk": GRID_KEYS,
      onKeyDown: (event: KeyboardEvent) => {
        calendarGridKeyDown(event as never, state);
        userKeyDown?.(event);
      },
      onFocusIn: (event: FocusEvent) => {
        calendarGridFocusIn(event as never, state);
        userFocusIn?.(event);
      },
      onFocusOut: (event: FocusEvent) => {
        calendarGridFocusOut(event as never, state);
        userFocusOut?.(event);
      },
      onMouseDown: (event: MouseEvent) => {
        calendarGridMouseDown(event as never);
        userMouseDown?.(event);
      },
      onPointerDown: (event: PointerEvent) => {
        calendarGridPointerDown(event as never, state);
        userPointerDown?.(event);
      },
      onPointerUp: (event: PointerEvent) => {
        calendarGridPointerUp(event as never);
        userPointerUp?.(event);
      },
      onPointerOver: (event: PointerEvent) => {
        calendarGridPointerOver(event as never, state);
        userPointerOver?.(event);
      },
      onPointerOut: (event: PointerEvent) => {
        calendarGridPointerOut(event as never, state);
        userPointerOut?.(event);
      },
      onClick: (event: MouseEvent) => {
        calendarGridClick(event as never, state);
        userClick?.(event);
      },
      onContextMenu: (event: MouseEvent) => {
        calendarGridContextMenu(event as never);
        userContextMenu?.(event);
      },
      children: () =>
        isRenderFunction(children) ? (
          <>
            <CalendarGridHeader>{(day: string) => <CalendarHeaderCell>{day}</CalendarHeaderCell>}</CalendarGridHeader>
            <CalendarGridBody>{children}</CalendarGridBody>
          </>
        ) : (
          children
        ),
    };
    return (
      <Provider
        values={[[InternalCalendarGridContext, { headerProps: grid.headerProps, weekDays: grid.weekDays, startDate, weeksInMonth: grid.weeksInMonth }]]}
      >
        {props.render(attrs as never, {} as never)}
      </Provider>
    );
  }
  return (
    <Provider values={[[InternalCalendarGridContext, { headerProps: grid.headerProps, weekDays: grid.weekDays, startDate, weeksInMonth: grid.weeksInMonth }]]}>
      <table
        {...dom}
        {...grid.gridProps}
        ref={ref as never}
        style={style}
        class={className}
        data-rk={GRID_KEYS}
        onKeyDown={(event) => {
          calendarGridKeyDown(event, state);
          userKeyDown?.(event);
        }}
        onFocusIn={(event) => {
          calendarGridFocusIn(event, state);
          userFocusIn?.(event);
        }}
        onFocusOut={(event) => {
          calendarGridFocusOut(event, state);
          userFocusOut?.(event);
        }}
        onMouseDown={(event) => {
          calendarGridMouseDown(event);
          userMouseDown?.(event);
        }}
        onPointerDown={(event) => {
          calendarGridPointerDown(event, state);
          userPointerDown?.(event);
        }}
        onPointerUp={(event) => {
          calendarGridPointerUp(event);
          userPointerUp?.(event);
        }}
        onPointerOver={(event) => {
          calendarGridPointerOver(event, state);
          userPointerOver?.(event);
        }}
        onPointerOut={(event) => {
          calendarGridPointerOut(event, state);
          userPointerOut?.(event);
        }}
        onClick={(event) => {
          calendarGridClick(event, state);
          userClick?.(event);
        }}
        onContextMenu={(event) => {
          calendarGridContextMenu(event);
          userContextMenu?.(event);
        }}
      >
        {isRenderFunction(children) ? (
          <>
            <CalendarGridHeader>{(day: string) => <CalendarHeaderCell>{day}</CalendarHeaderCell>}</CalendarGridHeader>
            <CalendarGridBody>{children}</CalendarGridBody>
          </>
        ) : (
          children
        )}
      </table>
    </Provider>
  );
}

export interface CalendarGridHeaderProps extends DOMRenderProps<"thead", undefined>, Omit<GlobalDOMAttributes<HTMLTableSectionElement>, "style"> {
  /** @default "rv-CalendarGridHeader" */
  class?: string;
  style?: StyleObject;
  /** A function to render a `<CalendarHeaderCell>` for a weekday name. */
  children: (day: string) => Content;
  ref?: RefValue<HTMLTableSectionElement>;
}

/** A calendar grid header displays a row of week day names at the top of a month. */
export function CalendarGridHeader(props: CalendarGridHeaderProps) {
  const { headerProps, weekDays } = useContext(InternalCalendarGridContext)!;
  const dom = globalDOMProps(props, ["style", "render"]);
  const render = props.children;
  const { ref, style } = props;
  const className = props.class ?? "rv-CalendarGridHeader";
  if (props.render) {
    const attrs = { ...dom, ...headerProps, ref: ref as never, style, class: className, children: () => <tr>{weekDays().map((day) => render(day))}</tr> };
    return props.render(attrs as never, undefined as never);
  }
  return (
    <thead {...dom} {...headerProps} ref={ref as never} style={style} class={className}>
      <tr>{weekDays().map((day) => render(day))}</tr>
    </thead>
  );
}

export interface CalendarHeaderCellProps extends DOMRenderProps<"th", undefined>, Omit<GlobalDOMAttributes<HTMLTableCellElement>, "style"> {
  /** @default "rv-CalendarHeaderCell" */
  class?: string;
  style?: StyleObject;
  id?: string;
  children?: Content;
  ref?: RefValue<HTMLTableCellElement>;
}

/** A calendar header cell displays a week day name at the top of a column within a calendar. */
export function CalendarHeaderCell(props: CalendarHeaderCellProps) {
  const dom = globalDOMProps(props, ["style", "render"]);
  const { id, ref, style, children } = props;
  const className = props.class || "rv-CalendarHeaderCell";
  if (props.render) return props.render({ ...dom, id, ref: ref as never, style, class: className, children } as never, undefined as never);
  return (
    <th {...dom} id={id} ref={ref as never} style={style} class={className}>
      {children}
    </th>
  );
}

export interface CalendarGridBodyProps extends DOMRenderProps<"tbody", undefined>, Omit<GlobalDOMAttributes<HTMLTableSectionElement>, "style"> {
  /** @default "rv-CalendarGridBody" */
  class?: string;
  style?: StyleObject;
  /** A function to render a `<CalendarCell>` for a given date. */
  children: (date: CalendarDate) => Content;
  ref?: RefValue<HTMLTableSectionElement>;
}

/** The body rows of the grid starting at `key` (re-rendered only when it moves: reads `start` only, see `visibleStart`). */
function gridRows(state: AnyCalendarState, key: string, weeksInMonth: () => number, render: (date: CalendarDate) => Content): Content {
  return untrack(() => {
    const start = readDate(state, key);
    return [...new Array(weeksInMonth()).keys()].map((weekIndex) => (
      <tr>{getDatesInWeek(state, weekIndex, start).map((date) => (date ? render(date) : <td></td>))}</tr>
    ));
  });
}

/** A calendar grid body displays a grid of calendar cells within a month. */
export function CalendarGridBody(props: CalendarGridBodyProps) {
  const state = calendarStateOf();
  const { startDate, weeksInMonth } = useContext(InternalCalendarGridContext)!;
  const dom = globalDOMProps(props, ["style", "render"]);
  const render = props.children;
  const { ref, style } = props;
  const className = props.class ?? "rv-CalendarGridBody";
  if (props.render) {
    return props.render(
      { ...dom, ref: ref as never, style, class: className, children: () => gridRows(state, startDate(), weeksInMonth, render) } as never,
      undefined as never,
    );
  }
  return (
    <tbody {...dom} ref={ref as never} style={style} class={className}>
      {gridRows(state, startDate(), weeksInMonth, render)}
    </tbody>
  );
}

// CalendarCell ----------------------------------------------------------------------------------

export interface CalendarCellProps
  extends RenderProps<CalendarCellRenderProps>, DOMRenderProps<"div", CalendarCellRenderProps>, Omit<GlobalDOMAttributes<HTMLDivElement>, "style"> {
  /** The CSS class of the element (a function of the render props). @default "rv-CalendarCell" */
  class?: ClassNameOrFunction<CalendarCellRenderProps>;
  /** The date to render in the cell. */
  date: CalendarDate;
  ref?: RefValue<HTMLTableCellElement>;
}

/** A calendar cell displays a date cell within a calendar grid which can be selected by the user. */
export function CalendarCell(props: CalendarCellProps) {
  const state = calendarStateOf();
  const grid = useContext(InternalCalendarGridContext);
  const date = props.date;
  const cellRef = props.ref;
  const key = cellKey(date);
  // The cell is re-created when its grid's first date moves: the month is read once.
  const monthStart = untrack(() => readDate(state, grid ? grid.startDate() : visibleStartKey(state)));
  const isOutsideMonth = isOutsideMonthOf(state, date, monthStart);
  const cell = calendarCellProps({ date: key, isOutsideMonth }, state);
  const formattedDate = untrack(cell.formattedDate);
  const values: CalendarCellRenderProps = {
    date: () => readDate(state, key),
    formattedDate,
    isHovered: cell.isHovered,
    isPressed: cell.isPressed,
    isSelected: cell.isSelected,
    isSelectionStart: cell.isSelectionStart,
    isSelectionEnd: cell.isSelectionEnd,
    isFocused: cell.isFocused,
    isFocusVisible: cell.isFocusVisible,
    isDisabled: cell.isDisabled,
    isOutsideVisibleRange: cell.isOutsideVisibleRange,
    isOutsideMonth: () => isOutsideMonth,
    isUnavailable: cell.isUnavailable,
    isInvalid: cell.isInvalid,
    isToday: cell.isToday,
  };
  // Live props (P5): class / style / children through a live view when one is live (`renderPropsOf`). On a resumed page
  // the view's forwards narrow to those keys when the cell's props do not serialize (its `date`, a CalendarDate).
  const rp = renderPropsOf(props, { values, defaultChildren: formattedDate, defaultClassName: "rv-CalendarCell" });
  const dom = globalDOMProps(props, ["style", "render"]);
  // `tabindex` keyed as rendered: on a resumed page the spread binding diffs the server's attribute
  // names against the object's keys, so a `tabIndex` key drops `tabindex` for a moment on activation —
  // Chrome then blurs the focused cell (a range calendar commits on that blur).
  const { tabIndex: tabindex, ...buttonAttrs } = cell.buttonProps;
  const button = { ...buttonAttrs, tabindex };
  const { cellProps } = cell;
  if (props.render) {
    const attrs = { ...dom, ...button, class: () => rp.class(), style: () => rp.style(), children: () => rp.children() };
    return (
      <td {...cellProps} ref={cellRef as never}>
        {props.render(attrs as never, values)}
      </td>
    );
  }
  return (
    <td {...cellProps} ref={cellRef as never}>
      <div {...dom} {...button} class={rp.class()} style={rp.style()}>
        {rp.children()}
      </div>
    </td>
  );
}

// CalendarHeading / month & year pickers --------------------------------------------------------

export interface CalendarHeadingProps extends HeadingProps {
  /** An offset from the beginning of the visible date range (multi-month calendars). */
  offset?: DateDuration;
  /** The format of the heading. */
  format?: CalendarHeadingFormatOptions;
}

/** The heading of a calendar month (RAC CalendarHeading: the visible month at `offset`). */
export function CalendarHeading(props: CalendarHeadingProps) {
  const { offset, format, class: className = "rv-CalendarHeading", ...headingProps } = props;
  const state = calendarStateOf();
  const options = { offset, format };
  return <Heading {...headingProps} class={className} children={() => calendarHeadingProps(options, state)} />;
}

export interface CalendarMonthPickerProps extends AriaCalendarMonthPickerProps {
  /** Renders the picker (e.g. a Select) from `{ "aria-label", value(), onChange, items() }`. */
  children: (renderProps: CalendarPickerAria) => Content;
}

/** Provides the months of the focused year to a picker (e.g. a Select). */
export function CalendarMonthPicker(props: CalendarMonthPickerProps): Content {
  const { children, ...options } = props;
  return children(calendarMonthPickerProps(options, calendarStateOf()));
}

export interface CalendarYearPickerProps extends AriaCalendarYearPickerProps {
  /** Renders the picker (e.g. a Select) from `{ "aria-label", value(), onChange, items() }`. */
  children: (renderProps: CalendarPickerAria) => Content;
}

/** Provides the years around the focused date to a picker (e.g. a Select). */
export function CalendarYearPicker(props: CalendarYearPickerProps): Content {
  const { children, ...options } = props;
  return children(calendarYearPickerProps(options, calendarStateOf()));
}

export type { CalendarDate, Signal };
