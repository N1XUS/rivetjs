// Ported from @malva-ui/scheduler (src/lib/scheduler/scheduler.html toolbar, scheduler.ts `_headerContext` /
// `_previousLabel` / `_nextLabel` / `_onViewSwitch`, scheduler-defs.ts `MlvSchedulerHeaderDef`), MIT, © 2026 Malva UI.
// Rivet:
// - headless default toolbar on cdk parts: `Button` (previous / next / today) + `h2` title + single-selection
//   `ToggleButtonGroup` (month / week / day; malva `mlv-segmented`); `rv-SchedulerToolbar*` classes, no icons (the
//   previous / next buttons carry `aria-label` only: icons belong to `@rivetjs/ui` / examples, cdk Calendar precedent).
// - `MlvSchedulerHeaderDef` → `renderHeader(api)` (read once at mount; its output is reactive): the header api holds
//   accessors (`title()`, `view()`, `range()`) + actions (`next`, `previous`, `today`, `setView`, `goTo`) instead of
//   malva's per-change snapshot.
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { Button } from "../button/index.tsx";
import { ToggleButton } from "../toggle-button/index.tsx";
import { ToggleButtonGroup } from "../toggle-button-group/index.tsx";
import type { SchedulerView, SchedulerVisibleRange } from "./layout.ts";
import type { SchedulerDate } from "./dates.ts";

/** What `renderHeader` receives (malva `MlvSchedulerHeaderApi` + `goTo`): accessors and actions. */
export interface SchedulerHeaderApi {
  /** Localized title of the rendered period ("September 2026", "Aug 31 – Sep 6, 2026", the day label). */
  readonly title: () => string;
  /** The active view. */
  readonly view: () => SchedulerView;
  /** The rendered period (dates in the anchor's form). */
  readonly range: () => SchedulerVisibleRange;
  /** One period forward. */
  readonly next: () => void;
  /** One period back. */
  readonly previous: () => void;
  /** Jumps to today. */
  readonly today: () => void;
  /** Switches the view. */
  readonly setView: (view: SchedulerView) => void;
  /** Jumps to the period containing `date`. */
  readonly goTo: (date: SchedulerDate) => void;
}

/** `renderHeader` (read once at mount): replaces the default toolbar. */
export type SchedulerRenderHeader = (api: SchedulerHeaderApi) => Content;

/** Labels of the default toolbar (translated by the root). */
export interface SchedulerToolbarLabels {
  readonly previous: () => string;
  readonly next: () => string;
  readonly today: () => string;
  readonly viewSwitch: () => string;
  readonly month: () => string;
  readonly week: () => string;
  readonly day: () => string;
}

const VIEWS: readonly SchedulerView[] = ["month", "week", "day"];

/**
 * The default toolbar (malva `.mlv-scheduler__toolbar`): `div.rv-SchedulerToolbar` > `.rv-SchedulerToolbar-nav`
 * (previous, next, today) + `h2.rv-SchedulerToolbar-title` + `.rv-SchedulerToolbar-views` (radio group of the three
 * views). DOM order and labels stay the same in RTL (mirroring is CSS).
 */
export function SchedulerToolbar(props: { api: SchedulerHeaderApi; labels: SchedulerToolbarLabels }) {
  const api = props.api;
  const labels = props.labels;
  return (
    <div class="rv-SchedulerToolbar">
      <div class="rv-SchedulerToolbar-nav">
        <Button class="rv-SchedulerToolbar-previous" aria-label={labels.previous()} onPress={() => api.previous()} />
        <Button class="rv-SchedulerToolbar-next" aria-label={labels.next()} onPress={() => api.next()} />
        <Button class="rv-SchedulerToolbar-today" onPress={() => api.today()}>
          {labels.today()}
        </Button>
      </div>
      <h2 class="rv-SchedulerToolbar-title">{api.title()}</h2>
      <ToggleButtonGroup
        class="rv-SchedulerToolbar-views"
        aria-label={labels.viewSwitch()}
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={() => [api.view()]}
        onSelectionChange={(keys) => {
          const next = [...keys][0] as SchedulerView | undefined;
          if (next && VIEWS.includes(next)) api.setView(next);
        }}
      >
        <ToggleButton id="month" class="rv-SchedulerToolbar-view">
          {labels.month()}
        </ToggleButton>
        <ToggleButton id="week" class="rv-SchedulerToolbar-view">
          {labels.week()}
        </ToggleButton>
        <ToggleButton id="day" class="rv-SchedulerToolbar-view">
          {labels.day()}
        </ToggleButton>
      </ToggleButtonGroup>
    </div>
  );
}
