// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/range-calendar/multiple-months.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { RangeCalendar } from "@rivetjs/ui/range-calendar";

export const head = { title: "RangeCalendar: Multiple Months" };

// #region demo
export function MultipleMonths() {
  return (
    <RangeCalendar aria-label="Trip dates" class="@container-normal w-full max-w-none overflow-x-auto" visibleDuration={{ months: 2 }}>
      <div class="mx-auto flex w-max gap-8">
        <div class="w-64">
          <RangeCalendar.Header>
            <RangeCalendar.NavButton slot="previous" />
            <RangeCalendar.Heading class="flex-none" />
            <div class="size-6" />
          </RangeCalendar.Header>
          <RangeCalendar.Grid>
            <RangeCalendar.GridHeader>{(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}</RangeCalendar.GridHeader>
            <RangeCalendar.GridBody>{(date) => <RangeCalendar.Cell date={date} />}</RangeCalendar.GridBody>
          </RangeCalendar.Grid>
        </div>
        <div class="w-64">
          <RangeCalendar.Header>
            <div class="size-6" />
            <RangeCalendar.Heading class="flex-none" offset={{ months: 1 }} />
            <RangeCalendar.NavButton slot="next" />
          </RangeCalendar.Header>
          <RangeCalendar.Grid offset={{ months: 1 }}>
            <RangeCalendar.GridHeader>{(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}</RangeCalendar.GridHeader>
            <RangeCalendar.GridBody>{(date) => <RangeCalendar.Cell date={date} />}</RangeCalendar.GridBody>
          </RangeCalendar.Grid>
        </div>
      </div>
    </RangeCalendar>
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
