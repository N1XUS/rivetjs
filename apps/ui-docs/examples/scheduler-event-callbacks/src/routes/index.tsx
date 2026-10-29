// Rivet-authored Scheduler demo: every editing callback writes one line to a log (section "Event Callbacks" of HeroUI Pro's
// public Agenda docs; own content, no Pro source).
import { signal } from "@rivetjs/reactivity";
import { Scheduler, type SchedulerEvent } from "@rivetjs/ui/scheduler";

export const head = { title: "Scheduler: Event callbacks" };

// #region demo
export function EventCallbacks() {
  const nextId = signal(1);
  const log = signal<readonly string[]>(["Select empty slots, move, resize, open or delete an event."]);
  const write = (line: string) => log.set([line, ...log()].slice(0, 5));
  const events = signal<readonly SchedulerEvent[]>([
    { id: "standup", title: "Standup", start: "2026-10-20T09:00", end: "2026-10-20T09:30", color: "accent" },
    { id: "review", title: "Design review", start: "2026-10-21T13:00", end: "2026-10-21T14:00" },
    { id: "retro", title: "Retro", start: "2026-10-23T15:00", end: "2026-10-23T16:00", color: "success" },
  ]);
  return (
    <section class="grid min-w-0 gap-3">
      <Scheduler
        id="callbacks"
        events={events}
        defaultView="week"
        defaultDate="2026-10-20"
        onRangeSelect={(range) => {
          const id = `new-${nextId()}`;
          nextId.set(nextId() + 1);
          events.set([...events(), { id, title: "New event", start: range.start, end: range.end, allDay: range.allDay }]);
          write(`onRangeSelect (${range.source}): created ${id}`);
        }}
        onEventMove={({ event, source }) => write(`onEventMove (${source}): ${event.title} starts ${String(event.start)}`)}
        onEventResize={({ event, source }) => write(`onEventResize (${source}): ${event.title} ends ${String(event.end)}`)}
        onEventAction={({ event }) => write(`onEventAction: opened ${event.title}`)}
        onEventDelete={({ event }) => {
          events.set(events().filter((e) => e.id !== event.id));
          write(`onEventDelete: removed ${event.title}`);
        }}
        timeZone="UTC"
        locale="en-US"
        firstDayOfWeek="mon"
        aria-label="Team schedule"
        style={{ "--rv-scheduler-height": "420px" }}
        minTime="08:00"
        maxTime="18:00"
      />
      <ol id="callback-log" class="grid gap-1 text-sm text-muted" aria-live="polite">
        {log().map((line) => (
          <li>{line}</li>
        ))}
      </ol>
    </section>
  );
}
// #endregion

export default function Demo() {
  return (
    <main class="min-h-dvh min-w-0 p-3 sm:p-5">
      <div class="mx-auto w-full min-w-0 max-w-5xl">
        <EventCallbacks />
      </div>
    </main>
  );
}
