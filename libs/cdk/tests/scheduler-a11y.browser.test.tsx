// Actual axe scans of the headless Scheduler, including detached surfaces (malva scheduler/month/time-grid axe cases).
import { afterEach, expect, it } from "vitest";
import axe from "axe-core";
import { signal } from "@rivetjs/reactivity";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { Scheduler, type SchedulerEvent } from "../scheduler/index.tsx";
import { MenuItem } from "../menu/index.tsx";
import { dispatchKeyboardEvent, dispatchMouseEvent } from "@rivetjs/testing/fake-events";

afterEach(cleanup);
const settle = async () => {
  await flush();
  await new Promise((resolve) => setTimeout(resolve, 40));
  await flush();
};
const events: SchedulerEvent[] = Array.from({ length: 5 }, (_, i) => ({
  id: String(i),
  title: `Event ${i}`,
  start: `2031-03-04T${String(9 + i).padStart(2, "0")}:00`,
  end: `2031-03-04T${String(10 + i).padStart(2, "0")}:00`,
}));

for (const view of ["month", "week", "day"] as const) {
  it(`axe: headless ${view}, selected state, hidden weekdays and open slot/event menus`, async () => {
    const hidden = signal<number[]>([]);
    const list = signal<readonly SchedulerEvent[]>(events);
    const { container } = render(() => (
      <Scheduler
        events={list}
        defaultView={view}
        defaultDate="2031-03-04"
        timeZone="UTC"
        locale="en-US"
        firstDayOfWeek="mon"
        hiddenDays={hidden()}
        showCurrentTime={false}
        renderSlotMenu={() => <MenuItem id="create">Create event</MenuItem>}
        renderEventMenu={() => <MenuItem id="edit">Edit event</MenuItem>}
      />
    ));
    await settle();
    const audit = async (state: string) => {
      const result = await axe.run(document.body, { rules: { region: { enabled: false } } });
      expect(
        result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) })),
        state,
      ).toEqual([]);
    };
    await audit(view);
    const target = container.querySelector<HTMLElement>(view === "month" ? '[role=gridcell][tabindex="0"]' : '[role=option][tabindex="0"]')!;
    target.focus();
    dispatchKeyboardEvent(target, "keydown", undefined, "ArrowDown", { shift: true });
    await settle();
    expect(container.querySelector('[data-selected="true"]')).not.toBeNull();
    await audit("selected");
    dispatchKeyboardEvent(target, "keydown", undefined, "Escape");
    hidden.set([0, 6]);
    await settle();
    expect(container.querySelector("[data-rv-event-id]")).not.toBeNull();
    expect(container.querySelectorAll(view === "month" ? ".rv-SchedulerMonth-weekday" : ".rv-SchedulerTimeGrid-day-header")).toHaveLength(
      view === "day" ? 1 : 5,
    );
    await audit("hidden days");
    const cell = container.querySelector<HTMLElement>(view === "month" ? "[role=gridcell]" : "[role=option]")!;
    dispatchMouseEvent(cell, "contextmenu", 10, 10, undefined, undefined, 2);
    await settle();
    expect(document.querySelector("[role=menu]")).not.toBeNull();
    await audit("slot menu open");
    dispatchKeyboardEvent(document.activeElement!, "keydown", undefined, "Escape");
    await settle();
    const chip = container.querySelector<HTMLElement>("[data-rv-event-id]")!;
    dispatchMouseEvent(chip, "contextmenu", 10, 10, undefined, undefined, 2);
    await settle();
    expect(document.querySelector("[role=menu]")).not.toBeNull();
    await audit("event menu open");
  });
}

it("axe: headless overflow popover open", async () => {
  const { container } = render(() => (
    <Scheduler events={events} defaultView="month" defaultDate="2031-03-04" timeZone="UTC" visibleLanes={2} showCurrentTime={false} />
  ));
  container.querySelector<HTMLElement>("[data-rv-more]")!.click();
  await settle();
  expect(document.querySelector(".rv-SchedulerMonth-popover")).not.toBeNull();
  expect((await axe.run(document.body, { rules: { region: { enabled: false } } })).violations).toEqual([]);
});
