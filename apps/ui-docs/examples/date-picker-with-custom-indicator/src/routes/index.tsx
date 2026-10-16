// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/date-picker/with-custom-indicator.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { ChevronDown } from "lucide";
import { Calendar } from "@rivetjs/ui/calendar";
import { DateField } from "@rivetjs/ui/date-field";
import { DatePicker } from "@rivetjs/ui/date-picker";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "DatePicker: Custom Indicator" };

// #region demo
export function WithCustomIndicator() {
  return (
    <DatePicker class="w-72" name="date">
      <Label>Date</Label>
      <DateField.Group fullWidth>
        <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        <DateField.Suffix>
          <DatePicker.Trigger>
            <DatePicker.TriggerIndicator>
              <Icon icon={ChevronDown} size={16} class="size-4" />
            </DatePicker.TriggerIndicator>
          </DatePicker.Trigger>
        </DateField.Suffix>
      </DateField.Group>
      <Description>Replace the default calendar icon by passing custom children.</Description>
      <DatePicker.Popover>
        <Calendar aria-label="Event date">
          <Calendar.Header>
            <Calendar.YearPickerTrigger>
              <Calendar.YearPickerTriggerHeading />
              <Calendar.YearPickerTriggerIndicator />
            </Calendar.YearPickerTrigger>
            <Calendar.NavButton slot="previous" />
            <Calendar.NavButton slot="next" />
          </Calendar.Header>
          <Calendar.Grid>
            <Calendar.GridHeader>{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
            <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
          </Calendar.Grid>
          <Calendar.YearPickerGrid>
            <Calendar.YearPickerGridBody>{({ year }) => <Calendar.YearPickerCell year={year} />}</Calendar.YearPickerGridBody>
          </Calendar.YearPickerGrid>
        </Calendar>
      </DatePicker.Popover>
    </DatePicker>
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
