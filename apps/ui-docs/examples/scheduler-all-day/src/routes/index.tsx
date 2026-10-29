// Rivet-authored Scheduler demo: all-day events.
// Functional examples adapt the author's MIT-licensed scheduler examples; all code is original or from that MIT-licensed project.
import { signal } from "@rivetjs/reactivity";
import { Scheduler, type SchedulerEvent } from "@rivetjs/ui/scheduler";

export const head = { title: "Scheduler: All-day events" };

// #region demo

export function PlannerDemo() {
  const selected = signal("Choose a whole-day event");
  const events: readonly SchedulerEvent[] = [
    { id: "summit", title: "Product summit", start: "2026-10-19", end: "2026-10-22", allDay: true, color: "accent" },
    { id: "holiday", title: "Team holiday", start: "2026-10-23", end: "2026-10-24", allDay: true, color: "success" },
  ];
  return (
    <section class="grid min-w-0 gap-3">
      <Scheduler
        id="planner"
        events={events}
        defaultDate="2026-10-20"
        onEventAction={({ event }) => selected.set(`${event.title} ends ${String(event.end)} (exclusive)`)}
        timeZone="UTC"
        locale="en-US"
        firstDayOfWeek="mon"
        aria-label="Team schedule"
        style={{ "--rv-scheduler-height": "420px" }}
        minTime="08:00"
        maxTime="18:00"
      />
      <output id="all-day-end">{selected()}</output>
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
