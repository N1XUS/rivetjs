// Rivet-authored Scheduler demo: move and resize vetoes.
// Functional examples adapt the author's MIT-licensed scheduler examples; all code is original or from that MIT-licensed project.
import { signal } from "@rivetjs/reactivity";
import { Scheduler, type SchedulerEvent } from "@rivetjs/ui/scheduler";
import { Button } from "@rivetjs/ui/button";

import { toLayoutTime, type SchedulerRange } from "@rivetjs/cdk/scheduler/layout";

export const head = { title: "Scheduler: Move and resize vetoes" };

// #region demo

export function PlannerDemo() {
  const readOnly = signal(false);
  const log = signal("Move or resize an event with Alt+Arrow or the pointer.");
  const events = signal<readonly SchedulerEvent[]>([
    { id: "movable", title: "Movable", start: "2026-10-20T09:00", end: "2026-10-20T10:00" },
    { id: "pinned", title: "Pinned", start: "2026-10-20T11:00", end: "2026-10-20T12:00", isDraggable: false, color: "warning" },
    { id: "fixed", title: "Fixed length", start: "2026-10-21T13:00", end: "2026-10-21T14:00", isResizable: false },
    { id: "business", title: "Business hours only", start: "2026-10-22T08:00", end: "2026-10-22T09:00", color: "accent" },
  ]);
  const canChange = (event: SchedulerEvent, next: SchedulerRange) => {
    if (event.id !== "business") return true;
    const start = toLayoutTime(next.start, "UTC");
    const end = toLayoutTime(next.end, "UTC");
    const allowed = !next.allDay && !!start && !!end && start.minute >= 480 && (end.day - start.day) * 1440 + end.minute <= 1080;
    if (!allowed) log.set("Rejected: keep this event inside 08:00–18:00.");
    return allowed;
  };
  return (
    <section class="grid min-w-0 gap-3">
      <Button id="read-only" class="planner-button" aria-pressed={readOnly()} onPress={() => readOnly.set(!readOnly())}>
        Read only: {readOnly() ? "on" : "off"}
      </Button>
      <Scheduler
        id="planner"
        events={events}
        defaultView="week"
        defaultDate="2026-10-20"
        isReadOnly={readOnly()}
        canMove={canChange}
        canResize={canChange}
        onEventMove={({ event, source }) => log.set(`${event.title} moved by ${source}: ${String(event.start)}`)}
        onEventResize={({ event, source }) => log.set(`${event.title} resized by ${source}: ${String(event.end)}`)}
        timeZone="UTC"
        locale="en-US"
        firstDayOfWeek="mon"
        aria-label="Team schedule"
        style={{ "--rv-scheduler-height": "420px" }}
        minTime="07:00"
        maxTime="18:00"
      />
      <output id="change-log">{log()}</output>
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
