// Scheduler live-prop contract (§3.1): change parent signals after mount and inspect the rendered result.
import { afterEach, describe, expect, it, vi } from "vitest";
import { signal } from "@rivetjs/reactivity";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { Scheduler, type SchedulerProps, type SchedulerEvent, type SchedulerState, type SchedulerView } from "../scheduler/index.tsx";
import { schedulerDefaultDuration, schedulerSnap } from "../scheduler/state.ts";

const settle = async () => {
  await flush();
  await new Promise((resolve) => setTimeout(resolve, 40));
  await flush();
};
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function mount() {
  const options = signal<SchedulerProps>({ timeZone: "UTC", locale: "en-US", firstDayOfWeek: "mon", showCurrentTime: false });
  const events = signal<readonly SchedulerEvent[]>([{ id: "a", title: "Original", start: "2031-03-04T09:00+00:00[UTC]", end: "2031-03-04T10:00+00:00[UTC]" }]);
  const view = signal<SchedulerView>("month");
  const date = signal("2031-03-04");
  const state = signal<SchedulerState | null>(null);
  const { container } = render(() => (
    <Scheduler
      events={events}
      view={view}
      date={date}
      stateRef={state}
      timeZone={options().timeZone}
      locale={options().locale}
      firstDayOfWeek={options().firstDayOfWeek}
      hiddenDays={options().hiddenDays}
      weekendDays={options().weekendDays}
      minTime={options().minTime}
      maxTime={options().maxTime}
      slotDuration={options().slotDuration}
      snapDuration={options().snapDuration}
      defaultEventDuration={options().defaultEventDuration}
      businessHours={options().businessHours}
      visibleLanes={options().visibleLanes}
      isReadOnly={options().isReadOnly}
      allowsRangeSelection={options().allowsRangeSelection}
      showCurrentTime={options().showCurrentTime}
      scrollToCurrentTime={options().scrollToCurrentTime}
      showWeekNumbers={options().showWeekNumbers}
      strings={options().strings}
      class={options().class}
      style={options().style}
      aria-label={options()["aria-label"]}
      toolbar={options().toolbar}
      lang={options().lang}
      dir={options().dir}
      data-label={options()["data-label"]}
    />
  ));
  await settle();
  const root = container.querySelector<HTMLElement>("[data-rv-scheduler]")!;
  const set = async (next: Partial<SchedulerProps>) => {
    options.set({ ...options(), ...next });
    await settle();
  };
  const q = (selector: string) => root.querySelector<HTMLElement>(selector)!;
  return { root, q, set, events, view, date, state };
}

