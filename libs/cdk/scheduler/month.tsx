// Ported from @malva-ui/scheduler (src/lib/month/scheduler-month.ts + .html: rows / cells model, labels, `+N more`
// overflow + toggling popover, roving tab stop default), MIT, © 2026 Malva UI.
// Rivet:
// - lanes per row = `visibleLanes` (live prop, server-exact) instead of malva's row-height measurement (no layout read,
//   spec F4 / R3): the server HTML is final (chips, `+N more` counts, geometry custom properties).
// - roving tab stop: the focused DAY (region signal, a day number) instead of a `linkedSignal` index — it falls back
//   to the default (today, else the 1st of the anchor month, else the first cell) whenever the range moves.
// - popover = cdk `Popover` (standalone, `triggerRef` = the open day's `+N more` button, non-modal, no underlay: drag
//   hit-testing reaches the grid); the panel is derived from the day index, never a snapshot (malva rule).
// - Rivet additions: `showWeekNumbers` (row headers, ISO weeks), `data-weekend` (Pro Weekend Highlighting).
// - Chip drag / resize: delegated `schedulerPress` on the grid + the panel (T6); the panel stays mounted but hidden
//   (`visibility: hidden`) while a gesture runs, so the grid under it is the drop target (malva rule).
// - Range selection (T7): the pointerdown of `schedulerPress` hands empty-cell presses to the lazy `select.ts`; cells
//   paint `state.selection` (`aria-selected` / `data-selected`).
// - Keyboard, clicks, focus hand-off (T8): delegated on the grid + the panel (`keys-month.ts` / `keys.ts`, leaf
//   chunks); `data-rk` holds the navigation keys while a cold handler chunk loads.
import { schedulerPart } from "./context.tsx";
import { computed, signal, useContext } from "@rivetjs/reactivity";
import { For, ref as elementRef, type DOMValue } from "@rivetjs/runtime/dom";
import { Popover } from "../popover/index.tsx";
import { SchedulerContext } from "./context.tsx";
import { SchedulerEventChip } from "./event.tsx";
import { closeMorePanel, moreButtonOf, monthFocusIn, monthMoreClick, schedulerPress, type MonthBehaviourContext } from "./behaviour.ts";
import { SCHEDULER_KEYS, chipFocusIn, chipFocusOut, schedulerInteraction } from "./keys.ts";
import { monthKeyDown } from "./keys-month.ts";
import { civilFromDay, dayFromCivil, formatDay } from "./dates.ts";
import type { SchedulerEvent, SchedulerLaneSegment, SchedulerRowSegment } from "./layout.ts";
import { dateLabel, isCellSelected, isoWeekNumber, schedulerMonthLayout, schedulerSelectionBounds, type SchedulerMonthRow } from "./state.ts";

/** One rendered day cell (malva `MlvSchedulerMonthCell`, day numbers instead of dates). */
export interface SchedulerMonthCell<T = unknown> {
  readonly dayIndex: number;
  readonly day: number;
  /** Localized day of month (decorative: the cell carries the name). */
  readonly dayNumber: string;
  /** Accessible name: the full date, `", today"` suffixed when it is. */
  readonly label: string;
  /** The full date without the today suffix (`+N more` names, panel title). */
  readonly dateLabel: string;
  readonly outside: boolean;
  readonly today: boolean;
  readonly weekend: boolean;
  /** Visible segments starting in this cell (spanning bars live in their start cell). */
  readonly segments: readonly SchedulerLaneSegment<T>[];
  /** Hidden events of this day. */
  readonly hidden: readonly SchedulerEvent<T>[];
  /** `"+3 more"`, empty when nothing overflows. */
  readonly moreText: string;
  /** Accessible name of the `+N more` button; starts with `moreText` (WCAG 2.5.3). */
  readonly moreLabel: string;
}

const keep = (previous: unknown, next: unknown): boolean => previous === next || next == null;
const NO_SEGMENTS: readonly SchedulerLaneSegment<any>[] = Object.freeze([]);
const sameNumbers = (a: readonly number[], b: readonly number[]): boolean => a.length === b.length && a.every((v, i) => v === b[i]);

