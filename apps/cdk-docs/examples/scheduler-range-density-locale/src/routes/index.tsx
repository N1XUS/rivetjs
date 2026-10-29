// Rivet-authored Scheduler demo: range selection, density and locale.
// Functional examples adapt the author's MIT-licensed scheduler examples; all code is original or from that MIT-licensed project.
import { signal } from "@rivetjs/reactivity";
import { Scheduler, type SchedulerEvent, type SchedulerHeaderApi } from "@rivetjs/cdk/scheduler";
import { Button } from "@rivetjs/cdk/button";
import { Icon } from "@rivetjs/kit/icon";
import { ChevronLeft, ChevronRight } from "lucide";
import { toLayoutTime, fromLayout } from "@rivetjs/cdk/scheduler/layout";

export const head = { title: "Scheduler: Range selection, density and locale" };

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
  const density = signal<"compact" | "default" | "comfortable">("comfortable");
  const locale = signal("en-US");
  const events = signal<readonly SchedulerEvent[]>([]);
  const selected = signal("Shift+Arrow then Enter creates a block; Space on a slot creates a quick event.");
  return (
    <section class="grid min-w-0 gap-3">
      <div class="flex flex-wrap items-center gap-2">
        <Button id="compact" class="planner-button" onPress={() => density.set("compact")}>
          Compact
        </Button>
        <Button id="comfortable" class="planner-button" onPress={() => density.set("comfortable")}>
          Comfortable
        </Button>
        <Button id="locale" class="planner-button" onPress={() => locale.set(locale() === "en-US" ? "de-DE" : "en-US")}>
          Locale: {locale()}
        </Button>
        <output id="density">Density: {density()}</output>
      </div>
      <Scheduler
        id="planner"
        events={events}
        defaultView="week"
        defaultDate="2026-10-20"
        locale={locale()}
        visibleLanes={density() === "compact" ? 3 : 5}
        onRangeSelect={(range) => {
          const id = events().length + 1;
          events.set([...events(), { id: `range-${id}`, title: `Block ${id}`, start: range.start, end: range.end, allDay: range.allDay }]);
          selected.set(`Created Block ${id} by ${range.source}: ${String(range.start)} to ${String(range.end)} (exclusive)`);
        }}
        onSlotAction={(slot) => {
          const start = toLayoutTime(slot.date, "UTC")!;
          const end = fromLayout(start.day + (slot.allDay ? 1 : 0), start.minute + (slot.allDay ? 0 : 60), slot.date, "UTC", slot.allDay);
          const id = events().length + 1;
          events.set([...events(), { id: `quick-${id}`, title: `Quick ${id}`, start: slot.date, end, allDay: slot.allDay }]);
          selected.set(`Created Quick ${id}`);
        }}
        timeZone="UTC"
        firstDayOfWeek="mon"
        aria-label="Team schedule"
        style={{ "--rv-scheduler-height": "420px", "--rv-scheduler-slot-height": density() === "compact" ? "32px" : "48px" }}
        minTime="08:00"
        maxTime="18:00"
        renderHeader={(api) => <PlannerHeader api={api} />}
      />
      <output id="selection">{selected()}</output>
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
