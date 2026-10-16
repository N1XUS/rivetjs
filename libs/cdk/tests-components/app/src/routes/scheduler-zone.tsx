// Scheduler without `timeZone` on a resumed page (week of today): the server lays out in UTC and the page must keep
// that zone (`state.zone`, region state) when it recomputes — `#zone-refresh` writes a copy of the events (the first
// recompute of the normalized events), `scheduler-resume.test.ts` runs it in a non-UTC browser zone.
import { signal } from "@rivetjs/reactivity";
import { Scheduler, type SchedulerEvent } from "@rivetjs/cdk/scheduler";

export default function SchedulerZoneStory() {
  const day = new Date().toISOString().slice(0, 10);
  const events = signal<readonly SchedulerEvent[]>([{ id: "z", title: "Zoned", start: day + "T09:00:00+00:00[UTC]", end: day + "T10:00:00+00:00[UTC]" }]);
  return (
    <main>
      <button id="zone-refresh" type="button" onClick={() => events.set([...events()])}>
        Refresh
      </button>
      <Scheduler id="zoned" events={events} defaultView="week" locale="en-US" firstDayOfWeek="mon" style={{ width: "900px" }} />
    </main>
  );
}