/** Month view (internal part of `Scheduler`). */
export function SchedulerMonth<T>(): DOMValue {
  const ctx = useContext(SchedulerContext)!;
  const state = ctx.state;
  const popoverId = ctx.popoverId;
  const onMoreAction = ctx.onMoreAction;
  const grid = elementRef<HTMLDivElement>();
  const focusDay = signal<number | null>(null);

  const rows = computed((): SchedulerMonthRow<T>[] => schedulerMonthLayout(ctx.events() as never, ctx.days(), ctx.rowLength(), ctx.visibleLanes()));
  const selection = computed(() => schedulerSelectionBounds(state.selection(), ctx.days()));
  // Rows own these rendered dates. Adopted numeric-index rows otherwise retain the old cells on a date change.
  // Event edits and drag previews leave these keys unchanged.
  const rowKeys = computed(
    () => {
      const days = ctx.days();
      return rows().map((row) => `${row.index}/${days.slice(row.startIndex, row.endIndex + 1).join(",")}`);
    },
    { equals: (a, b) => a.length === b.length && a.every((key, i) => key === b[i]) },
  );
  const cells = computed((): SchedulerMonthCell<T>[] => {
    const days = ctx.days();
    const locale = ctx.locale();
    const today = ctx.today();
    const weekend = ctx.weekend();
    const anchorMonth = civilFromDay(ctx.anchorDay())[1];
    const out: SchedulerMonthCell<T>[] = [];
    for (const row of rows()) {
      for (let dayIndex = row.startIndex; dayIndex <= row.endIndex; dayIndex++) {
        const day = days[dayIndex]!;
        const plain = dateLabel(day, locale);
        const isToday = today === day;
        const hidden = (row.layout.hiddenByDay.get(dayIndex) ?? []).map((segment) => segment.normalized.event);
        const moreText = hidden.length ? ctx.t("moreEvents", { count: hidden.length }) : "";
        const segments = row.layout.visible.filter((segment) => segment.startIndex === dayIndex);
        out.push({
          dayIndex,
          day,
          dayNumber: formatDay(day, locale, { day: "numeric" }),
          label: isToday ? ctx.t("dayLabelToday", { date: plain }) : plain,
          dateLabel: plain,
          outside: civilFromDay(day)[1] !== anchorMonth,
          today: isToday,
          weekend: weekend.includes((day + 4) % 7),
          segments: segments.length ? segments : NO_SEGMENTS,
          hidden,
          moreText,
          moreLabel: hidden.length ? moreText + ", " + ctx.t("moreEventsLabel", { count: hidden.length, date: plain }) : "",
        });
      }
    }
    return out;
  });
  // Today when visible, else the first day of the anchor month, else the first cell (malva `_defaultFocus`).
  const tabStop = computed(() => {
    const days = ctx.days();
    const focused = focusDay();
    if (focused !== null) {
      const index = days.indexOf(focused);
      if (index >= 0) return index;
    }
    const today = ctx.today();
    const todayIndex = today === null ? -1 : days.indexOf(today);
    if (todayIndex >= 0) return todayIndex;
    const [year, month] = civilFromDay(ctx.anchorDay());
    const first = dayFromCivil(year, month, 1);
    return Math.max(
      0,
      days.findIndex((day) => day >= first),
    );
  });
  const weekdays = computed(() => {
    const locale = ctx.locale();
    const weekend = ctx.weekend();
    return ctx
      .days()
      .slice(0, ctx.rowLength())
      .map((day) => ({ name: formatDay(day, locale, { weekday: "short" }), weekend: weekend.includes((day + 4) % 7) }));
  });
  const gridLabel = () => ctx.t("gridLabel.month", { period: formatDay(ctx.anchorDay(), ctx.locale(), { month: "long", year: "numeric" }) });
  const openDay = () => state.popoverDay();
  // Every segment touching the open day, visible or not (the panel list), re-derived from the live layout.
  const panel = computed(() => {
    const dayIndex = openDay();
    if (dayIndex === null) return null;
    const cell = cells()[dayIndex];
    const row = rows()[Math.floor(dayIndex / ctx.rowLength())];
    if (!cell || !row || cell.hidden.length === 0) return null;
    const all = row.segments.filter((segment) => segment.startIndex <= dayIndex && segment.endIndex >= dayIndex && !segment.normalized.ghost);
    return { dayIndex, label: cell.dateLabel, all };
  });
  const panelKeys = computed(() => panel()?.all.map((segment) => segment.key) ?? [], {
    equals: (a, b) => a.length === b.length && a.every((k, i) => k === b[i]),
  });

  const mctx: MonthBehaviourContext<T> = {
    state,
    popoverId,
    cell: (dayIndex) => cells()[dayIndex] ?? null,
    moreDate: (day) => ctx.dateOf(day),
    onMoreAction: (event) => onMoreAction?.(event),
    focusDay,
  };

  return (
    <div
      class="rv-SchedulerMonth"
      style={{
        "--rv-scheduler-row-length": String(ctx.rowLength()),
        "--rv-scheduler-rows": String(rowKeys().length),
        "--rv-scheduler-visible-lanes": String(ctx.visibleLanes()),
      }}
      data-week-numbers={ctx.showWeekNumbers() ? "true" : undefined}
    >
      <div
        ref={grid}
        class={schedulerPart("rv-SchedulerMonth-grid", ctx.classNames?.(), "grid")}
        role="grid"
        aria-label={gridLabel()}
        aria-multiselectable={ctx.selectable() ? "true" : undefined}
        style={{ "user-select": "none", "-webkit-user-select": "none" }}
        data-rk={SCHEDULER_KEYS}
        onKeyDown={(e) => monthKeyDown(e, ctx)}
        onClick={(e) => {
          monthMoreClick(e, mctx);
          schedulerInteraction("click", e, ctx);
        }}
        onDblClick={(e) => schedulerInteraction("dblclick", e, ctx)}
        onContextMenu={(e) => schedulerInteraction("contextmenu", e, ctx)}
        onFocusIn={(e) => {
          monthFocusIn(e, mctx);
          chipFocusIn(e, ctx);
        }}
        onFocusOut={(e) => chipFocusOut(e, ctx)}
        onMouseDown={(e) => schedulerPress(e, state)}
        onTouchStart={(e) => schedulerPress(e, state)}
        onPointerDown={(e) => schedulerPress(e, state)}
      >
        <div class="rv-SchedulerMonth-weekdays" role="row">
          {ctx.showWeekNumbers() ? (
            <div class={schedulerPart("rv-SchedulerMonth-weekday rv-SchedulerMonth-week-header", ctx.classNames?.(), "header")} role="columnheader">
              {ctx.t("weekNumber", { week: "" }).trim()}
            </div>
          ) : null}
          <For each={weekdays} by={(_w, i) => i}>
            {(weekday) => (
              <div
                class={schedulerPart("rv-SchedulerMonth-weekday", ctx.classNames?.(), "header")}
                role="columnheader"
                data-weekend={weekday().weekend ? "true" : undefined}
              >
                {weekday().name}
              </div>
            )}
          </For>
        </div>
        <div class="rv-SchedulerMonth-rows" role="rowgroup">
          <For each={rowKeys} by={(k) => k}>
            {(rowKey) => {
              const rowIndex = Number(rowKey().split("/")[0]);
              const dayIndices = computed(
                () => {
                  const row = rows()[rowIndex];
                  const out: number[] = [];
                  if (row) for (let i = row.startIndex; i <= row.endIndex; i++) out.push(i);
                  return out;
                },
                { equals: sameNumbers },
              );
              const weekNumber = () => {
                const row = rows()[rowIndex];
                return row ? isoWeekNumber(ctx.days()[row.startIndex]!) : 0;
              };
              return (
                <div class="rv-SchedulerMonth-row" role="row">
                  {ctx.showWeekNumbers() ? (
                    <div class="rv-SchedulerMonth-week-number" role="rowheader" aria-label={ctx.t("weekNumber", { week: weekNumber() })}>
                      {String(weekNumber())}
                    </div>
                  ) : null}
                  <For each={dayIndices} by={(i) => i}>
                    {(indexOf) => {
                      const dayIndex = indexOf();
                      const cell = computed(() => cells()[dayIndex]!, { equals: keep });
                      const segments = () => cell().segments;
                      return (
                        <div
                          class={schedulerPart("rv-SchedulerMonth-cell", ctx.classNames?.(), "cell")}
                          role="gridcell"
                          aria-label={cell().label}
                          tabIndex={tabStop() === dayIndex ? 0 : -1}
                          data-rv-day-index={String(dayIndex)}
                          data-rv-minutes="all-day"
                          data-outside={cell().outside ? "true" : undefined}
                          data-today={cell().today ? "true" : undefined}
                          data-weekend={cell().weekend ? "true" : undefined}
                          aria-selected={isCellSelected(selection(), dayIndex, null) ? "true" : undefined}
                          data-selected={isCellSelected(selection(), dayIndex, null) ? "true" : undefined}
                        >
                          <span class="rv-SchedulerMonth-day-number" aria-hidden="true">
                            {cell().dayNumber}
                          </span>
                          <div class="rv-SchedulerMonth-lanes">
                            <For each={segments} by={(segment) => segment.key}>
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
                            {cell().hidden.length ? (
                              <button
                                type="button"
                                class={schedulerPart("rv-SchedulerMonth-more", ctx.classNames?.(), "more")}
                                data-rv-more=""
                                tabIndex={-1}
                                aria-haspopup="dialog"
                                aria-label={cell().moreLabel}
                                aria-expanded={openDay() === dayIndex ? "true" : "false"}
                                aria-controls={openDay() === dayIndex && panel() ? popoverId : undefined}
                                style={{ "--rv-scheduler-lane": String(ctx.visibleLanes()) }}
                              >
                                {cell().moreText}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      );
                    }}
                  </For>
                </div>
              );
            }}
          </For>
        </div>
      </div>
      <Popover
        triggerRef={() => {
          const dayIndex = openDay();
          const element = grid();
          return dayIndex === null || !element ? null : moreButtonOf(element, dayIndex);
        }}
        isOpen={() => panel() !== null}
        onOpenChange={(open) => {
          if (!open) closeMorePanel(mctx, grid());
        }}
        isNonModal
        placement="bottom start"
        shouldCloseOnInteractOutside={(element) => !element.closest("[data-rv-more]")}
        aria-label={panel()?.label}
        class={schedulerPart("rv-SchedulerMonth-popover-overlay", ctx.classNames?.(), "moreOverlay")}
      >
        {() => (
          <div
            class={schedulerPart("rv-SchedulerMonth-popover", ctx.classNames?.(), "morePanel")}
            role="group"
            id={popoverId}
            aria-label={panel()?.label}
            dir={grid() ? (getComputedStyle(grid()!).direction as "ltr" | "rtl") : undefined}
            tabIndex={-1}
            data-dragging={state.dragging() ? "true" : undefined}
            style={{ visibility: state.dragging() ? "hidden" : undefined }}
            data-rk={SCHEDULER_KEYS}
            onKeyDown={(e) => monthKeyDown(e, ctx)}
            onClick={(e) => schedulerInteraction("click", e, ctx)}
            onDblClick={(e) => schedulerInteraction("dblclick", e, ctx)}
            onContextMenu={(e) => schedulerInteraction("contextmenu", e, ctx)}
            onFocusIn={(e) => chipFocusIn(e, ctx)}
            onFocusOut={(e) => chipFocusOut(e, ctx)}
            onMouseDown={(e) => schedulerPress(e, state)}
            onTouchStart={(e) => schedulerPress(e, state)}
          >
            <div class="rv-SchedulerMonth-popover-title">{panel()?.label}</div>
            <For each={panelKeys} by={(k) => k}>
              {(keyOf) => {
                const key = keyOf();
                // Keeps the last segment while the list drops this key (the row is removed in the same flush).
                const segment = computed(() => (panel()?.all.find((candidate) => candidate.key === key) ?? null) as SchedulerRowSegment<T>, { equals: keep });
                return <SchedulerEventChip segment={() => segment()} lane={true} tabIndex={0} handles={false} />;
              }}
            </For>
          </div>
        )}
      </Popover>
    </div>
  );
}
