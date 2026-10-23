// Ported from @malva-ui/scheduler (src/lib/scheduler/scheduler.ts + .html: root host, view switch, drag hint, two
// polite live regions), MIT, © 2026 Malva UI.
// Rivet:
// - `<mlv-scheduler>` inputs / models / outputs → props (live unless listed as read once in `CLAUDE.md`): the root
//   turns live props into accessors (`liveOptions`), builds the state (`createSchedulerState`) and memoizes the
//   derived values in its own `computed`s (resumable), handed to the views through `SchedulerContext` (`rv-scheduler`).
// - Server output is final (range, days, layout, labels); the month view boots nothing.
// - External drop (T7, malva `externalDrop` over SortableJS groups): with `onExternalDrop` the body is a cdk
//   `DropList` (`id = dropGroup`, `sortingDisabled`, `enterPredicate` = editable) — a hit area: connected external
//   items drop on it, `drag.ts` resolves the cell under the drop point; without it the body is a plain div (0 cost).
// - Toolbar (T9): the default headless `SchedulerToolbar` (`toolbar.tsx`) unless `toolbar={false}`; `renderHeader(api)`
//   replaces it. Context menus (`menus.tsx`): one panel, rendered only with `renderSlotMenu` / `renderEventMenu`.
// - Week and day share one `SchedulerTimeGrid` (the `Show` fallback): a week ↔ day switch keeps the grid and re-applies
//   its initial scroll (malva rule).
import { computed, provide, signal, untrack, type Signal } from "@rivetjs/reactivity";
import { Show, type DOMValue } from "@rivetjs/runtime/dom";
import { splitProps } from "@rivetjs/runtime/props";
import { visuallyHidden } from "../a11y/index.ts";
import { useLocale } from "../i18n/index.ts";
import { createId } from "../utils/id.ts";
import { liveOptions } from "../utils/live.tsx";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import { SchedulerContext, type SchedulerContextValue, type SchedulerRenderEvent } from "./context.tsx";
import { SchedulerToolbar, type SchedulerHeaderApi, type SchedulerRenderHeader } from "./toolbar.tsx";
import {
  SchedulerMenu,
  openSchedulerMenu,
  slotMenuRange,
  type SchedulerMenuOpen,
  type SchedulerRenderEventMenu,
  type SchedulerRenderSlotMenu,
} from "./menus.tsx";
import { SchedulerMonth } from "./month.tsx";
import { SchedulerTimeGrid } from "./time-grid.tsx";
import { DropList } from "../drag-drop/drop-list.tsx";
import { schedulerExternalDrop } from "./behaviour.ts";
import { addCalendarMonths, dayOf, dayOfWeek, fromLayout, todayDay } from "./dates.ts";
import { schedulerString } from "./intl.ts";
import { hiddenWeekdays, nextVisibleDate, type SchedulerMoreEvent } from "./layout.ts";
import { slotCount } from "./time.ts";
import {
  commitChange,
  commitSelection,
  createSchedulerState,
  dateLabel,
  dateTimeLabel,
  schedulerAnnounce,
  schedulerDateOf,
  schedulerGoTo,
  schedulerHiddenDays,
  schedulerSelectionBounds,
  schedulerSelectionRange,
  schedulerNext,
  schedulerPrevious,
  schedulerSetView,
  schedulerTitle,
  schedulerToday,
  schedulerVisibleRange,
  schedulerSlotDuration,
  schedulerSnap,
  schedulerTimeWindow,
  schedulerAnchorDay,
  schedulerDays,
  schedulerEditable,
  schedulerLocale,
  schedulerNormalizedEvents,
  schedulerRowLength,
  schedulerSelectable,
  schedulerShowsCurrentTime,
  schedulerStringTable,
  schedulerTimeZone,
  schedulerVisibleLanes,
  schedulerWeekendDays,
  schedulerWithPreview,
  type SchedulerState,
  type SchedulerStateProps,
} from "./state.ts";

