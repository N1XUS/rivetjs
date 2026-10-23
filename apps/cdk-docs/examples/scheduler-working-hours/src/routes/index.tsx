// Rivet-authored Scheduler demo: working hours and slot sizes.
// Functional examples adapt the author's MIT-licensed scheduler examples; no Pro source is used.
import { signal } from "@rivetjs/reactivity";
import { Scheduler, type SchedulerHeaderApi } from "@rivetjs/cdk/scheduler";
import { Button } from "@rivetjs/cdk/button";
import { Icon } from "@rivetjs/kit/icon";
import { ChevronLeft, ChevronRight } from "lucide";

export const head = { title: "Scheduler: Working hours and slot sizes" };

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
  const hideWeekend = signal(true);
  const duration = signal(15);
  return (
    <section class="grid min-w-0 gap-3">
      <div class="flex flex-wrap items-center gap-2">
        <Button id="weekends" class="planner-button" aria-pressed={hideWeekend()} onPress={() => hideWeekend.set(!hideWeekend())}>
          Hidden weekends: {hideWeekend() ? "yes" : "no"}
        </Button>
        <Button id="hour-slots" class="planner-button" onPress={() => duration.set(60)}>
          60-minute slots
        </Button>
        <Button id="quarter-slots" class="planner-button" onPress={() => duration.set(15)}>
          15-minute slots
        </Button>
        <output id="slot-size">Slot: {duration()} minutes</output>
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
        hiddenDays={hideWeekend() ? [0, 6] : []}
        slotDuration={duration()}
        businessHours={{ start: "09:00", end: "17:30", days: [1, 2, 3, 4, 5] }}
        timeZone="UTC"
        locale="en-US"
        firstDayOfWeek="mon"
        aria-label="Team schedule"
        style={{ "--rv-scheduler-height": "420px" }}
        minTime="08:00"
        maxTime="18:00"
        renderHeader={(api) => <PlannerHeader api={api} />}
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
