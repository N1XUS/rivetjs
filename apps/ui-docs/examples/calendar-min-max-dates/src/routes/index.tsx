// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/calendar/min-max-dates.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Calendar } from "@rivetjs/ui/calendar";
import { Description } from "@rivetjs/ui/description";

export const head = { title: "Calendar: Min and Max Dates" };

// #region demo
import { getLocalTimeZone, today } from "@rivetjs/cdk/date";

export function MinMaxDates() {
  const now = today(getLocalTimeZone());
  const minDate = now;
  const maxDate = now.add({ months: 3 });

  return (
    <div class="flex flex-col items-center gap-4">
      <Calendar aria-label="Appointment date" maxValue={maxDate} minValue={minDate}>
        <Calendar.Header>
          <Calendar.Heading />
          <Calendar.NavButton slot="previous" />
          <Calendar.NavButton slot="next" />
        </Calendar.Header>
        <Calendar.Grid>
          <Calendar.GridHeader>{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
          <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
        </Calendar.Grid>
      </Calendar>
      <Description class="text-center">Select a date between today and {maxDate.toString()}</Description>
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
