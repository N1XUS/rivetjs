// Scheduler without `timeZone` on a resumed page (week of today): the server lays out in UTC and the page must keep
// that zone (`state.zone`) when it recomputes — `#zone-refresh` writes a copy of the events (the first
// recompute of the normalized events), `scheduler-resume.test.ts` runs it in a non-UTC browser zone.
import { signal } from "@rivetjs/reactivity";
import { Scheduler, type SchedulerEvent } from "@rivetjs/cdk/scheduler";

const zoned = (day: string): readonly SchedulerEvent[] => [{ id: "z", title: "Zoned", start: day + "T09:00:00+00:00[UTC]", end: day + "T10:00:00+00:00[UTC]" }];

export default function SchedulerZoneStory() {
  // Today as state: the server's day ships (keyed state under the derived model, the handler's capture under serialized).
  const events = signal<readonly SchedulerEvent[]>(zoned(new Date().toISOString().slice(0, 10)));
  return (
    <main>
      <button id="zone-refresh" type="button" onClick={() => events.set([...events()])}>
        Refresh
      </button>
      <Scheduler id="zoned" events={events} defaultView="week" locale="en-US" firstDayOfWeek="mon" style={{ width: "900px" }} />
    </main>
  );
}
