// Rivet-authored Scheduler demo: event and slot context menus.
// Functional examples adapt the author's MIT-licensed scheduler examples; no Pro source is used.
import { signal } from "@rivetjs/reactivity";
import { Scheduler, type SchedulerEvent, type SchedulerHeaderApi } from "@rivetjs/cdk/scheduler";
import { Button } from "@rivetjs/cdk/button";
import { Icon } from "@rivetjs/kit/icon";
import { ChevronLeft, ChevronRight } from "lucide";
import { MenuItem } from "@rivetjs/cdk/menu";
import { Show } from "@rivetjs/runtime/dom";

export const head = { title: "Scheduler: Event and slot context menus" };

// #region demo
function PlannerHeader({ api }: { api: SchedulerHeaderApi }) {
  return (
    <div class="flex flex-wrap items-center gap-2 p-3">
      <Button class="planner-button" aria-label={api.labels.previous()} onPress={() => api.previous()}>
        <Icon icon={ChevronLeft} size={16} />
      </Button>
      <Button class="planner-button" aria-label={api.labels.next()} onPress={() => api.next()}>
        <Icon icon={ChevronRight} size={16} />
      </Button>
      <Button class="planner-button" onPress={() => api.today()}>
        {api.labels.today()}
      </Button>
      <h2 class="min-w-32 grow text-base font-semibold">{api.title()}</h2>
      <Button class="planner-button" aria-pressed={api.view() === "month"} onPress={() => api.setView("month")}>
        {api.labels.month()}
      </Button>
      <Button class="planner-button" aria-pressed={api.view() === "week"} onPress={() => api.setView("week")}>
        {api.labels.week()}
      </Button>
      <Button class="planner-button" aria-pressed={api.view() === "day"} onPress={() => api.setView("day")}>
        {api.labels.day()}
      </Button>
    </div>
  );
}

export function PlannerDemo() {
  const events = signal<readonly SchedulerEvent[]>([
    { id: "design", title: "Design review", start: "2026-10-20T10:00", end: "2026-10-20T11:00" },
    { id: "offsite", title: "Offsite", start: "2026-10-22", end: "2026-10-24", allDay: true, color: "success" },
  ]);
  const log = signal("Right-click a cell or event, or press Shift+F10.");
  const pending = signal<string | null>(null);
  return (
    <section class="grid min-w-0 gap-3">
      <Scheduler
        id="planner"
        events={events}
        defaultView="month"
        defaultDate="2026-10-20"
        renderSlotMenu={(range, context) => (
          <MenuItem
            id="new-event"
            onAction={() => {
              const n = events().length + 1;
              events.set([...events(), { id: `new-${n}`, title: `New event ${n}`, start: range.start, end: range.end, allDay: range.allDay }]);
              log.set(`Created ${context.selection ? "selected range" : "slot"}: ${String(range.start)} to ${String(range.end)} (exclusive)`);
              context.close();
            }}
          >
            New event
          </MenuItem>
        )}
        renderEventMenu={(event, context) => (
          <>
            <MenuItem
              id="rename-event"
              onAction={() => {
                events.set(events().map((item) => (item.id === event.id ? { ...item, title: `${item.title} (edited)` } : item)));
                log.set("Renamed event");
                context.close();
              }}
            >
              Rename
            </MenuItem>
            <MenuItem
              id="duplicate-event"
              onAction={() => {
                events.set([...events(), { ...event, id: `copy-${events().length}`, title: `${event.title} (copy)` }]);
                log.set("Duplicated event");
                context.close();
              }}
            >
              Duplicate
            </MenuItem>
            <MenuItem
              id="delete-event"
              onAction={() => {
                pending.set(event.id);
                context.close();
              }}
            >
              Delete
            </MenuItem>
          </>
        )}
        timeZone="UTC"
        locale="en-US"
        firstDayOfWeek="mon"
        aria-label="Team schedule"
        style={{ "--rv-scheduler-height": "420px" }}
        minTime="08:00"
        maxTime="18:00"
        renderHeader={(api) => <PlannerHeader api={api} />}
      />
      <Show when={() => pending() !== null}>
        {() => (
          <div class="flex flex-wrap items-center gap-2 rounded-lg border border-slate-300 p-3" role="group" aria-label="Confirm deletion">
            <p>Delete this event from the schedule?</p>
            <Button
              id="confirm-delete"
              class="planner-button"
              onPress={() => {
                events.set(events().filter((event) => event.id !== pending()));
                pending.set(null);
                log.set("Deleted event");
              }}
            >
              Delete event
            </Button>
            <Button id="cancel-delete" class="planner-button" onPress={() => pending.set(null)}>
              Cancel
            </Button>
          </div>
        )}
      </Show>
      <output id="menu-log">{log()}</output>
    </section>
  );
}
// #endregion

export default function Demo() {
  return (
    <main class="min-h-dvh min-w-0 p-3 sm:p-5">
      <div class="mx-auto w-full min-w-0 max-w-5xl">
        <PlannerDemo />
      </div>
    </main>
  );
}
