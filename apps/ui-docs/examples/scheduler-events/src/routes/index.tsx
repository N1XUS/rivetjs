// Rivet-authored Scheduler demo: events.
// Functional examples adapt the author's MIT-licensed scheduler examples; no Pro source is used.
import { signal } from "@rivetjs/reactivity";
import { Scheduler, type SchedulerEvent } from "@rivetjs/ui/scheduler";

export const head = { title: "Scheduler: Events" };

// #region demo

export function PlannerDemo() {
  const selected = signal("Select an event");
  const events = signal<readonly SchedulerEvent[]>([
    { id: "review", title: "Design review", start: "2026-10-20T09:00", end: "2026-10-20T10:30", color: "accent" },
    { id: "support", title: "Support rotation", start: "2026-10-20T10:00", end: "2026-10-20T12:00", color: "success" },
    { id: "release", title: "Release window", start: "2026-10-21T13:00", end: "2026-10-21T14:00", color: "warning" },
    { id: "incident", title: "Incident review", start: "2026-10-22T11:00", end: "2026-10-22T12:00", color: "danger" },
    { id: "research", title: "Research", start: "2026-10-23T09:00", end: "2026-10-23T11:00", cssColor: "#7c3aed" },
  ]);
  return (
    <section class="grid min-w-0 gap-3">
      <Scheduler
        id="planner"
        events={events}
        defaultView="week"
        defaultDate="2026-10-20"
        onEventAction={({ event }) => selected.set(`Selected: ${event.title}`)}
        timeZone="UTC"
        locale="en-US"
        firstDayOfWeek="mon"
        aria-label="Team schedule"
        style={{ "--rv-scheduler-height": "420px" }}
        minTime="08:00"
        maxTime="18:00"
      />
      <output id="selected">{selected()}</output>
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