export * from "./layout-index.ts";
export * from "./state.ts";
export * from "./intl.ts";
export {
  SchedulerContext,
  type SchedulerContextValue,
  type SchedulerEventRenderState,
  type SchedulerRenderEvent,
  type SchedulerSlotPosition,
} from "./context.tsx";
export { SchedulerToolbar, type SchedulerHeaderApi, type SchedulerRenderHeader, type SchedulerToolbarLabels } from "./toolbar.tsx";
export {
  SchedulerMenu,
  type SchedulerEventMenuContext,
  type SchedulerMenuOpen,
  type SchedulerRenderEventMenu,
  type SchedulerRenderSlotMenu,
  type SchedulerSlotMenuContext,
} from "./menus.tsx";
export { SchedulerMonth, type SchedulerMonthCell } from "./month.tsx";
export { SchedulerTimeGrid, type SchedulerTimeColumn, type SchedulerTimeSlot } from "./time-grid.tsx";
export { scrollOffsetFor } from "./time-grid-client.tsx";
export { SchedulerEventChip, type SchedulerEventChipProps, type SchedulerChipSegment } from "./event.tsx";

/** `Scheduler` props: state props (live unless marked) + rendering + DOM. */
export interface SchedulerProps<T = unknown> extends SchedulerStateProps<T>, Omit<GlobalDOMAttributes<HTMLDivElement>, "style"> {
  /** Chip content (default: time + title). Read once at mount (render functions are read once; their output is reactive). */
  renderEvent?: SchedulerRenderEvent<T>;
  /** Replaces the default toolbar (malva `MlvSchedulerHeaderDef`); receives the header api. Read once at mount. */
  renderHeader?: SchedulerRenderHeader;
  /** `false` hides the default toolbar (no effect with `renderHeader`). Default `true`. */
  toolbar?: boolean;
  /**
   * Items of the context menu over an empty month cell, all-day cell or time slot (right-click, ContextMenu key,
   * `Shift+F10`): cdk `MenuItem`s. `range` = the cell's day / the slot, or the pending keyboard selection the cell lies
   * in (`selection: true`, cleared when the menu closes). Without it the native menu is left alone. Read once at mount.
   */
  renderSlotMenu?: SchedulerRenderSlotMenu;
  /** Items of the context menu over an event chip (same rules as `renderSlotMenu`). Read once at mount. */
  renderEventMenu?: SchedulerRenderEventMenu<T>;
  /** A month cell's `+N more` opened its panel (malva `moreClick`): the day and its hidden events. Read once at mount. */
  onMoreAction?: (event: SchedulerMoreEvent<T>) => void;
  /**
   * Id of the scheduler's hit-area `DropList` (rendered only with `onExternalDrop`): external cdk `DropList`s list it
   * in `connectedTo` (or share a `DropListGroup`). Default `"rv-scheduler"`. Read once at mount.
   */
  dropGroup?: string;
  /** Receives the scheduler state (free functions `schedulerNext(state)` …). Read once at mount. */
  stateRef?: Signal<SchedulerState<T> | null> | ((state: SchedulerState<T>) => void);
  /** Root id. Read once at mount. */
  id?: string;
  /** Accessible name of the root group. Default: the `scheduler` string. */
  "aria-label"?: string;
  /** Root class. Default `rv-Scheduler`. */
  class?: string;
  style?: Record<string, string | number | undefined>;
}

/** Keys turned into accessors when live (options + `aria-label` / `class` / `style` read in bindings). */
const OPTION_KEYS = [
  "timeZone",
  "locale",
  "firstDayOfWeek",
  "hiddenDays",
  "weekendDays",
  "minTime",
  "maxTime",
  "slotDuration",
  "snapDuration",
  "defaultEventDuration",
  "businessHours",
  "visibleLanes",
  "isReadOnly",
  "allowsRangeSelection",
  "showCurrentTime",
  "scrollToCurrentTime",
  "showWeekNumbers",
  "strings",
] as const;
const CONTROLLED_KEYS = ["events", "view", "date"] as const;
/**
 * Everything `createSchedulerState` keeps: options, controlled values and state handlers — never the
 * whole props bag (`renderEvent`, `stateRef`, DOM props would serialize with the state; one non-serializable value
 * there would break the scheduler's resume).
 */
