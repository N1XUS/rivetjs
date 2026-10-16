// `@rivetjs/cdk/scheduler` dev-only warnings (`DEV` from the cdk `#dev` import; project `cdk-dev`, `development`
// condition): a server-rendered state without `timeZone` (once per process: the page lays out in UTC and the resumed
// page keeps it), and events that are not shown because a date does not parse (once per event object).
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSchedulerState, schedulerNormalizedEvents } from "../scheduler/state.ts";
import type { SchedulerEvent } from "../scheduler/layout.ts";

afterEach(() => vi.restoreAllMocks());

describe("scheduler dev warnings", () => {
  it("warns once when a server-rendered scheduler has no timeZone", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    createSchedulerState({ timeZone: "Europe/Berlin" });
    expect(warn).not.toHaveBeenCalled();
    createSchedulerState();
    createSchedulerState();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toMatch(/^\[rivet:cdk\] scheduler: no `timeZone` on a server-rendered Scheduler/);
  });

  it("warns once per event object whose dates do not parse", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const bad: SchedulerEvent = { id: "bad", title: "Bad", start: "tomorrow", end: "2031-03-04T10:00" };
    const state = createSchedulerState({
      timeZone: "UTC",
      defaultEvents: [{ id: "ok", title: "Ok", start: "2031-03-04T09:00", end: "2031-03-04T10:00" }, bad],
    });
    expect(schedulerNormalizedEvents(state).map((n) => n.event.id)).toEqual(["ok"]);
    schedulerNormalizedEvents(state);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toContain('event "bad" is not shown');
  });
});
