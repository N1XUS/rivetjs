// Rivet-authored Scheduler demo: unconfirmed and read-only events (own
// implementation on the event model: `data.status` + `renderEvent` + CSS, per-event `isDraggable` / `isResizable`).
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { Scheduler, type SchedulerEvent } from "@rivetjs/ui/scheduler";
import { Lock } from "lucide";

export const head = { title: "Scheduler: Unconfirmed and read-only events" };

// #region demo
type Meta = { status?: "confirmed" | "unconfirmed"; locked?: boolean };

export function PlannerDemo() {
  const selected = signal("Select an event");
  const events = signal<readonly SchedulerEvent<Meta>[]>([
    { id: "standup", title: "Standup", start: "2026-10-20T09:00", end: "2026-10-20T09:30", color: "accent" },
    { id: "offsite", title: "Offsite (pending)", start: "2026-10-21T10:00", end: "2026-10-21T12:00", color: "warning", data: { status: "unconfirmed" } },
    {
      id: "board",
      title: "Board meeting",
      start: "2026-10-22T13:00",
      end: "2026-10-22T15:00",
      color: "danger",
      isDraggable: false,
      isResizable: false,
      data: { locked: true },
    },
    { id: "lunch", title: "Team lunch", start: "2026-10-23T12:00", end: "2026-10-23T13:00", color: "success", data: { status: "unconfirmed" } },
  ]);
  return (
    <section class="grid min-w-0 gap-3">
      <Scheduler
        id="planner"
        events={events}
        defaultView="week"
        defaultDate="2026-10-20"
        renderEvent={(event) => (
          <span class="flex min-w-0 items-center gap-1" data-status={event.data?.status ?? "confirmed"}>
            {event.data?.locked ? <Icon icon={Lock} size={12} class="shrink-0" aria-label="Read-only" /> : null}
            <span class="min-w-0 truncate font-medium">{event.title}</span>
          </span>
        )}
        onEventAction={({ event }) =>
          selected.set(`${event.title}: ${event.data?.status === "unconfirmed" ? "unconfirmed" : "confirmed"}${event.data?.locked ? ", read-only" : ""}`)
        }
        timeZone="UTC"
        locale="en-US"
        firstDayOfWeek="mon"
        aria-label="Team schedule"
        style={{ "--rv-scheduler-height": "420px" }}
        minTime="08:00"
        maxTime="18:00"
      />
      <output id="selected">{selected()}</output>
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
