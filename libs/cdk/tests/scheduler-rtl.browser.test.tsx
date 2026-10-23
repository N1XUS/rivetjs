// Direction is inherited from the nearest dir scope, independently of the language of that scope.
import { afterEach, expect, it } from "vitest";
import { signal } from "@rivetjs/reactivity";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { dispatchKeyboardEvent } from "@rivetjs/testing/fake-events";
import { Scheduler, type SchedulerEvent } from "../scheduler/index.tsx";

afterEach(cleanup);
const settle = async () => {
  await flush();
  await new Promise((resolve) => setTimeout(resolve, 40));
  await flush();
};

for (const dir of ["ltr", "rtl"] as const) {
  for (const lang of ["en", "ar"] as const) {
    it(`keyboard move and both resize edges follow nearest ${dir} scope with lang=${lang}`, async () => {
      const events = signal<readonly SchedulerEvent[]>([{ id: "a", title: "A", start: "2031-03-04", end: "2031-03-07", allDay: true }]);
      const opposite = dir === "rtl" ? "ltr" : "rtl";
      const { container } = render(() => (
        <div dir={opposite} lang={lang}>
          <div dir={dir}>
            <Scheduler events={events} defaultDate="2031-03-04" timeZone="UTC" locale="en-US" firstDayOfWeek="mon" showCurrentTime={false} />
          </div>
        </div>
      ));
      await settle();
      expect(document.documentElement.dir).not.toBe("rtl");
      const chip = () => container.querySelector<HTMLElement>('[data-rv-event-id="a"]')!;
      expect(getComputedStyle(chip()).direction).toBe(dir);
      chip().focus();
      const next = dir === "rtl" ? "ArrowLeft" : "ArrowRight";
      dispatchKeyboardEvent(chip(), "keydown", undefined, next, { alt: true });
      await settle();
      expect(events()[0]).toMatchObject({ start: "2031-03-05", end: "2031-03-08" });
      dispatchKeyboardEvent(chip(), "keydown", undefined, next, { alt: true, shift: true });
      await settle();
      expect(events()[0]).toMatchObject({ start: "2031-03-05", end: "2031-03-09" });
      dispatchKeyboardEvent(chip(), "keydown", undefined, next, { alt: true, control: true });
      await settle();
      expect(events()[0]).toMatchObject({ start: "2031-03-06", end: "2031-03-09" });
      expect(document.activeElement?.getAttribute("data-rv-event-id")).toBe("a");
    });
  }
  it(`overflow chips retain scoped ${dir} direction for keyboard movement after portaling`, async () => {
    const events = signal<readonly SchedulerEvent[]>(
      Array.from({ length: 4 }, (_, i) => ({ id: String(i), title: `Event ${i}`, start: "2031-03-04T09:00", end: "2031-03-04T10:00" })),
    );
    const { container } = render(() => (
      <div dir={dir} lang={dir === "rtl" ? "en" : "ar"}>
        <Scheduler events={events} defaultDate="2031-03-04" timeZone="UTC" locale="en-US" firstDayOfWeek="mon" visibleLanes={2} showCurrentTime={false} />
      </div>
    ));
    await settle();
    container.querySelector<HTMLElement>("[data-rv-more]")!.click();
    await settle();
    const panel = document.querySelector<HTMLElement>(".rv-SchedulerMonth-popover")!;
    expect(getComputedStyle(panel).direction).toBe(dir);
    const chip = panel.querySelector<HTMLElement>('[data-rv-event-id="0"]')!;
    chip.focus();
    dispatchKeyboardEvent(chip, "keydown", undefined, dir === "rtl" ? "ArrowLeft" : "ArrowRight", { alt: true });
    await settle();
    expect(events().find((event) => event.id === "0")).toMatchObject({ start: "2031-03-05T09:00:00", end: "2031-03-05T10:00:00" });
  });
}
