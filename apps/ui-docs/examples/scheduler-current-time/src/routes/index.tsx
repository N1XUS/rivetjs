// Rivet-authored Scheduler demo: current time indicator.
// Functional examples adapt the author's MIT-licensed scheduler examples; no Pro source is used.
import { signal } from "@rivetjs/reactivity";
import { Scheduler } from "@rivetjs/ui/scheduler";
import { Button } from "@rivetjs/ui/button";

export const head = { title: "Scheduler: Current time indicator" };

// #region demo

export function PlannerDemo() {
  const show = signal(true);
  return (
    <section class="grid min-w-0 gap-3">
      <p class="text-sm">Choose Today in the toolbar to show the current UTC date. The current-time line follows the minute clock.</p>
      <Button id="clock-toggle" class="planner-button" onPress={() => show.set(!show())}>
        Current time: {show() ? "on" : "off"}
      </Button>
      <Scheduler
        id="planner"
        defaultView="day"
        defaultDate="2026-10-20"
        minTime="00:00"
        maxTime="24:00"
        slotDuration={60}
        showCurrentTime={show()}
        scrollToCurrentTime
        timeZone="UTC"
        locale="en-US"
        firstDayOfWeek="mon"
        aria-label="Team schedule"
        style={{ "--rv-scheduler-height": "420px" }}
      />
    </section>
  );
}
// #endregion

export default function Demo() {
  return (
    <main class="min-h-dvh min-w-0 p-3 sm:p-5">
      <div class="mx-auto w-full min-w-0 max-w-5xl">
        <PlannerDemo />
      </div>
    </main>
  );
}
