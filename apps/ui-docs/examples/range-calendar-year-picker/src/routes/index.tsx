// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/range-calendar/year-picker.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { RangeCalendar } from "@rivetjs/ui/range-calendar";

export const head = { title: "RangeCalendar: Year Picker" };

// #region demo
export function YearPicker() {
  return (
    <RangeCalendar aria-label="Trip dates">
      <RangeCalendar.Header>
        <RangeCalendar.YearPickerTrigger>
          <RangeCalendar.YearPickerTriggerHeading />
          <RangeCalendar.YearPickerTriggerIndicator />
        </RangeCalendar.YearPickerTrigger>
        <RangeCalendar.NavButton slot="previous" />
        <RangeCalendar.NavButton slot="next" />
      </RangeCalendar.Header>
      <RangeCalendar.Grid>
        <RangeCalendar.GridHeader>{(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}</RangeCalendar.GridHeader>
        <RangeCalendar.GridBody>{(date) => <RangeCalendar.Cell date={date} />}</RangeCalendar.GridBody>
      </RangeCalendar.Grid>
      <RangeCalendar.YearPickerGrid>
        <RangeCalendar.YearPickerGridBody>{({ year }) => <RangeCalendar.YearPickerCell year={year} />}</RangeCalendar.YearPickerGridBody>
      </RangeCalendar.YearPickerGrid>
    </RangeCalendar>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <YearPicker />
    </div>
  );
}
