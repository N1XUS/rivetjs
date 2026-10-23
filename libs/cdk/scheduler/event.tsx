// Ported from @malva-ui/scheduler (src/lib/event/scheduler-event.ts + .html host bindings, labels and default
// content), MIT, © 2026 Malva UI.
// Rivet:
// - one element per rendered segment (`div.rv-SchedulerEvent`, role `button`), state as `data-*` (`data-ghost`,
//   `data-all-day` / `data-timed`, `data-continues-before` / `-after`, `data-color`, `data-draggable="false"`); the
//   event's `cssColor` as the `--rv-scheduler-event-color` custom property; headless: no continuation icons (styled
//   layers draw them from the data attributes or through `renderEvent`).
// - `*mlvSchedulerEventDef` → `renderEvent(event, state)` (read once at mount by the root).
// - Resize handles (`span.rv-SchedulerEvent-resize-handle[data-edge]` > `span.rv-SchedulerEvent-grip`, aria-hidden)
//   on resizable, non-ghost chips, none on a continuing edge, none in the `+N more` panel (`handles={false}`: no day
//   cell owns a panel chip); inline `touch-action: none` (behaviour style, malva `scheduler-event.scss`: a press-then-drag
//   on a handle never starts a pan). A ghost is not hit-testable (inline `pointer-events: none`, behaviour style).
// - Pointer / keyboard behaviour (drag, resize, click → action, focus hand-off) is delegated on the views
//   (`behaviour.ts` `schedulerPress`, `keys*.ts`); this file is markup only.
import { schedulerPart } from "./context.tsx";
import { computed, useContext } from "@rivetjs/reactivity";
import { For, type DOMValue } from "@rivetjs/runtime/dom";
import { SchedulerContext } from "./context.tsx";
import { dayOf } from "./dates.ts";
import { lastDayOf, spansMultipleDays, type SchedulerNormalizedEvent } from "./layout.ts";
import { dateLabel, dateTimeLabel, timeLabel } from "./state.ts";

const NO_EDGES: readonly ("start" | "end")[] = Object.freeze([]);
const START: readonly ("start" | "end")[] = Object.freeze(["start"]);
const END: readonly ("start" | "end")[] = Object.freeze(["end"]);
const BOTH: readonly ("start" | "end")[] = Object.freeze(["start", "end"]);
const HANDLE_STYLE = Object.freeze({ "touch-action": "none" });

/** One segment as a chip renders it. */
export interface SchedulerChipSegment<T = unknown> {
  readonly normalized: SchedulerNormalizedEvent<T>;
  readonly continuesBefore: boolean;
  readonly continuesAfter: boolean;
}

export interface SchedulerEventChipProps<T = unknown> {
  /** The segment (accessor: the chip follows layout changes in place). */
  segment: () => SchedulerChipSegment<T>;
  /** Rendered in a lane (month grid, all-day band, panel) rather than on the time axis. */
  lane: boolean;
  /** Roving tab index; the owning cell hands out `0`. Default `-1`. */
  tabIndex?: number;
  /** Geometry custom properties (`--rv-scheduler-lane`, `--rv-scheduler-span`, …). */
  geometry?: () => Record<string, string> | undefined;
  /** Extra `data-spanning` (month bar across several cells). */
  spanning?: () => boolean;
  /** Render resize handles when the event is resizable. Default `true`. */
  handles?: boolean;
  /** Timed chips: the owning slot's minutes of day (`data-rv-slot`, keyboard `Enter` / `Escape` / focus hand-off). */
  slot?: () => number;
}

