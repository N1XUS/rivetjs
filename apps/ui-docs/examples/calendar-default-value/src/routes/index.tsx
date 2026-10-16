// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/calendar/default-value.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Calendar } from "@rivetjs/ui/calendar";

export const head = { title: "Calendar: Default Value" };

// #region demo
import { parseDate } from "@rivetjs/cdk/date";

export function DefaultValue() {
  return (
    <Calendar aria-label="Event date" defaultValue={parseDate("2025-02-14")}>
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
