// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/calendar/multiple-months.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Calendar } from "@rivetjs/ui/calendar";

export const head = { title: "Calendar: Multiple Months" };

// #region demo
export function MultipleMonths() {
  return (
    <Calendar aria-label="Trip dates" class="@container-normal w-full max-w-none overflow-x-auto" visibleDuration={{ months: 2 }}>
      <div class="mx-auto flex w-max gap-8">
        <div class="w-64">
          <Calendar.Header>
            <Calendar.NavButton slot="previous" />
            <Calendar.Heading class="flex-none" />
            <div class="size-6" />
          </Calendar.Header>
          <Calendar.Grid>
            <Calendar.GridHeader>{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
            <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
          </Calendar.Grid>
        </div>
        <div class="w-64">
          <Calendar.Header>
            <div class="size-6" />
            <Calendar.Heading class="flex-none" offset={{ months: 1 }} />
            <Calendar.NavButton slot="next" />
          </Calendar.Header>
          <Calendar.Grid offset={{ months: 1 }}>
            <Calendar.GridHeader>{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
            <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
          </Calendar.Grid>
        </div>
      </div>
    </Calendar>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <MultipleMonths />
    </div>
  );
}
