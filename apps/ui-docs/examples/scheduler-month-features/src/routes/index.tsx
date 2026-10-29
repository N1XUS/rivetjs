// Rivet-authored Scheduler demo: month view features.
// Functional examples adapt the author's MIT-licensed scheduler examples; all code is original or from that MIT-licensed project.
import { signal } from "@rivetjs/reactivity";
import { Scheduler, type SchedulerEvent } from "@rivetjs/ui/scheduler";

export const head = { title: "Scheduler: Month view features" };

// #region demo

export function PlannerDemo() {
  const events: readonly SchedulerEvent[] = [
    { id: "first", title: "Planning", start: "2026-10-20", end: "2026-10-21", allDay: true },
    { id: "second", title: "Design clinic", start: "2026-10-20", end: "2026-10-21", allDay: true, color: "success" },
    { id: "third", title: "Launch rehearsal", start: "2026-10-20", end: "2026-10-21", allDay: true, color: "warning" },
    { id: "fourth", title: "Research handoff", start: "2026-10-20", end: "2026-10-21", allDay: true, color: "accent" },
  ];
  const opened = signal("Open the overflow panel on October 20.");
  return (
    <section class="grid min-w-0 gap-3">
      <Scheduler
        id="planner"
        events={events}
        defaultDate="2026-10-20"
        visibleLanes={2}
        showWeekNumbers
        onMoreAction={({ events }) => opened.set(`Hidden events: ${events.map((event) => event.title).join(", ")}`)}
        timeZone="UTC"
        locale="en-US"
        firstDayOfWeek="mon"
        aria-label="Team schedule"
        style={{ "--rv-scheduler-height": "420px" }}
        minTime="08:00"
        maxTime="18:00"
      />
      <output id="overflow">{opened()}</output>
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
