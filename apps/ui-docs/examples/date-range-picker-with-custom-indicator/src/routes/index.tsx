// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/date-range-picker/with-custom-indicator.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { ChevronDown } from "lucide";
import { DateField } from "@rivetjs/ui/date-field";
import { DateRangePicker } from "@rivetjs/ui/date-range-picker";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { RangeCalendar } from "@rivetjs/ui/range-calendar";

export const head = { title: "DateRangePicker: Custom Indicator" };

// #region demo
export function WithCustomIndicator() {
  return (
    <DateRangePicker class="w-80" endName="endDate" startName="startDate">
      <Label>Trip dates</Label>
      <DateField.Group fullWidth>
        <DateField.Input slot="start">{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        <DateRangePicker.RangeSeparator />
        <DateField.Input slot="end">{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        <DateField.Suffix>
          <DateRangePicker.Trigger>
            <DateRangePicker.TriggerIndicator>
              <Icon icon={ChevronDown} size={16} class="size-4" />
            </DateRangePicker.TriggerIndicator>
          </DateRangePicker.Trigger>
        </DateField.Suffix>
      </DateField.Group>
      <Description>Replace the default calendar icon by passing custom children.</Description>
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
      <WithCustomIndicator />
    </div>
  );
}
