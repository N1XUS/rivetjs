// Rivet-authored Scheduler demo: all-day spans and midnight crossings.
// Functional examples adapt the author's MIT-licensed scheduler examples; no Pro source is used.
import { signal } from "@rivetjs/reactivity";
import { Scheduler, type SchedulerEvent, type SchedulerHeaderApi } from "@rivetjs/cdk/scheduler";
import { Button } from "@rivetjs/cdk/button";
import { Icon } from "@rivetjs/kit/icon";
import { ChevronLeft, ChevronRight } from "lucide";

export const head = { title: "Scheduler: All-day spans and midnight crossings" };

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
    { id: "conference", title: "Conference", start: "2026-10-19", end: "2026-10-22", allDay: true, color: "accent" },
    { id: "holiday", title: "Public holiday", start: "2026-10-23", end: "2026-10-24", allDay: true, color: "success" },
    { id: "launch", title: "Launch window", start: "2026-10-21T22:00", end: "2026-10-22T02:00", color: "danger" },
    { id: "offsite", title: "Offsite (36 h)", start: "2026-10-22T10:00", end: "2026-10-23T22:00" },
  ]);
  const opened = signal("Choose an event to inspect its exclusive end.");
  return (
    <section class="grid min-w-0 gap-3">
      <Scheduler
        id="planner"
        events={events}
        defaultView="week"
        defaultDate="2026-10-20"
        minTime="00:00"
        maxTime="24:00"
        slotDuration={60}
        onEventAction={({ event }) => opened.set(`${event.title}: ${String(event.start)} to ${String(event.end)} (exclusive)`)}
        timeZone="UTC"
        locale="en-US"
        firstDayOfWeek="mon"
        aria-label="Team schedule"
        style={{ "--rv-scheduler-height": "420px" }}
        renderHeader={(api) => <PlannerHeader api={api} />}
      />
      <output id="opened">{opened()}</output>
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
