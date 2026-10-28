// Rivet-authored DatePicker demo: preset shortcuts composed from existing parts.
import { Button } from "@rivetjs/ui/button";
import { Calendar } from "@rivetjs/ui/calendar";
import { DateField } from "@rivetjs/ui/date-field";
import { DatePicker } from "@rivetjs/ui/date-picker";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "DatePicker: Presets" };

// #region demo
import { getLocalTimeZone, today } from "@rivetjs/cdk/date";
import { signal } from "@rivetjs/reactivity";

export function Presets() {
  // Rivet: a controlled value is a two-way signal of the date string.
  const value = signal<string | null>(null);
  const focusedDate = signal(today(getLocalTimeZone()).toString());

  function selectPreset(days: number) {
    const date = today(getLocalTimeZone()).add({ days }).toString();
    value.set(date);
    focusedDate.set(date);
  }

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
          <div class="picker-presets">
            <div class="picker-presets__shortcuts" role="group" aria-label="Date presets">
              <Button id="preset-today" variant="tertiary" size="sm" onPress={() => selectPreset(0)}>
                Today
              </Button>
              <Button id="preset-tomorrow" variant="tertiary" size="sm" onPress={() => selectPreset(1)}>
                Tomorrow
              </Button>
              <Button id="preset-next-week" variant="tertiary" size="sm" onPress={() => selectPreset(7)}>
                Next week
              </Button>
            </div>
            <Calendar value={value} focusedValue={focusedDate} aria-label="Event date">
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
          </div>
        </DatePicker.Popover>
      </DatePicker>
      <Description>Current value: {value() ?? "(empty)"}</Description>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-start justify-center p-6 [:where(&>*)]:max-w-full">
      <Presets />
    </div>
  );
}