/** An event chip (internal part of the views). */
export function SchedulerEventChip<T>(props: SchedulerEventChipProps<T>): DOMValue {
  const ctx = useContext(SchedulerContext)!;
  const segment = props.segment;
  const lane = props.lane;
  const tabIndex = props.tabIndex ?? -1;
  const geometry = props.geometry;
  const spanning = props.spanning;
  const handles = props.handles !== false;
  const slot = props.slot;
  const renderEvent = ctx.renderEvent;
  const n = computed(() => segment().normalized);
  const ghost = () => n().ghost === true;
  const draggable = () => ctx.editable() && n().event.isDraggable !== false;
  const resizable = () => ctx.editable() && n().event.isResizable !== false;
  const time = computed(() => {
    const normalized = n();
    if (normalized.allDay) return "";
    const from = timeLabel(normalized.start, ctx.locale());
    return lane ? from : from + " – " + timeLabel(normalized.end, ctx.locale());
  });
  const label = computed(() => {
    const normalized = n();
    const locale = ctx.locale();
    if (normalized.allDay)
      return ctx.t("eventLabelAllDay", {
        title: normalized.event.title,
        start: dateLabel(dayOf(normalized.start), locale),
        end: dateLabel(lastDayOf(normalized), locale),
      });
    const multi = spansMultipleDays(normalized);
    const format = multi ? dateTimeLabel : timeLabel;
    return ctx.t("eventLabel", { title: normalized.event.title, start: format(normalized.start, locale), end: format(normalized.end, locale) });
  });
  const style = () => {
    const color = n().event.cssColor;
    const base = geometry?.();
    const out = color ? { ...base, "--rv-scheduler-event-color": color } : base;
    return ghost() ? { ...out, "pointer-events": "none" } : out;
  };
  const edges = computed((): readonly ("start" | "end")[] => {
    if (!handles || ghost() || !resizable()) return NO_EDGES;
    const s = segment();
    return s.continuesBefore ? (s.continuesAfter ? NO_EDGES : END) : s.continuesAfter ? START : BOTH;
  });
  return (
    <div
      class={schedulerPart("rv-SchedulerEvent", ctx.classNames?.(), "event")}
      role={ghost() ? undefined : "button"}
      tabIndex={ghost() ? -1 : tabIndex}
      aria-hidden={ghost() ? "true" : undefined}
      inert={ghost() ? true : undefined}
      aria-label={ghost() ? undefined : label()}
      aria-describedby={!ghost() && (draggable() || resizable()) ? ctx.dragHintId : undefined}
      data-rv-event-id={n().event.id}
      data-rv-slot={slot ? String(slot()) : undefined}
      data-draggable={draggable() && !ghost() ? undefined : "false"}
      data-ghost={ghost() ? "true" : undefined}
      data-all-day={lane ? "true" : undefined}
      data-timed={lane ? undefined : "true"}
      data-continues-before={segment().continuesBefore ? "true" : undefined}
      data-continues-after={segment().continuesAfter ? "true" : undefined}
      data-spanning={spanning?.() ? "true" : undefined}
      data-color={n().event.color}
      data-custom-color={n().event.cssColor ? "true" : undefined}
      style={style()}
    >
      {renderEvent ? (
        () =>
          renderEvent(n().event, {
            view: ctx.view(),
            allDay: lane,
            continuesBefore: segment().continuesBefore,
            continuesAfter: segment().continuesAfter,
            isGhost: ghost(),
            time: time(),
          })
      ) : (
        <>
          {time() ? (
            <span class={schedulerPart("rv-SchedulerEvent-time", ctx.classNames?.(), "eventTime")}>
              <bdi>{time()}</bdi>
            </span>
          ) : null}
          <span class={schedulerPart("rv-SchedulerEvent-title", ctx.classNames?.(), "eventTitle")}>{n().event.title}</span>
        </>
      )}
      <For each={edges} by={(edge) => edge}>
        {(edge) => (
          <span
            class={schedulerPart("rv-SchedulerEvent-resize-handle", ctx.classNames?.(), "handle")}
            data-edge={edge()}
            aria-hidden="true"
            style={HANDLE_STYLE}
          >
            <span class="rv-SchedulerEvent-grip" />
          </span>
        )}
      </For>
    </div>
  );
}
