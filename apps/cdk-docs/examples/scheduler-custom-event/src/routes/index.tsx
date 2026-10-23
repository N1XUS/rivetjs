// Rivet-authored Scheduler demo: custom event contents.
// Functional examples adapt the author's MIT-licensed scheduler examples; no Pro source is used.
import { signal } from "@rivetjs/reactivity";
import { Scheduler, type SchedulerEvent, type SchedulerHeaderApi } from "@rivetjs/cdk/scheduler";
import { Button } from "@rivetjs/cdk/button";
import { Icon } from "@rivetjs/kit/icon";
import { ChevronLeft, ChevronRight } from "lucide";

export const head = { title: "Scheduler: Custom event contents" };

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
  const events = signal<readonly SchedulerEvent<{ owner: string; room: string }>[]>([
    { id: "roadmap", title: "Roadmap", start: "2026-10-20T09:00", end: "2026-10-20T10:30", cssColor: "#7c3aed", data: { owner: "Ada", room: "Sky" } },
    { id: "hiring", title: "Hiring sync", start: "2026-10-20T11:00", end: "2026-10-20T12:00", color: "success", data: { owner: "Lin", room: "Oak" } },
    { id: "all-hands", title: "All hands", start: "2026-10-22", end: "2026-10-23", allDay: true, data: { owner: "Ops", room: "Main" } },
  ]);
  const opened = signal("No meeting selected");
  return (
    <section class="grid min-w-0 gap-3">
      <Scheduler
        id="planner"
        events={events}
        defaultView="week"
        defaultDate="2026-10-20"
        renderEvent={(event, state) => (
          <span class="flex min-w-0 items-center gap-1">
            <span class="inline-grid size-5 shrink-0 place-items-center rounded-full bg-white/60 text-[10px] font-bold">{event.data?.owner.slice(0, 1)}</span>
            <span class="min-w-0 truncate">
              <strong>{event.title}</strong>
              <span class="block text-[10px]">
                {event.data?.owner} · {event.data?.room}
                {state.allDay ? " · all day" : ""}
              </span>
            </span>
          </span>
        )}
        onEventAction={({ event }) => opened.set(`${event.title} in ${event.data?.room}, hosted by ${event.data?.owner}`)}
        timeZone="UTC"
        locale="en-US"
        firstDayOfWeek="mon"
        aria-label="Team schedule"
        style={{ "--rv-scheduler-height": "420px" }}
        minTime="08:00"
        maxTime="18:00"
        renderHeader={(api) => <PlannerHeader api={api} />}
      />
      <output id="meeting">{opened()}</output>
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
