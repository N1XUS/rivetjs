// Server rendering (resume mode) of `@rivetjs/cdk/scheduler` (Rivet, spec §6): the month view's HTML is final — every
// visible chip with its lane / span custom properties, `+N more` counts and names, labels, weekday headers — nothing
// boots (`data-boot` absent), the whole tree serializes (render throws on a non-resumable capture), and a 1k-event
// month renders within budget (cost log).
import { describe, expect, it } from "vitest";
import { importModule, renderHtml } from "./server.ts";

const source = `
import { Scheduler } from "@rivetjs/cdk/scheduler";
import { signal } from "@rivetjs/reactivity";

const events = [
  { id: "span", title: "Offsite", start: "2031-03-03", end: "2031-03-06", allDay: true },
  { id: "t1", title: "A", start: "2031-03-04T09:00", end: "2031-03-04T10:00" },
  { id: "t2", title: "B", start: "2031-03-04T11:00", end: "2031-03-04T12:00" },
  { id: "t3", title: "C", start: "2031-03-04T13:00", end: "2031-03-04T14:00", color: "success" },
  { id: "t4", title: "D", start: "2031-03-04T15:00", end: "2031-03-04T16:00", cssColor: "#f80" },
];

export function Month() {
  const list = signal(events);
  const date = signal("2031-03-10");
  return (
    <Scheduler
      events={list}
      date={date}
      timeZone="UTC"
      locale="en-US"
      firstDayOfWeek="mon"
      showWeekNumbers
      canMove={(event) => event.id !== "span"}
      onMoreAction={(e) => console.info(e.events.length)}
      onVisibleRangeChange={(r) => console.info(r.start)}
    />
  );
}

export function Week() {
  const list = signal(events);
  return (
    <Scheduler
      events={list}
      defaultView="week"
      defaultDate="2031-03-04"
      timeZone="UTC"
      locale="en-US"
      firstDayOfWeek="mon"
      businessHours={{ start: "09:00", end: "17:00" }}
    />
  );
}

const thousand = Array.from({ length: 1000 }, (_, i) => {
  const day = 1 + (i % 28);
  const hour = 8 + (i % 9);
  const d = "2031-03-" + String(day).padStart(2, "0");
  return { id: "e" + i, title: "Event " + i, start: d + "T" + String(hour).padStart(2, "0") + ":00", end: d + "T" + String(hour).padStart(2, "0") + ":45" };
});
export function Thousand() {
  return <Scheduler events={thousand} defaultDate="2031-03-10" timeZone="UTC" locale="en-US" />;
}
`;

type Fixture = Record<"Month" | "Week" | "Thousand", () => unknown>;
const load = () => importModule<Fixture>("scheduler-ssr-fixture.tsx", source);

describe("Scheduler SSR", () => {
  it("month view HTML is final: chips, geometry, +N more, labels; nothing boots", async () => {
    const { Month } = await load();
    const html = await renderHtml(() => Month());
    expect(html).toMatch(/<div[^>]*role="group"[^>]*class="rv-Scheduler"|<div[^>]*class="rv-Scheduler"[^>]*role="group"/);
    expect(html).toContain('aria-label="Month view, March 2031"');
    expect((html.match(/role="gridcell"/g) ?? []).length).toBe(42);
    expect((html.match(/role="rowheader"/g) ?? []).length).toBe(6);
    // Visible chips: span (lane 1, 3 days), t1 (lane 2); t2–t4 overflow.
    expect(html).toMatch(/data-rv-event-id="span"[^>]*style="[^"]*--rv-scheduler-lane:1;--rv-scheduler-span:3/);
    expect(html).toMatch(/data-rv-event-id="t1"[^>]*style="[^"]*--rv-scheduler-lane:2;--rv-scheduler-span:1/);
    expect(html).not.toContain('data-rv-event-id="t2"');
    expect(html).toMatch(/aria-label="\+3 more, 3 more events on Tuesday, March 4, 2031"[^>]*>(<!--[^>]*-->)*\+3 more/);
    expect(html).toContain('aria-label="A, 9:00 AM to 10:00 AM"');
    expect(html).toMatch(/>Mon</);
    expect(html).not.toMatch(/<script[^>]*\sdata-boot/);
  });

  it("week view HTML is final: slots, geometry, shading, all-day lanes; no now-line; only the time-grid effects boot", async () => {
    const { Week } = await load();
    const html = await renderHtml(() => Week());
    expect(html).toContain('aria-label="Week view, Monday, March 3, 2031 – Sunday, March 9, 2031"');
    expect((html.match(/role="option"/g) ?? []).length).toBe(7 * 48);
    expect((html.match(/role="listbox"/g) ?? []).length).toBe(7);
    expect((html.match(/role="columnheader"/g) ?? []).length).toBe(7);
    expect(html).toMatch(/data-rv-event-id="t1"[^>]*style="[^"]*--rv-scheduler-event-top:37\.5%;--rv-scheduler-event-height:4\.1666/);
    expect(html).toMatch(/data-rv-event-id="span"[^>]*style="[^"]*--rv-scheduler-lane:1;--rv-scheduler-span:3/);
    expect(html).toMatch(/data-rv-day-index="0" data-rv-minutes="480" data-outside-business="true"|data-rv-minutes="480"[^>]*data-outside-business="true"/);
    expect(html).toMatch(/class="rv-SchedulerTimeGrid-scroller"[^>]*style="[^"]*overflow:auto/);
    // Client-only now-line; the scroll effects are the time grid's only boot work (spec §6).
    expect(html).not.toContain("rv-SchedulerTimeGrid-now");
    expect(html).toMatch(/<script[^>]*\sdata-boot/);
  });

  it("1,000 events: month layout + render cost", async () => {
    const { Thousand } = await load();
    await renderHtml(() => Thousand());
    const start = performance.now();
    const runs = 5;
    let html = "";
    for (let i = 0; i < runs; i++) html = await renderHtml(() => Thousand());
    const ms = (performance.now() - start) / runs;
    console.info(`[scheduler-ssr] 1k-event month render ${ms.toFixed(1)} ms, ${(html.length / 1024).toFixed(0)} KB`);
    expect(html).toContain("+");
    expect(ms).toBeLessThan(200);
  });
});
