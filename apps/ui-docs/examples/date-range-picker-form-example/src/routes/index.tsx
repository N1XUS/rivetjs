// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/date-range-picker/form-example.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { DateField } from "@rivetjs/ui/date-field";
import { DateRangePicker } from "@rivetjs/ui/date-range-picker";
import { Description } from "@rivetjs/ui/description";
import { FieldError } from "@rivetjs/ui/field-error";
import { Form } from "@rivetjs/ui/form";
import { Label } from "@rivetjs/ui/label";
import { RangeCalendar } from "@rivetjs/ui/range-calendar";

export const head = { title: "DateRangePicker: Form Example" };

// #region demo
import { getLocalTimeZone, today } from "@rivetjs/cdk/date";
import { signal } from "@rivetjs/reactivity";

type DateRange = {
  start: string;
  end: string;
};

export function FormExample() {
  // Rivet: a controlled value is a two-way signal of `{ start, end }` date strings; ISO date strings compare like the dates.
  const value = signal<DateRange | null>(null);
  const isSubmitting = signal(false);
  const currentDate = today(getLocalTimeZone()).toString();
  const isInvalid = () => {
    const range = value();

    return range != null && (range.start < currentDate || range.end < range.start);
  };

  const handleSubmit = (event: SubmitEvent) => {
    event.preventDefault();

    if (!value() || isInvalid()) return;

    isSubmitting.set(true);

    setTimeout(() => {
      value.set(null);
      isSubmitting.set(false);
    }, 1200);
  };

  return (
    <Form class="flex w-80 flex-col gap-3" onSubmit={handleSubmit}>
      <DateRangePicker isRequired endName="tripEndDate" isInvalid={isInvalid} minValue={currentDate} startName="tripStartDate" value={value}>
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
        {isInvalid() ? (
          <FieldError>Please choose a valid range in the future.</FieldError>
        ) : (
          <Description>Select your check-in and check-out dates.</Description>
        )}
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
      <Button class="w-full" isDisabled={!value() || isInvalid()} isPending={isSubmitting()} type="submit">
        {isSubmitting() ? "Submitting..." : "Submit"}
      </Button>
    </Form>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <FormExample />
    </div>
  );
}
