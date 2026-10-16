// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/range-calendar/anchor-unavailable-dates.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Description } from "@rivetjs/ui/description";
import { RangeCalendar } from "@rivetjs/ui/range-calendar";

export const head = { title: "RangeCalendar: Anchor-Based Unavailable Dates" };

// #region demo
import type { CalendarDate, DateValue } from "@rivetjs/cdk/date";

import { getLocalTimeZone, today } from "@rivetjs/cdk/date";

export function AnchorUnavailableDates() {
  const now = today(getLocalTimeZone());

  const isDateUnavailable = (date: DateValue, anchorDate: CalendarDate | null) => {
    return anchorDate != null && Math.abs(date.compare(anchorDate)) > 7;
  };

  return (
    <div class="flex flex-col items-center gap-4">
      <RangeCalendar aria-label="Trip dates" isDateUnavailable={isDateUnavailable} minValue={now}>
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
      <Description class="text-center">After selecting a start date, only dates within 7 days are available</Description>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <AnchorUnavailableDates />
    </div>
  );
}
