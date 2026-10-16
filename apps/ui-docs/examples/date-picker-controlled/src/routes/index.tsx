// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/date-picker/controlled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { Calendar } from "@rivetjs/ui/calendar";
import { DateField } from "@rivetjs/ui/date-field";
import { DatePicker } from "@rivetjs/ui/date-picker";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "DatePicker: Controlled" };

// #region demo
import { getLocalTimeZone, today } from "@rivetjs/cdk/date";
import { signal } from "@rivetjs/reactivity";

export function Controlled() {
  // Rivet: a controlled value is a two-way signal of the date string.
  const value = signal<string | null>(today(getLocalTimeZone()).toString());

  return (
    <div class="flex w-72 flex-col gap-4">
      <DatePicker name="date" value={value}>
        <Label>Date</Label>
        <DateField.Group fullWidth>
          <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
          <DateField.Suffix>
            <DatePicker.Trigger>
              <DatePicker.TriggerIndicator />
            </DatePicker.Trigger>
          </DateField.Suffix>
        </DateField.Group>
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
      <Description>Current value: {value() ?? "(empty)"}</Description>
      <div class="flex gap-2">
        <Button variant="tertiary" onPress={() => value.set(today(getLocalTimeZone()).toString())}>
          Set today
        </Button>
        <Button variant="tertiary" onPress={() => value.set(null)}>
          Clear
        </Button>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Controlled />
    </div>
  );
}
