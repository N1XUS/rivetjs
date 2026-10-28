// Rivet-authored DateRangePicker demo: preset shortcuts composed from existing parts.
import { Button } from "@rivetjs/ui/button";
import { DateField } from "@rivetjs/ui/date-field";
import { DateRangePicker } from "@rivetjs/ui/date-range-picker";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { RangeCalendar } from "@rivetjs/ui/range-calendar";

export const head = { title: "DateRangePicker: Presets" };

// #region demo
import { endOfMonth, endOfYear, getLocalTimeZone, startOfMonth, startOfYear, today } from "@rivetjs/cdk/date";
import { signal } from "@rivetjs/reactivity";

type DateRange = {
  start: string;
  end: string;
};

export function Presets() {
  // Rivet: a controlled value is a two-way signal of `{ start, end }` date strings.
  const value = signal<DateRange | null>(null);
  const focusedDate = signal(today(getLocalTimeZone()).toString());

  function selectPreset(preset: "week" | "month" | "this-month" | "this-year") {
    const date = today(getLocalTimeZone());
    const start =
      preset === "this-year" ? startOfYear(date) : preset === "this-month" ? startOfMonth(date) : date.subtract({ days: preset === "week" ? 6 : 29 });
    const end = preset === "this-year" ? endOfYear(date) : preset === "this-month" ? endOfMonth(date) : date;
    value.set({ start: start.toString(), end: end.toString() });
    focusedDate.set(start.toString());
  }

  return (
    <div class="flex w-80 flex-col gap-4">
      <DateRangePicker endName="endDate" startName="startDate" value={value}>
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
        <DateRangePicker.Popover>
          <div class="picker-presets">
            <div class="picker-presets__shortcuts" role="group" aria-label="Date presets">
              <Button id="preset-week" variant="tertiary" size="sm" onPress={() => selectPreset("week")}>
                Last 7 days
              </Button>
              <Button id="preset-month" variant="tertiary" size="sm" onPress={() => selectPreset("month")}>
                Last 30 days
              </Button>
              <Button id="preset-this-month" variant="tertiary" size="sm" onPress={() => selectPreset("this-month")}>
                This month
              </Button>
              <Button id="preset-this-year" variant="tertiary" size="sm" onPress={() => selectPreset("this-year")}>
                This year
              </Button>
            </div>
            <RangeCalendar value={value} focusedValue={focusedDate} aria-label="Trip dates">
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
          </div>
        </DateRangePicker.Popover>
      </DateRangePicker>
      <Description>Current value: {value() ? `${value()!.start} -> ${value()!.end}` : "(empty)"}</Description>
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