describe("Scheduler live props", () => {
  it("events, view and date update the mounted scheduler", async () => {
    const t = await mount();
    t.events.set([{ id: "b", title: "Replacement", start: "2031-03-05", end: "2031-03-06", allDay: true }]);
    await settle();
    expect(t.q('[data-rv-event-id="a"]')).toBeNull();
    expect(t.q('[data-rv-event-id="b"]')?.textContent).toContain("Replacement");
    t.view.set("week");
    await settle();
    expect(t.root.dataset.view).toBe("week");
    expect(t.q(".rv-SchedulerTimeGrid")).not.toBeNull();
    t.date.set("2031-04-04");
    await settle();
    expect(t.q(".rv-SchedulerToolbar-title").textContent).toContain("Apr");
    expect(t.q('[data-rv-event-id="b"]')).toBeNull();
  });

  it("firstDayOfWeek, hiddenDays, weekendDays and week numbers rederive the month", async () => {
    const t = await mount();
    expect(t.q(".rv-SchedulerMonth-weekday").textContent).toBe("Mon");
    await t.set({ firstDayOfWeek: "sun" });
    expect(t.q(".rv-SchedulerMonth-weekday").textContent).toBe("Sun");
    await t.set({ hiddenDays: [0, 6], weekendDays: [1], showWeekNumbers: true });
    expect(t.root.querySelectorAll(".rv-SchedulerMonth-cell")).toHaveLength(30);
    expect(t.root.querySelectorAll(".rv-SchedulerMonth-week-number")).toHaveLength(6);
    expect(t.root.querySelectorAll(".rv-SchedulerMonth-weekday[data-weekend]")).toHaveLength(1);
    expect(t.q(".rv-SchedulerMonth-weekday[data-weekend]").textContent).toBe("Mon");
  });

  it("locale and strings update names without remounting", async () => {
    const t = await mount();
    await t.set({ locale: "de-DE", strings: { scheduler: "Planer", today: "Jetzt" } });
    expect(t.root.getAttribute("aria-label")).toBe("Planer");
    expect(t.q(".rv-SchedulerToolbar-today").textContent).toBe("Jetzt");
    expect(t.q(".rv-SchedulerToolbar-title").textContent).toContain("März");
  });

  it("timeZone moves a zoned event on the visible time axis", async () => {
    const t = await mount();
    t.view.set("day");
    await settle();
    const top = () => t.q('[data-rv-event-id="a"]').style.getPropertyValue("--rv-scheduler-event-top");
    expect(parseFloat(top())).toBe(37.5);
    await t.set({ timeZone: "America/New_York" });
    expect(parseFloat(top())).toBeCloseTo((100 * 4) / 24);
  });

  it("minTime, maxTime, slotDuration and businessHours update the actual slots", async () => {
    const t = await mount();
    t.view.set("day");
    await settle();
    await t.set({ minTime: "08:00", maxTime: "12:00", slotDuration: 60, businessHours: { start: "09:00", end: "11:00" } });
    const slots = [...t.root.querySelectorAll<HTMLElement>(".rv-SchedulerTimeGrid-slot")];
    expect(slots.map((s) => s.dataset.rvMinutes)).toEqual(["480", "540", "600", "660"]);
    expect(slots.filter((s) => s.hasAttribute("data-outside-business"))).toHaveLength(2);
    await t.set({ businessHours: null });
    expect(t.root.querySelectorAll("[data-outside-business]")).toHaveLength(0);
  });

  it("snapDuration and defaultEventDuration are read live by gestures", async () => {
    const t = await mount();
    expect(schedulerSnap(t.state()!)).toBe(30);
    expect(schedulerDefaultDuration(t.state()!)).toBe(60);
    await t.set({ snapDuration: 15, defaultEventDuration: 90 });
    expect(schedulerSnap(t.state()!)).toBe(15);
    expect(schedulerDefaultDuration(t.state()!)).toBe(90);
  });

  it("visibleLanes changes overflow, isReadOnly removes handles, and allowsRangeSelection changes ARIA", async () => {
    const t = await mount();
    t.events.set(Array.from({ length: 5 }, (_, i) => ({ id: String(i), title: String(i), start: "2031-03-04", end: "2031-03-05", allDay: true })));
    await settle();
    expect(t.q(".rv-SchedulerMonth-more").textContent).toBe("+3 more");
    await t.set({ visibleLanes: 6, isReadOnly: true, allowsRangeSelection: false });
    expect(t.q(".rv-SchedulerMonth-more")).toBeNull();
    expect(t.root.querySelectorAll(".rv-SchedulerEvent-resize-handle")).toHaveLength(0);
    expect(t.q(".rv-SchedulerMonth-grid").getAttribute("aria-multiselectable")).toBeNull();
  });

  it("showCurrentTime toggles the now line and scrollToCurrentTime reapplies the scroll", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2031-03-04T10:17:00Z"));
    const t = await mount();
    t.view.set("day");
    await settle();
    expect(t.q(".rv-SchedulerTimeGrid-now")).toBeNull();
    await t.set({ showCurrentTime: true });
    expect(t.q(".rv-SchedulerTimeGrid-now")).not.toBeNull();
    const scroller = t.q(".rv-SchedulerTimeGrid-scroller");
    scroller.style.height = "400px";
    t.q(".rv-SchedulerTimeGrid-top").style.height = "100px";
    for (const slot of t.root.querySelectorAll<HTMLElement>(".rv-SchedulerTimeGrid-slot")) slot.style.height = "40px";
    await t.set({ scrollToCurrentTime: true });
    expect(scroller.scrollTop).toBeCloseTo((617 / 30) * 40 - 250, 0);
    await t.set({ showCurrentTime: false, scrollToCurrentTime: false });
    expect(t.q(".rv-SchedulerTimeGrid-now")).toBeNull();
    expect(scroller.scrollTop).not.toBeCloseTo((617 / 30) * 40 - 250, 0);
  });

  it("class, style, aria-label, toolbar and GlobalDOMAttributes update", async () => {
    const t = await mount();
    await t.set({ class: "custom", style: { width: "321px" }, "aria-label": "Team", toolbar: false, lang: "ro", dir: "rtl", "data-label": "Updated" });
    expect(t.root.className).toBe("custom");
    expect(t.root.style.width).toBe("321px");
    expect(t.root.getAttribute("aria-label")).toBe("Team");
    expect(t.q(".rv-SchedulerToolbar")).toBeNull();
    expect([t.root.lang, t.root.dir, t.root.getAttribute("data-label")]).toEqual(["ro", "rtl", "Updated"]);
  });
});
