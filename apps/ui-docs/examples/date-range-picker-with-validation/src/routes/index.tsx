// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/date-range-picker/with-validation.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { DateField } from "@rivetjs/ui/date-field";
import { DateRangePicker } from "@rivetjs/ui/date-range-picker";
import { FieldError } from "@rivetjs/ui/field-error";
import { Label } from "@rivetjs/ui/label";
import { RangeCalendar } from "@rivetjs/ui/range-calendar";

export const head = { title: "DateRangePicker: Validation" };

// #region demo
import { getLocalTimeZone, today } from "@rivetjs/cdk/date";
import { signal } from "@rivetjs/reactivity";

type DateRange = {
  start: string;
  end: string;
};

export function WithValidation() {
  // Rivet: a controlled value is a two-way signal of `{ start, end }` date strings; ISO date strings compare like the dates.
  const value = signal<DateRange | null>(null);
  const currentDate = today(getLocalTimeZone()).toString();
  const isInvalid = () => {
    const range = value();

    return range != null && (range.start < currentDate || range.end < range.start);
  };

  return (
    <DateRangePicker isRequired class="w-80" endName="endDate" isInvalid={isInvalid} minValue={currentDate} startName="startDate" value={value}>
      <Label>Booking period</Label>
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
      <FieldError>Select a valid range starting today or later.</FieldError>
      <DateRangePicker.Popover>
        <RangeCalendar aria-label="Booking period">
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
      <WithValidation />
    </div>
  );
}
