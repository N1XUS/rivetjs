// Rivet-authored Scheduler demo: month spanning events and date navigation (own implementation: two-way `view` / `date` signals + `onSlotAction`).
import { signal } from "@rivetjs/reactivity";
import type { SchedulerDate } from "@rivetjs/cdk/scheduler/layout";
import { Button } from "@rivetjs/ui/button";
import { Scheduler, type SchedulerEvent, type SchedulerView } from "@rivetjs/ui/scheduler";

export const head = { title: "Scheduler: Spanning events and date navigation" };

// #region demo
export function PlannerDemo() {
  const view = signal<SchedulerView>("month");
  const date = signal<SchedulerDate>("2026-10-01");
  const events: readonly SchedulerEvent[] = [
    { id: "sprint", title: "Sprint 21", start: "2026-10-14", end: "2026-10-24", allDay: true, color: "accent" },
    { id: "trip", title: "Customer trip", start: "2026-10-22", end: "2026-10-27", allDay: true, color: "warning" },
    { id: "demo", title: "Sprint demo", start: "2026-10-22T15:00", end: "2026-10-22T16:00", color: "success" },
  ];
  return (
    <section class="grid min-w-0 gap-3">
      <div class="flex flex-wrap items-center gap-2">
        <Button id="back-to-month" size="sm" variant="secondary" isDisabled={() => view() === "month"} onPress={() => view.set("month")}>
          Back to month
        </Button>
        <output id="nav">
          {view()} · {String(date())}
        </output>
      </div>
      <Scheduler
        id="planner"
        events={events}
        view={view}
        date={date}
        onSlotAction={(slot) => {
          // A day in the month grid opens that day.
          if (view() !== "month") return;
          date.set(slot.date);
          view.set("day");
        }}
        timeZone="UTC"
        locale="en-US"
        firstDayOfWeek="mon"
        aria-label="Team schedule"
        style={{ "--rv-scheduler-height": "460px" }}
        minTime="08:00"
        maxTime="18:00"
      />
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