const STATE_KEYS = [
  ...OPTION_KEYS,
  ...CONTROLLED_KEYS,
  "defaultEvents",
  "onEventsChange",
  "defaultView",
  "onViewChange",
  "defaultDate",
  "onDateChange",
  "canMove",
  "canResize",
  "onEventMove",
  "onEventResize",
  "onVisibleRangeChange",
  "onRangeSelect",
  "onExternalDrop",
  "onEventAction",
  "onEventDoubleClick",
  "onEventContextMenu",
  "onEventDelete",
  "onSlotAction",
  "onSlotDoubleClick",
  "onSlotContextMenu",
] as const;
const OWNED = [
  ...STATE_KEYS,
  "dropGroup",
  "renderEvent",
  "renderHeader",
  "renderSlotMenu",
  "renderEventMenu",
  "toolbar",
  "onMoreAction",
  "stateRef",
  "id",
  "aria-label",
  "class",
  "style",
] as const;

/**
 * Month / week / day scheduler (agenda): lane-packed month grid with `+N more` panels, time grid with clustered
 * columns, pointer + keyboard move / resize / range selection (T6–T8). Headless: `rv-Scheduler*` classes,
 * `data-*` state, geometry as inline custom properties.
 */
export function Scheduler<T = unknown>(props: SchedulerProps<T>): DOMValue {
  const dom = globalDOMProps(props, OWNED);
  const [view] = splitProps(props as unknown as Record<string, unknown>, ["aria-label", "class", "style", "toolbar"]) as unknown as [
    Pick<SchedulerProps<T>, "aria-label" | "class" | "style" | "toolbar">,
  ];
  const env = useLocale();
  const options = liveOptions(props, OPTION_KEYS as never, CONTROLLED_KEYS as never) as SchedulerProps<T>;
  const input = untrack(() => {
    const picked: Record<string, unknown> = {};
    for (const key of STATE_KEYS) if (options[key] !== undefined) picked[key] = options[key];
    return picked as SchedulerStateProps<T>;
  });
  const localeOption = input.locale;
  const state = createSchedulerState<T>({
    ...input,
    // The ambient locale (I18nProvider) when no `locale` is given.
    locale: () => readValue(localeOption) ?? env.locale,
  });
  const stateRef = props.stateRef;
  if (stateRef)
    untrack(() =>
      typeof (stateRef as Signal<unknown>).set === "function"
        ? (stateRef as Signal<SchedulerState<T>>).set(state)
        : (stateRef as (s: SchedulerState<T>) => void)(state),
    );
  const renderEvent = props.renderEvent;
  const renderHeader = props.renderHeader;
  const renderSlotMenu = props.renderSlotMenu;
  const renderEventMenu = props.renderEventMenu;
  // The open context menu (browser only: element / event values; `null` on the server).
  const menu = signal<SchedulerMenuOpen<T> | null>(null);
  const onMoreAction = props.onMoreAction;
  const id = props.id;
  const external = !!props.onExternalDrop;
  const dropGroup = props.dropGroup ?? "rv-scheduler";

  const timeZone = computed(() => schedulerTimeZone(state));
  const locale = computed(() => schedulerLocale(state));
  const strings = computed(() => schedulerStringTable(state));
  const days = computed(() => schedulerDays(state));
  const rowLength = computed(() => schedulerRowLength(state));
  const anchorDay = computed(() => schedulerAnchorDay(state));
  const today = computed(() => (schedulerShowsCurrentTime(state) ? todayDay(timeZone()) : null));
  const weekend = computed(() => schedulerWeekendDays(state));
  const normalized = computed(() => schedulerNormalizedEvents(state));
  const events = computed(() => schedulerWithPreview(state, normalized()));
  const visibleLanes = computed(() => schedulerVisibleLanes(state));
  const t = (key: Parameters<SchedulerContextValue<T>["t"]>[0], vars?: Record<string, string | number | boolean>) =>
    schedulerString(strings(), key, vars, locale());

  const timeAxis = () => {
    const { min, max } = schedulerTimeWindow(state);
    const slot = schedulerSlotDuration(state);
    return { min, max, slot, snap: schedulerSnap(state), last: min + (slotCount(min, max, slot) - 1) * slot };
  };
  const ctx: SchedulerContextValue<T> = {
    state,
    view: () => state.view.value(),
    locale: () => locale(),
    timeZone: () => timeZone(),
    days: () => days(),
    rowLength: () => rowLength(),
    anchorDay: () => anchorDay(),
    today: () => today(),
    weekend: () => weekend(),
    events: () => events(),
    visibleLanes: () => visibleLanes(),
    editable: () => schedulerEditable(state),
    selectable: () => schedulerSelectable(state),
    showWeekNumbers: () => !!readValue(state.options.showWeekNumbers),
    dateOf: (day) => fromLayout(day, 0, state.date.value(), timeZone(), true),
    t: (key, vars) => t(key, vars),
    dragHintId: createId(),
    popoverId: createId(),
    renderEvent,
    // Keyboard / click actions (T8): the delegated handlers (`keys*.ts`, leaf chunks) call these, so the state / intl /
    // layout code loads only when a key actually changes something.
    normalized: (id) => normalized().find((candidate) => candidate.event.id === id) ?? null,
    commit: (kind, event, next) => commitChange(state, { kind, normalized: event, next, source: "keyboard" }),
    goTo: (day) => schedulerGoTo(state, fromLayout(day, 0, untrack(state.date.value), timeZone(), true)),
    stepDay: (day, direction) => nextVisibleDate(day, direction, schedulerHiddenDays(state)),
    pageMonth: (day, direction) => {
      // `addCalendarMonths` keeps the day of month, not the weekday: a landing day on a hidden column skips on to the
      // nearest rendered day in the same direction (through `hiddenWeekdays`: an all-seven `hiddenDays` hides nothing).
      const hidden = schedulerHiddenDays(state);
      const target = addCalendarMonths(day, direction);
      return hiddenWeekdays(hidden).has(dayOfWeek(target)) ? nextVisibleDate(target, direction, hidden) : target;
    },
    slotDate: (day, minutes) => schedulerDateOf(state, day * 1440 + (minutes ?? 0), minutes === null),
    axis: () => timeAxis(),
    announceSelection: () =>
      untrack(() => {
        const bounds = schedulerSelectionBounds(state.selection(), days());
        if (!bounds) return;
        const range = schedulerSelectionRange(state, bounds);
        const at = locale();
        // All-day names the INCLUSIVE last day ("Mar 3 to Mar 5"); timed names the exclusive end a following `Enter` emits.
        const start = range.allDay ? dateLabel(dayOf(range.start), at) : dateTimeLabel(range.start, at);
        const end = range.allDay ? dateLabel(dayOf(range.end) - 1, at) : dateTimeLabel(range.end, at);
        schedulerAnnounce(state, t("selectionHint", { start, end }));
      }),
    commitSelection: () => commitSelection(state, "keyboard"),
    eventInteraction: (kind, interaction) => {
      // The menu opens first, so `onEventContextMenu` sees the event already prevented (malva order).
      if (kind === "contextmenu" && renderEventMenu)
        untrack(() =>
          openSchedulerMenu(
            menu,
            {
              kind: "event",
              event: interaction.event,
              range: null,
              selection: false,
              label: t("eventMenu", { title: interaction.event.title }),
              view: state.view.value(),
              anchor: interaction.element,
            },
            interaction.nativeEvent,
          ),
        );
      (kind === "click" ? state.onEventAction : kind === "dblclick" ? state.onEventDoubleClick : state.onEventContextMenu)?.(interaction);
    },
    eventDelete: (interaction) => state.onEventDelete?.(interaction),
    slotInteraction: (kind, slot, at) => {
      if (kind === "contextmenu" && renderSlotMenu)
        untrack(() => {
          const bounds = at.inSelection ? schedulerSelectionBounds(state.selection(), days()) : null;
          const wall = bounds ? schedulerSelectionRange(state, bounds) : slotMenuRange(at.day, at.minutes, timeAxis());
          const lang = locale();
          openSchedulerMenu(
            menu,
            {
              kind: "slot",
              event: null,
              range: { start: schedulerDateOf(state, wall.start, wall.allDay), end: schedulerDateOf(state, wall.end, wall.allDay), allDay: wall.allDay },
              selection: !!bounds,
              label: t("slotMenu", { start: wall.allDay ? dateLabel(dayOf(wall.start), lang) : dateTimeLabel(wall.start, lang) }),
              view: state.view.value(),
              anchor: slot.element,
            },
            slot.nativeEvent,
          );
        });
      (kind === "click" ? state.onSlotAction : kind === "dblclick" ? state.onSlotDoubleClick : state.onSlotContextMenu)?.(slot);
    },
    hasEventMenu: !!renderEventMenu,
    hasSlotMenu: !!renderSlotMenu,
    onMoreAction,
  };
  const dragHintId = ctx.dragHintId;
  const api: SchedulerHeaderApi = {
    title: () => schedulerTitle(state),
    view: () => state.view.value(),
    range: () => schedulerVisibleRange(state),
    next: () => schedulerNext(state),
    previous: () => schedulerPrevious(state),
    today: () => schedulerToday(state),
    setView: (next) => schedulerSetView(state, next),
    goTo: (date) => schedulerGoTo(state, date),
  };
  const hasMenus = !!(renderSlotMenu || renderEventMenu);

  return (
    <div
      {...dom}
      id={id}
      role="group"
      class={view.class ?? "rv-Scheduler"}
      style={view.style}
      aria-label={view["aria-label"] ?? t("scheduler")}
      data-rv-scheduler=""
      data-view={state.view.value()}
      data-dragging={state.dragging() ? "true" : undefined}
    >
      {renderHeader ? (
        renderHeader(api)
      ) : (
        <Show when={() => view.toolbar !== false}>
          {() => (
            <SchedulerToolbar
              api={api}
              labels={{
                previous: () => t(`previous.${state.view.value()}`),
                next: () => t(`next.${state.view.value()}`),
                today: () => t("today"),
                viewSwitch: () => t("viewSwitch"),
                month: () => t("month"),
                week: () => t("week"),
                day: () => t("day"),
              }}
            />
          )}
        </Show>
      )}
      {external ? (
        <DropList
          id={dropGroup}
          class="rv-Scheduler-body"
          sortingDisabled
          enterPredicate={() => schedulerEditable(state)}
          onDropped={(drop) => schedulerExternalDrop(drop, state)}
        >
          <Show when={() => state.view.value() === "month"} fallback={() => provide(SchedulerContext, ctx, () => <SchedulerTimeGrid />)}>
            {() => provide(SchedulerContext, ctx, () => <SchedulerMonth />)}
          </Show>
        </DropList>
      ) : (
        <div class="rv-Scheduler-body">
          <Show when={() => state.view.value() === "month"} fallback={() => provide(SchedulerContext, ctx, () => <SchedulerTimeGrid />)}>
            {() => provide(SchedulerContext, ctx, () => <SchedulerMonth />)}
          </Show>
        </div>
      )}
      <span id={dragHintId} style={visuallyHidden}>
        {t("dragHint")}
      </span>
      <span class="rv-Scheduler-status" role="status" aria-live="polite" aria-atomic="true" style={visuallyHidden}>
        {state.announcement()[0]}
      </span>
      <span class="rv-Scheduler-status" role="status" aria-live="polite" aria-atomic="true" style={visuallyHidden}>
        {state.announcement()[1]}
      </span>
      {hasMenus ? (
        <SchedulerMenu
          menu={menu}
          close={() =>
            untrack(() => {
              const open = menu();
              if (!open) return;
              menu.set(null);
              // The pending selection this panel took is released with it (malva `selectionRelease`).
              if (open.holds) state.selection.set(null);
            })
          }
          renderSlotMenu={renderSlotMenu}
          renderEventMenu={renderEventMenu}
        />
      ) : null}
    </div>
  );
}

const readValue = <V,>(value: V | (() => V)): V => (typeof value === "function" ? (value as () => V)() : value);
