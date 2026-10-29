// Rivet-authored Scheduler demo: drag interactions.
// Functional examples adapt the author's MIT-licensed scheduler examples; all code is original or from that MIT-licensed project.
import { signal } from "@rivetjs/reactivity";
import { Scheduler, type SchedulerEvent } from "@rivetjs/ui/scheduler";

export const head = { title: "Scheduler: Drag interactions" };

// #region demo

export function PlannerDemo() {
  const events = signal<readonly SchedulerEvent[]>([
    { id: "planning", title: "Planning", start: "2026-10-20T09:00", end: "2026-10-20T10:00", color: "accent" },
  ]);
  const log = signal("Alt+Arrow moves; Alt+Shift+Arrow resizes the end. Try the pointer handles too.");
  return (
    <section class="grid min-w-0 gap-3">
      <Scheduler
        id="planner"
        events={events}
        defaultView="week"
        defaultDate="2026-10-20"
        snapDuration={15}
        onEventMove={({ event, source }) => log.set(`Moved by ${source}: ${String(event.start)}`)}
        onEventResize={({ event, source }) => log.set(`Resized by ${source}: ${String(event.end)}`)}
        timeZone="UTC"
        locale="en-US"
        firstDayOfWeek="mon"
        aria-label="Team schedule"
        style={{ "--rv-scheduler-height": "420px" }}
        minTime="08:00"
        maxTime="18:00"
      />
      <output id="drag-log">{log()}</output>
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
