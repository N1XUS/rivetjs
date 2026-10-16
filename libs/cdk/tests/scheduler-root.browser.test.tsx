// Ported from @malva-ui/scheduler (src/lib/scheduler/scheduler.spec.ts, root cases), MIT, © 2026 Malva UI.
// Changes:
// - `<mlv-scheduler>` with `[(events)]` / `[(view)]` / `[(date)]` → `<Scheduler>` with two-way Signals and string dates
//   (September 2026, `firstDayOfWeek="mon"`, UTC); `.mlv-scheduler__*` → `.rv-SchedulerToolbar*`; the segmented control
//   → a cdk `ToggleButtonGroup` (radios); `mlvSchedulerHeaderDef` → `renderHeader(api)` with accessors.
// - `mlv-scheduler--month` / `--compact` classes → `data-view` (density is `@rivetjs/ui`, T11).
// - Cases whose logic lives in the state functions are ported in `scheduler-state.test.ts` (visible range +
//   `onVisibleRangeChange` rule, commit move / resize / all-day end / veto / unknown event, window parsing, snap
//   default, announcements alternate); "keyboard focus restore across segments" / "delete keys" in
//   `scheduler-keyboard.browser.test.tsx`; "scrollToTime" in `scheduler-time-grid.browser.test.tsx`; "defaults
//   scrollToCurrentTime … bare attribute" has no counterpart (no attribute coercion in JSX).
// - "announces a period change once, from wherever the range moved" (a bound write announces): Rivet ruling —
//   caller writes to its own `date` never fire `onVisibleRangeChange` nor announce; the case asserts that instead.
// - axe sweeps → T12 (`scheduler-a11y`); RTL toolbar: `dir="rtl"` wrapper instead of `MlvRtlService`.
import { afterEach, describe, expect, it } from "vitest";
import { signal } from "@rivetjs/reactivity";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { Scheduler, schedulerNext, schedulerPrevious, type SchedulerEvent, type SchedulerState, type SchedulerView } from "../scheduler/index.tsx";
import { dateLabel, schedulerDays } from "../scheduler/state.ts";
import { dayFromCivil, todayDay, civilFromDay } from "../scheduler/dates.ts";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const settle = async () => {
  for (let i = 0; i < 3; i++) await flush();
  await sleep(30);
  await flush();
};

afterEach(async () => {
  cleanup();
  await flush();
});

interface Options {
  customHeader?: boolean;
  dir?: "rtl";
}

async function mount(options: Options = {}) {
  const events = signal<readonly SchedulerEvent[]>([{ id: "a", title: "Standup", start: "2026-09-02T09:00", end: "2026-09-02T09:30" }]);
  const view = signal<SchedulerView>("month");
  const date = signal("2026-09-02");
  const hiddenDays = signal<number[]>([]);
  const toolbar = signal(true);
  const ariaLabel = signal<string | undefined>(undefined);
  const stateRef = signal<SchedulerState | null>(null);
  const { container } = render(() => (
    <div dir={options.dir}>
      <Scheduler
        events={events}
        view={view}
        date={date}
        timeZone="UTC"
        locale="en-US"
        firstDayOfWeek="mon"
        hiddenDays={hiddenDays()}
        toolbar={toolbar()}
        aria-label={ariaLabel()}
        showCurrentTime={false}
        stateRef={stateRef}
        renderHeader={
          options.customHeader
            ? (api) => (
                <div class="custom-header">
                  <span class="custom-title">{api.title()}</span>
                  <span class="custom-view">{api.view()}</span>
                  <button type="button" class="custom-next" onClick={() => api.next()}>
                    n
                  </button>
                  <button type="button" class="custom-week" onClick={() => api.setView("week")}>
                    w
                  </button>
                  <button type="button" class="custom-goto" onClick={() => api.goTo("2026-12-25")}>
                    g
                  </button>
                </div>
              )
            : undefined
        }
      />
    </div>
  ));
  await settle();
  const root = container.querySelector<HTMLElement>("[data-rv-scheduler]")!;
  const q = <E extends HTMLElement = HTMLElement>(selector: string) => root.querySelector<E>(selector);
  const live = () =>
    [...root.querySelectorAll("[role=status]")]
      .map((node) => node.textContent ?? "")
      .join("")
      .trim();
  return { root, q, live, events, view, date, hiddenDays, toolbar, ariaLabel, state: () => stateRef()! };
}

