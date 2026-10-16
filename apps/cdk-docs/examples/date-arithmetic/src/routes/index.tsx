import { signal } from "@rivetjs/reactivity";
import { endOfMonth, getDayOfWeek, getWeeksInMonth, isWeekend, parseDate, startOfWeek, type CalendarDate } from "@rivetjs/cdk/date";

export const head = { title: "Date arithmetic" };

// #region demo
export default function DateMath() {
  // Keep the ISO string in state; CalendarDate objects are rebuilt from it (immutable, cheap).
  const iso = signal("2026-01-31");
  const date = () => parseDate(iso());
  const apply = (change: (d: CalendarDate) => CalendarDate) => iso.set(change(date()).toString());
  const button = "rounded-md border border-slate-300 px-2 py-1 font-mono text-xs";
  return (
    <section class="m-4 grid max-w-lg gap-2 text-sm">
      <p id="value" class="font-mono text-base">
        {iso()}
      </p>
      <div class="flex flex-wrap gap-1">
        <button id="add-month" type="button" class={button} onClick={() => apply((d) => d.add({ months: 1 }))}>
          add({"{ months: 1 }"})
        </button>
        <button id="subtract" type="button" class={button} onClick={() => apply((d) => d.subtract({ years: 1, days: 31 }))}>
          subtract({"{ years: 1, days: 31 }"})
        </button>
        <button id="set-day" type="button" class={button} onClick={() => apply((d) => d.set({ day: 1 }))}>
          set({"{ day: 1 }"})
        </button>
        <button id="cycle" type="button" class={button} onClick={() => apply((d) => d.cycle("month", 11))}>
          cycle("month", 11)
        </button>
        <button id="end" type="button" class={button} onClick={() => apply((d) => endOfMonth(d))}>
          endOfMonth
        </button>
        <button id="reset" type="button" class={button} onClick={() => iso.set("2026-01-31")}>
          reset
        </button>
      </div>
      <dl class="grid grid-cols-[auto_1fr] gap-x-4 font-mono text-xs">
        <dt>startOfWeek(en-US)</dt>
        <dd id="week-us">{startOfWeek(date(), "en-US").toString()}</dd>
        <dt>startOfWeek(de-DE)</dt>
        <dd id="week-de">{startOfWeek(date(), "de-DE").toString()}</dd>
        <dt>getDayOfWeek(en-US)</dt>
        <dd id="weekday">{getDayOfWeek(date(), "en-US")}</dd>
        <dt>isWeekend(en-US)</dt>
        <dd id="weekend">{String(isWeekend(date(), "en-US"))}</dd>
        <dt>getWeeksInMonth(en-US)</dt>
        <dd id="weeks">{getWeeksInMonth(date(), "en-US")}</dd>
      </dl>
    </section>
  );
}
// #endregion
