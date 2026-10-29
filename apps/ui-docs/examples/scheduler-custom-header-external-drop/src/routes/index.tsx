// Rivet-authored Scheduler demo: custom header and external backlog.
// Functional examples adapt the author's MIT-licensed scheduler examples; all code is original or from that MIT-licensed project.
import { signal } from "@rivetjs/reactivity";
import { Scheduler, type SchedulerEvent, type SchedulerView } from "@rivetjs/ui/scheduler";
import { Button } from "@rivetjs/ui/button";
import { Icon } from "@rivetjs/kit/icon";
import { ChevronLeft, ChevronRight } from "lucide";
import { DropListGroup, DropList, Drag, DragPlaceholder } from "@rivetjs/cdk/drag-drop";
import { For } from "@rivetjs/runtime/dom";

export const head = { title: "Scheduler: Custom header and external backlog" };

// #region demo

export function PlannerDemo() {
  const events = signal<readonly SchedulerEvent[]>([{ id: "kickoff", title: "Kickoff", start: "2026-10-20T10:00", end: "2026-10-20T11:00" }]);
  const backlog = signal(["Write release notes", "Review proposal", "Plan Q4"]);
  const dropped = signal("Drop a backlog task onto a day.");
  const view = signal<SchedulerView>("month");
  return (
    <section class="grid min-w-0 gap-3">
      <DropListGroup>
        <DropList
          id="backlog"
          data={backlog()}
          connectedTo={["docs-planner"]}
          sortingDisabled
          class="flex flex-wrap gap-2 rounded-lg border border-slate-300 p-3"
          aria-label="Backlog"
        >
          <For each={backlog()} by={(title) => title}>
            {(title) => (
              <Drag data={title()} class="cursor-grab rounded-md border border-slate-300 px-3 py-2 text-sm" data-task={title()}>
                <span>{title()}</span>
                <DragPlaceholder>
                  <span />
                </DragPlaceholder>
              </Drag>
            )}
          </For>
        </DropList>
        <Scheduler
          id="planner"
          events={events}
          view={view}
          defaultDate="2026-10-20"
          dropGroup="docs-planner"
          onExternalDrop={(drop) => {
            const title = String(drop.item);
            events.set([...events(), { id: `task-${events().length}`, title, start: drop.start, end: drop.end, allDay: drop.allDay, color: "accent" }]);
            backlog.set(backlog().filter((item) => item !== title));
            dropped.set(`${title}: ${String(drop.start)} to ${String(drop.end)} (exclusive)`);
          }}
          renderHeader={(api) => (
            <div class="flex flex-wrap items-center gap-2 p-3">
              <Button id="previous" class="planner-button" onPress={() => api.previous()} aria-label={api.labels.previous()}>
                <Icon icon={ChevronLeft} size={16} />
              </Button>
              <Button id="next" class="planner-button" onPress={() => api.next()} aria-label={api.labels.next()}>
                <Icon icon={ChevronRight} size={16} />
              </Button>
              <h2 id="custom-title" class="grow text-base font-semibold">
                {api.title()}
              </h2>
              <Button id="reset" class="planner-button" onPress={() => api.goTo("2026-10-20")}>
                October plan
              </Button>
              <Button id="custom-week" class="planner-button" onPress={() => api.setView("week")}>
                {api.labels.week()}
              </Button>
              <Button class="planner-button" onPress={() => api.today()}>
                {api.labels.today()}
              </Button>
            </div>
          )}
          timeZone="UTC"
          locale="en-US"
          firstDayOfWeek="mon"
          aria-label="Team schedule"
          style={{ "--rv-scheduler-height": "420px" }}
          minTime="08:00"
          maxTime="18:00"
        />
      </DropListGroup>
      <output id="drop-result">{dropped()}</output>
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
