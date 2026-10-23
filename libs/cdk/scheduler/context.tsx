// Ported from @malva-ui/scheduler (src/lib/scheduler/scheduler-context.ts `MLV_SCHEDULER_CONTEXT`), MIT, © 2026 Malva UI.
// Rivet: the root → views contract as one context (`SchedulerContext`). The root builds every accessor as an
// inline arrow / `computed` in its own `.tsx` render (resumable); views read them, never the root's props.
import { createContext } from "@rivetjs/reactivity";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import type {
  SchedulerEvent,
  SchedulerEventInteraction,
  SchedulerLayoutRange,
  SchedulerMoreEvent,
  SchedulerNormalizedEvent,
  SchedulerSlotEvent,
  SchedulerView,
} from "./layout.ts";
import type { SchedulerMessageKey } from "./intl.ts";
import type { SchedulerDate } from "./dates.ts";
import type { SchedulerState } from "./state.ts";

/** State handed to `renderEvent` (accessor-free snapshot of the chip; the render function re-runs on change). */
export interface SchedulerEventRenderState {
  /** The view the chip renders in. */
  readonly view: SchedulerView;
  /** Rendered in a lane (month grid, all-day band, `+N more` panel) instead of on the time axis. */
  readonly allDay: boolean;
  /** The event started before this segment. */
  readonly continuesBefore: boolean;
  /** The event ends after this segment. */
  readonly continuesAfter: boolean;
  /** The drag-preview copy of an event being dragged. */
  readonly isGhost: boolean;
  /** Formatted time of the chip (`"9:00 AM"` in a lane, `"9:00 AM – 9:30 AM"` on the time axis; empty all-day). */
  readonly time: string;
}

/** `renderEvent` (read once at mount): chip content. */
export type SchedulerRenderEvent<T = unknown> = (event: SchedulerEvent<T>, state: SchedulerEventRenderState) => Content;

/** The time axis of the time grid in minutes of day (`last` = start of the last RENDERED slot row). */
export interface SchedulerAxis {
  readonly min: number;
  readonly max: number;
  readonly slot: number;
  readonly snap: number;
  readonly last: number;
}

/** Interaction kinds shared by chips and cells (malva `MlvSchedulerInteractionKind`). */
export type SchedulerInteractionKind = "click" | "dblclick" | "contextmenu";

/** Where a slot interaction happened: day number, slot minutes (`null` = the day), painted by a pending selection. */
export interface SchedulerSlotPosition {
  readonly day: number;
  readonly minutes: number | null;
  readonly inSelection: boolean;
}

/** Root → views contract. */
export interface SchedulerContextValue<T = unknown> {
  readonly state: SchedulerState<T>;
  readonly view: () => SchedulerView;
  readonly locale: () => string;
  readonly timeZone: () => string;
  /** Rendered day numbers (after `hiddenDays`). */
  readonly days: () => readonly number[];
  /** Visible days per month week row. */
  readonly rowLength: () => number;
  /** Day number of the anchor date. */
  readonly anchorDay: () => number;
  /** Today's day number, `null` while `showCurrentTime` is off (no today highlight). */
  readonly today: () => number | null;
  /** Weekend weekdays (0 = Sunday). */
  readonly weekend: () => readonly number[];
  /** Normalized events plus the drag ghost. */
  readonly events: () => readonly SchedulerNormalizedEvent<T>[];
  readonly visibleLanes: () => number;
  readonly editable: () => boolean;
  readonly selectable: () => boolean;
  readonly showWeekNumbers: () => boolean;
  /** A day as a date in the anchor's form (all-day: date-only for strings / `CalendarDate`). */
  readonly dateOf: (day: number) => SchedulerDate;
  /** Translated message (resolved table, plural selection). */
  readonly t: (key: SchedulerMessageKey | "moreEvents" | "moreEventsLabel", vars?: Record<string, string | number | boolean>) => string;
  /** Id of the visually hidden drag hint (chips' `aria-describedby`). */
  readonly dragHintId: string;
  /** Id of the `+N more` panel. */
  readonly popoverId: string;
  readonly renderEvent: SchedulerRenderEvent<T> | undefined;
  // ─── Actions for the delegated keyboard / click handlers (T8; inline arrows of the root: resumable) ───
  /** The normalized (non-ghost) event of `id`, `null` once it left the model. */
  readonly normalized: (id: string) => SchedulerNormalizedEvent<T> | null;
  /** `commitChange` from the keyboard; returns whether it was applied. */
  readonly commit: (kind: "move" | "resize", normalized: SchedulerNormalizedEvent<T>, next: SchedulerLayoutRange) => boolean;
  /** Navigates to the period containing `day` (`schedulerGoTo`, the anchor's form). */
  readonly goTo: (day: number) => void;
  /** The nearest rendered weekday from `day` in `direction` (malva `nextVisibleDate`). */
  readonly stepDay: (day: number, direction: -1 | 1) => number;
  /** One month from `day` (same day of month, clamped), skipped on to a rendered weekday (malva `_page`). */
  readonly pageMonth: (day: number, direction: -1 | 1) => number;
  /** A slot's date (`minutes` `null` = the day, all-day) in the anchor's form; 24:00 rolls over to the next day. */
  readonly slotDate: (day: number, minutes: number | null) => SchedulerDate;
  readonly axis: () => SchedulerAxis;
  /** Reads the pending selection back as a `selectionHint` announcement. */
  readonly announceSelection: () => void;
  /** Commits the pending selection (`onRangeSelect`, source keyboard). */
  readonly commitSelection: () => void;
  /** Chip interaction → `onEventAction` / `onEventDoubleClick` / `onEventContextMenu`; a context menu opens `renderEventMenu` first. */
  readonly eventInteraction: (kind: SchedulerInteractionKind, interaction: SchedulerEventInteraction<T>) => void;
  /** `Delete` / `Backspace` on a chip → `onEventDelete`. */
  readonly eventDelete: (interaction: SchedulerEventInteraction<T>) => void;
  /** Cell interaction → `onSlotAction` / `onSlotDoubleClick` / `onSlotContextMenu`; a context menu opens `renderSlotMenu` first. */
  readonly slotInteraction: (kind: SchedulerInteractionKind, slot: SchedulerSlotEvent, at: SchedulerSlotPosition) => void;
  /** `renderEventMenu` is given (a chip right-click / ContextMenu key opens the built-in menu). */
  readonly hasEventMenu: boolean;
  /** `renderSlotMenu` is given. */
  readonly hasSlotMenu: boolean;
  readonly onMoreAction: ((event: SchedulerMoreEvent<T>) => void) | undefined;
}

/** The scheduler's root context. */
export const SchedulerContext = createContext<SchedulerContextValue<any> | null>(null);
