import { signal } from "@rivetjs/reactivity";
import {
  CalendarDate,
  CalendarDateTime,
  createCalendar,
  parseAbsolute,
  parseDate,
  parseDateValue,
  parseDuration,
  parseTime,
  parseZonedDateTime,
  stringifyDateValue,
  toCalendar,
  ZonedDateTime,
} from "@rivetjs/cdk/date";

export const head = { title: "Date values in state" };

// #region demo
export default function Serialize() {
  // Resumable state holds strings: stringifyDateValue keeps the class and the calendar.
  const stored = signal(stringifyDateValue(toCalendar(parseDate("2026-01-15"), createCalendar("japanese"))));
  const value = () => parseDateValue(stored());
  const describe = () => {
    const v = value();
    const kind =
      v instanceof ZonedDateTime ? "ZonedDateTime" : v instanceof CalendarDateTime ? "CalendarDateTime" : v instanceof CalendarDate ? "CalendarDate" : "Time";
    return "calendar" in v ? `${kind} (${v.calendar.identifier})` : kind;
  };
  return (
    <section class="m-4 grid max-w-lg gap-2 text-sm">
      <p id="stored" class="font-mono">
        signal: {stored()}
      </p>
      <p id="parsed">parseDateValue → {describe()}</p>
      <div class="flex flex-wrap gap-1">
        <button
          id="zoned"
          type="button"
          class="rounded-md border border-slate-300 px-2 py-1"
          onClick={() => stored.set(stringifyDateValue(parseZonedDateTime("2026-03-29T01:30[Europe/Berlin]").add({ hours: 1 })))}
        >
          Zoned + 1 hour (DST)
        </button>
        <button
          id="time"
          type="button"
          class="rounded-md border border-slate-300 px-2 py-1"
          onClick={() => stored.set(stringifyDateValue(parseTime("09:05").add({ minutes: 90 })))}
        >
          Time + 90 min
        </button>
        <button
          id="absolute"
          type="button"
          class="rounded-md border border-slate-300 px-2 py-1"
          onClick={() => stored.set(stringifyDateValue(parseAbsolute("2026-01-15T12:00:00Z", "America/New_York")))}
        >
          Absolute in New York
        </button>
      </div>
      <p id="duration" class="font-mono text-xs text-slate-600">
        parseDuration("P1DT2H") = {JSON.stringify(parseDuration("P1DT2H"))}
      </p>
    </section>
  );
}
// #endregion
