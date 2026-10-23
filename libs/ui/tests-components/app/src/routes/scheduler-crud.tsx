// Minimal production consumer of the docs' delete/confirmation/selected-range menu flow.
import { signal } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";
import { Scheduler, type SchedulerEvent } from "@rivetjs/ui/scheduler";
import { Button } from "@rivetjs/ui/button";
import { Dropdown } from "@rivetjs/ui/dropdown";

export default function SchedulerCrudStory() {
  const events = signal<readonly SchedulerEvent[]>([{ id: "design", title: "Design review", start: "2026-10-20T10:00", end: "2026-10-20T11:00" }]);
  const pending = signal<string | null>(null);
  return (
    <main data-ui-theme="rivet" data-theme="light" class="min-h-[1200px] p-3 text-foreground">
      <Scheduler
        id="planner"
        events={events}
        defaultDate="2026-10-20"
        timeZone="UTC"
        firstDayOfWeek="mon"
        aria-label="Team schedule"
        renderSlotMenu={(_, context) => <Dropdown.Item id="new-event">{context.selection ? "Create selected range" : "Create event"}</Dropdown.Item>}
        renderEventMenu={(event, context) => (
          <Dropdown.Item
            id="delete-event"
            onAction={() => {
              pending.set(event.id);
              context.close();
            }}
          >
            Delete
          </Dropdown.Item>
        )}
      />
      <Show when={() => pending() !== null}>
        {() => (
          <div class="flex items-center gap-2 p-3" role="group" aria-label="Confirm deletion">
            <p>Delete this event?</p>
            <Button
              id="confirm-delete"
              onPress={() => {
                events.set(events().filter((event) => event.id !== pending()));
                pending.set(null);
              }}
            >
              Delete event
            </Button>
          </div>
        )}
      </Show>
    </main>
  );
}
