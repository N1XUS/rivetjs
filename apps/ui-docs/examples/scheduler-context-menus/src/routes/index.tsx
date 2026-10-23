// Rivet-authored Scheduler demo: event and slot context menus.
// Functional examples adapt the author's MIT-licensed scheduler examples; no Pro source is used.
import { signal } from "@rivetjs/reactivity";
import { Scheduler, type SchedulerEvent } from "@rivetjs/ui/scheduler";
import { Button } from "@rivetjs/ui/button";

import { Dropdown } from "@rivetjs/ui/dropdown";
import { Show } from "@rivetjs/runtime/dom";

export const head = { title: "Scheduler: Event and slot context menus" };

// #region demo

export function PlannerDemo() {
  const events = signal<readonly SchedulerEvent[]>([
    { id: "design", title: "Design review", start: "2026-10-20T10:00", end: "2026-10-20T11:00" },
    { id: "offsite", title: "Offsite", start: "2026-10-22", end: "2026-10-24", allDay: true, color: "success" },
  ]);
  // This counter survives resume and removal; both creation paths share one monotonic allocator.
  const nextId = signal(2);
  function allocateId() {
    const id = nextId();
    nextId.set(id + 1);
    return id;
  }
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
          <Dropdown.Item
            id="new-event"
            onAction={() => {
              const n = allocateId();
              events.set([...events(), { id: `new-${n}`, title: `New event ${n}`, start: range.start, end: range.end, allDay: range.allDay }]);
              log.set(`Created ${context.selection ? "selected range" : "slot"}: ${String(range.start)} to ${String(range.end)} (exclusive)`);
              context.close();
            }}
          >
            New event
          </Dropdown.Item>
        )}
        renderEventMenu={(event, context) => (
          <>
            <Dropdown.Item
              id="rename-event"
              onAction={() => {
                events.set(events().map((item) => (item.id === event.id ? { ...item, title: `${item.title} (edited)` } : item)));
                log.set("Renamed event");
                context.close();
              }}
            >
              Rename
            </Dropdown.Item>
            <Dropdown.Item
              id="duplicate-event"
              onAction={() => {
                const n = allocateId();
                events.set([...events(), { ...event, id: `copy-${n}`, title: `${event.title} (copy)` }]);
                log.set("Duplicated event");
                context.close();
              }}
            >
              Duplicate
            </Dropdown.Item>
            <Dropdown.Item
              id="delete-event"
              onAction={() => {
                pending.set(event.id);
                context.close();
              }}
            >
              Delete
            </Dropdown.Item>
          </>
        )}
        timeZone="UTC"
        locale="en-US"
        firstDayOfWeek="mon"
        aria-label="Team schedule"
        style={{ "--rv-scheduler-height": "420px" }}
        minTime="08:00"
        maxTime="18:00"
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
      <output id="event-count">Events: {events().length}</output>
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
