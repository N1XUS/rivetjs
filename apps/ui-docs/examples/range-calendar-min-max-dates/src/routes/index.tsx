// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/range-calendar/min-max-dates.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Description } from "@rivetjs/ui/description";
import { RangeCalendar } from "@rivetjs/ui/range-calendar";

export const head = { title: "RangeCalendar: Min and Max Dates" };

// #region demo
import { getLocalTimeZone, today } from "@rivetjs/cdk/date";

export function MinMaxDates() {
  const now = today(getLocalTimeZone());
  const minDate = now;
  const maxDate = now.add({ months: 3 });

  return (
    <div class="flex flex-col items-center gap-4">
      <RangeCalendar aria-label="Trip dates" maxValue={maxDate} minValue={minDate}>
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
      <Description class="text-center">Select dates between today and {maxDate.toString()}</Description>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <MinMaxDates />
    </div>
  );
}
