// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/range-calendar/default-value.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { RangeCalendar } from "@rivetjs/ui/range-calendar";

export const head = { title: "RangeCalendar: Default Value" };

// #region demo
import { parseDate } from "@rivetjs/cdk/date";

export function DefaultValue() {
  return (
    <RangeCalendar aria-label="Trip dates" defaultValue={{ end: parseDate("2025-02-12"), start: parseDate("2025-02-03") }} firstDayOfWeek="mon">
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
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <DefaultValue />
    </div>
  );
}
