// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/date-range-picker/disabled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { DateField } from "@rivetjs/ui/date-field";
import { DateRangePicker } from "@rivetjs/ui/date-range-picker";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { RangeCalendar } from "@rivetjs/ui/range-calendar";

export const head = { title: "DateRangePicker: Disabled" };

// #region demo
import { getLocalTimeZone, today } from "@rivetjs/cdk/date";

export function Disabled() {
  // Rivet: resumable code captures plain data — the dates in their string form (date instances are not serializable).
  const start = today(getLocalTimeZone()).toString();
  const end = today(getLocalTimeZone()).add({ days: 4 }).toString();

  return (
    <DateRangePicker isDisabled class="w-80" endName="endDate" startName="startDate" value={{ end, start }}>
      <Label>Trip dates</Label>
      <DateField.Group fullWidth>
        <DateField.Input slot="start">{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        <DateRangePicker.RangeSeparator />
        <DateField.Input slot="end">{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        <DateField.Suffix>
          <DateRangePicker.Trigger>
            <DateRangePicker.TriggerIndicator />
          </DateRangePicker.Trigger>
        </DateField.Suffix>
      </DateField.Group>
      <Description>This date range picker is disabled.</Description>
      <DateRangePicker.Popover>
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
      </DateRangePicker.Popover>
    </DateRangePicker>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Disabled />
    </div>
  );
}
