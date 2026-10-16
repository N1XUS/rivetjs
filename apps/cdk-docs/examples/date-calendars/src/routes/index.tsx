import { signal } from "@rivetjs/reactivity";
import { createCalendar, DateFormatter, parseDate, toCalendar, type CalendarIdentifier } from "@rivetjs/cdk/date";

export const head = { title: "Calendar systems" };

const calendars: CalendarIdentifier[] = ["gregory", "japanese", "buddhist", "hebrew", "islamic-umalqura", "persian", "indian", "ethiopic", "roc"];

// #region demo
export default function Calendars() {
  const id = signal<CalendarIdentifier>("japanese");
  const converted = () => toCalendar(parseDate("2026-01-15"), createCalendar(id()));
  const formatted = () => new DateFormatter(`en-US-u-ca-${id()}`, { dateStyle: "long", timeZone: "UTC" }).format(converted().toDate("UTC"));
  return (
    <section class="m-4 grid max-w-lg gap-2 text-sm">
      <div role="group" aria-label="Calendar" class="flex flex-wrap gap-1">
        {calendars.map((calendar) => (
          <button
            id={calendar}
            type="button"
            aria-pressed={calendar === id() ? "true" : "false"}
            class="rounded-md border border-slate-300 px-2 py-1 font-mono text-xs aria-pressed:bg-teal-700 aria-pressed:text-white"
            onClick={() => id.set(calendar)}
          >
            {calendar}
          </button>
        ))}
      </div>
      <p class="text-slate-500">2026-01-15 (Gregorian) is</p>
      <p id="fields" class="font-mono">
        era {converted().era}, year {converted().year}, month {converted().month}, day {converted().day}
      </p>
      <p id="formatted">{formatted()}</p>
    </section>
  );
}
// #endregion