describe("Scheduler root", () => {
  it("renders the default toolbar with the month title and view switch", async () => {
    const t = await mount();
    expect(t.q(".rv-SchedulerToolbar-title")!.textContent!.trim()).toBe("September 2026");
    expect(t.q(".rv-SchedulerToolbar-title")!.tagName).toBe("H2");
    expect(t.q(".rv-SchedulerToolbar")).not.toBeNull();
    const views = t.root.querySelectorAll(".rv-SchedulerToolbar-views .rv-SchedulerToolbar-view");
    expect(views.length).toBe(3);
    expect([...views].map((v) => v.textContent!.trim())).toEqual(["Month", "Week", "Day"]);
    expect(t.q(".rv-SchedulerToolbar-views")!.getAttribute("aria-label")).toBe("View");
    expect(t.q(".rv-SchedulerToolbar-views")!.getAttribute("role")).toBe("radiogroup");
    expect(views[0]!.getAttribute("aria-checked")).toBe("true");
    expect(t.root.getAttribute("aria-label")).toBe("Scheduler");
    expect(t.root.getAttribute("data-view")).toBe("month");
  });

  it("labels the icon-less previous / next buttons per view", async () => {
    const t = await mount();
    expect(t.q(".rv-SchedulerToolbar-previous")!.getAttribute("aria-label")).toBe("Previous month");
    expect(t.q(".rv-SchedulerToolbar-next")!.getAttribute("aria-label")).toBe("Next month");
    expect(t.q(".rv-SchedulerToolbar-previous")!.textContent).toBe("");
    t.view.set("week");
    await settle();
    expect(t.q(".rv-SchedulerToolbar-next")!.getAttribute("aria-label")).toBe("Next week");
    t.view.set("day");
    await settle();
    expect(t.q(".rv-SchedulerToolbar-previous")!.getAttribute("aria-label")).toBe("Previous day");
  });

  it("navigates with the toolbar buttons and writes the date model", async () => {
    const t = await mount();
    t.q(".rv-SchedulerToolbar-next")!.click();
    await settle();
    expect(t.date()).toBe("2026-10-02");
    expect(t.q(".rv-SchedulerToolbar-title")!.textContent!.trim()).toBe("October 2026");
    t.q(".rv-SchedulerToolbar-previous")!.click();
    await settle();
    expect(t.date()).toBe("2026-09-02");
    t.q(".rv-SchedulerToolbar-today")!.click();
    await settle();
    const [y, m, d] = civilFromDay(todayDay("UTC"));
    expect(t.date()).toBe(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    expect(t.q(".rv-SchedulerToolbar-today")!.textContent!.trim()).toBe("Today");
  });

  it("steps by week / day in the other views and formats their titles", async () => {
    const t = await mount();
    t.view.set("week");
    await settle();
    expect(t.root.getAttribute("data-view")).toBe("week");
    const title = t.q(".rv-SchedulerToolbar-title")!.textContent!;
    expect(title).toMatch(/Aug 31/);
    expect(title).toMatch(/Sep 6/);
    schedulerNext(t.state());
    await settle();
    expect(t.date()).toBe("2026-09-09");
    t.view.set("day");
    await settle();
    schedulerPrevious(t.state());
    await settle();
    expect(t.date()).toBe("2026-09-08");
    expect(t.q(".rv-SchedulerToolbar-title")!.textContent!.trim()).toBe(dateLabel(dayFromCivil(2026, 9, 8), "en-US"));
  });

  it("switches the view through the segmented control", async () => {
    const t = await mount();
    const items = t.root.querySelectorAll<HTMLElement>(".rv-SchedulerToolbar-view");
    items[1]!.click();
    await settle();
    expect(t.view()).toBe("week");
    expect(t.q(".rv-SchedulerTimeGrid")).not.toBeNull();
    expect(t.q(".rv-SchedulerMonth")).toBeNull();
    expect(t.root.querySelectorAll(".rv-SchedulerToolbar-view")[1]!.getAttribute("aria-checked")).toBe("true");
    // The checked view stays checked on a second press (disallowEmptySelection).
    t.root.querySelectorAll<HTMLElement>(".rv-SchedulerToolbar-view")[1]!.click();
    await settle();
    expect(t.view()).toBe("week");
  });

  it("follows a view written from outside", async () => {
    const t = await mount();
    t.view.set("day");
    await settle();
    expect(t.root.querySelectorAll(".rv-SchedulerToolbar-view")[2]!.getAttribute("aria-checked")).toBe("true");
  });

  it("renders a header def instead of the toolbar and exposes the header api", async () => {
    const t = await mount({ customHeader: true });
    expect(t.q(".rv-SchedulerToolbar")).toBeNull();
    expect(t.q(".custom-title")!.textContent).toBe("September 2026");
    t.q(".custom-next")!.click();
    await settle();
    expect(t.q(".custom-title")!.textContent).toBe("October 2026");
    t.q(".custom-week")!.click();
    await settle();
    expect(t.q(".custom-view")!.textContent).toBe("week");
    expect(t.view()).toBe("week");
    t.q(".custom-goto")!.click();
    await settle();
    expect(t.date()).toBe("2026-12-25");
    expect(t.q(".custom-title")!.textContent).toMatch(/Dec 21/);
  });

  it("hides the toolbar with toolbar={false} (live) and honours aria-label", async () => {
    const t = await mount();
    t.toolbar.set(false);
    t.ariaLabel.set("Team calendar");
    await settle();
    expect(t.q(".rv-SchedulerToolbar")).toBeNull();
    expect(t.root.getAttribute("aria-label")).toBe("Team calendar");
    t.toolbar.set(true);
    await settle();
    expect(t.q(".rv-SchedulerToolbar")).not.toBeNull();
  });

  it("announces navigation through the polite live region", async () => {
    const t = await mount();
    expect(t.live()).toBe("");
    t.q(".rv-SchedulerToolbar-next")!.click();
    await settle();
    expect(t.live()).toBe("Showing October 2026");
  });

  it("never announces a caller's own write to the date model (Rivet ruling)", async () => {
    const t = await mount();
    t.date.set("2026-10-02");
    await settle();
    expect(t.q(".rv-SchedulerToolbar-title")!.textContent!.trim()).toBe("October 2026");
    expect(t.live()).toBe("");
  });

  describe("hiddenDays", () => {
    it("never blanks the day view and steps over hidden weekdays", async () => {
      const t = await mount();
      t.hiddenDays.set([0, 6]);
      t.view.set("day");
      t.date.set("2026-09-04"); // Friday
      await settle();
      expect(schedulerDays(t.state())).toEqual([dayFromCivil(2026, 9, 4)]);
      t.q(".rv-SchedulerToolbar-next")!.click();
      await settle();
      expect(t.date()).toBe("2026-09-07");
      expect(t.root.querySelectorAll(".rv-SchedulerTimeGrid-column")).toHaveLength(1);
      t.q(".rv-SchedulerToolbar-previous")!.click();
      await settle();
      expect(t.date()).toBe("2026-09-04");
    });

    it("still renders an anchor pointed straight at a hidden weekday", async () => {
      const t = await mount();
      t.hiddenDays.set([0, 6]);
      t.view.set("day");
      t.date.set("2026-09-05"); // Saturday
      await settle();
      expect(schedulerDays(t.state())).toEqual([dayFromCivil(2026, 9, 5)]);
      expect(t.root.querySelectorAll(".rv-SchedulerTimeGrid-column")).toHaveLength(1);
      expect(t.root.querySelectorAll("[role=gridcell]").length).toBeGreaterThan(0);
    });

    it("keeps filtering the week view", async () => {
      const t = await mount();
      t.hiddenDays.set([0, 6]);
      t.view.set("week");
      await settle();
      expect(schedulerDays(t.state())).toHaveLength(5);
      expect(t.root.querySelectorAll(".rv-SchedulerTimeGrid-column")).toHaveLength(5);
    });
  });

  describe("direction", () => {
    it("keeps the toolbar order and semantics in RTL (mirroring is CSS only)", async () => {
      const t = await mount({ dir: "rtl" });
      expect(getComputedStyle(t.root).direction).toBe("rtl");
      const buttons = [...t.root.querySelectorAll<HTMLElement>(".rv-SchedulerToolbar-nav button")];
      expect(buttons.map((b) => b.getAttribute("aria-label") ?? b.textContent!.trim())).toEqual(["Previous month", "Next month", "Today"]);
      t.q(".rv-SchedulerToolbar-next")!.click();
      await settle();
      expect(t.q(".rv-SchedulerToolbar-title")!.textContent).toContain("October 2026");
    });
  });
});
