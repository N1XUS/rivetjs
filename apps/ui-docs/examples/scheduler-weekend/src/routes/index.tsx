// Rivet-authored Scheduler demo: weekend highlighting.
// Functional examples adapt the author's MIT-licensed scheduler examples; all code is original or from that MIT-licensed project.
import { signal } from "@rivetjs/reactivity";
import { Scheduler } from "@rivetjs/ui/scheduler";
import { Button } from "@rivetjs/ui/button";

export const head = { title: "Scheduler: Weekend highlighting" };

// #region demo

export function PlannerDemo() {
  const custom = signal(false);
  const hidden = signal(false);
  return (
    <section class="grid min-w-0 gap-3">
      <div class="flex flex-wrap gap-2">
        <Button id="weekend-definition" class="planner-button" onPress={() => custom.set(!custom())}>
          Weekend: {custom() ? "Friday and Saturday" : "Saturday and Sunday"}
        </Button>
        <Button id="hide-weekends" class="planner-button" onPress={() => hidden.set(!hidden())}>
          Hide Sunday: {hidden() ? "yes" : "no"}
        </Button>
      </div>
      <Scheduler
        id="planner"
        events={[
          { id: "standup", title: "Standup", start: "2026-10-20T09:30", end: "2026-10-20T10:00", color: "accent" },
          { id: "design", title: "Design review", start: "2026-10-20T11:00", end: "2026-10-20T12:30" },
          { id: "lunch", title: "Team lunch", start: "2026-10-21T12:00", end: "2026-10-21T13:00", color: "success" },
          { id: "retro", title: "Retro", start: "2026-10-22T15:00", end: "2026-10-22T16:00", color: "warning" },
        ]}
        defaultView="week"
        defaultDate="2026-10-20"
        weekendDays={custom() ? [5, 6] : [0, 6]}
        hiddenDays={hidden() ? [0] : []}
        timeZone="UTC"
        locale="en-US"
        firstDayOfWeek="mon"
        aria-label="Team schedule"
        style={{ "--rv-scheduler-height": "420px" }}
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
