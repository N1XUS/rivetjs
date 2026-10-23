// Scheduler on a resumed page (month view, string dates). `#agenda` = month of March 2031 with an overflowing day
// (Tue 4: `+3 more`); `#more-count` counts `onMoreAction`. Nothing may boot at load: the month HTML is final.
import { signal } from "@rivetjs/reactivity";
import { MenuItem } from "@rivetjs/cdk/menu";
import { Scheduler, type SchedulerEvent } from "@rivetjs/cdk/scheduler";

const initial: SchedulerEvent[] = [
  { id: "span", title: "Offsite", start: "2031-03-03", end: "2031-03-06", allDay: true },
  { id: "t1", title: "Standup", start: "2031-03-04T09:00", end: "2031-03-04T09:30" },
  { id: "t2", title: "Review", start: "2031-03-04T11:00", end: "2031-03-04T12:00" },
  { id: "t3", title: "Lunch", start: "2031-03-04T13:00", end: "2031-03-04T14:00", color: "success" },
  { id: "t4", title: "Retro", start: "2031-03-04T15:00", end: "2031-03-04T16:00", color: "warning" },
];

export default function SchedulerStory() {
  const events = signal<readonly SchedulerEvent[]>(initial);
  const date = signal("2031-03-10");
  const more = signal(0);
  const moves = signal(0);
  const actions = signal(0);
  const menu = signal(0);
  return (
    <main>
      <p>
        More: <span id="more-count">{String(more())}</span>
      </p>
      <output id="move-count">{String(moves())}</output>
      <output id="action-count">{String(actions())}</output>
      <output id="menu-count">{String(menu())}</output>
      <output id="span-start">{String(events().find((event) => event.id === "span")?.start)}</output>
      <Scheduler
        id="agenda"
        events={events}
        date={date}
        timeZone="UTC"
        locale="en-US"
        firstDayOfWeek="mon"
        onMoreAction={() => more.set(more() + 1)}
        onEventMove={() => moves.set(moves() + 1)}
        onSlotAction={() => actions.set(actions() + 1)}
        renderSlotMenu={() => (
          <MenuItem id="create" onAction={() => menu.set(menu() + 1)}>
            Create event
          </MenuItem>
        )}
        style={{ width: "900px" }}
      />
    </main>
  );
}
