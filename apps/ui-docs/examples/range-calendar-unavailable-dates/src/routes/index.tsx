// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/range-calendar/unavailable-dates.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Description } from "@rivetjs/ui/description";
import { RangeCalendar } from "@rivetjs/ui/range-calendar";

export const head = { title: "RangeCalendar: Unavailable Dates" };

// #region demo
import type { DateValue } from "@rivetjs/cdk/date";

import { getLocalTimeZone, parseDate, today } from "@rivetjs/cdk/date";

export function UnavailableDates() {
  const now = today(getLocalTimeZone());
  const blockedRanges = [
    [now.add({ days: 2 }).toString(), now.add({ days: 5 }).toString()],
    [now.add({ days: 12 }).toString(), now.add({ days: 13 }).toString()],
  ] as const;

  const isDateUnavailable = (date: DateValue) => {
    return blockedRanges.some(([start, end]) => date.compare(parseDate(start)) >= 0 && date.compare(parseDate(end)) <= 0);
  };

  return (
    <div class="flex flex-col items-center gap-4">
      <RangeCalendar
        aria-label="Trip dates"
        defaultValue={{ end: now.add({ days: 9 }), start: now.add({ days: 6 }) }}
        firstDayOfWeek="mon"
        isDateUnavailable={isDateUnavailable}
      >
        <RangeCalendar.Header>
          <RangeCalendar.Heading />
          <RangeCalendar.NavButton slot="previous" />
          <RangeCalendar.NavButton slot="next" />
        </RangeCalendar.Header>
        <RangeCalendar.Grid>
          <RangeCalendar.GridHeader>{(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}</RangeCalendar.GridHeader>
          <RangeCalendar.GridBody>{(date) => <RangeCalendar.Cell date={date} />}</RangeCalendar.GridBody>
        </RangeCalendar.Grid>
      </RangeCalendar>
      <Description class="text-center">Some days are unavailable</Description>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <UnavailableDates />
    </div>
  );
}
