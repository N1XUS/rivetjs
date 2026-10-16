// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/date-picker/form-example.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { Calendar } from "@rivetjs/ui/calendar";
import { DateField } from "@rivetjs/ui/date-field";
import { DatePicker } from "@rivetjs/ui/date-picker";
import { Description } from "@rivetjs/ui/description";
import { FieldError } from "@rivetjs/ui/field-error";
import { Form } from "@rivetjs/ui/form";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "DatePicker: Form Example" };

// #region demo
import { getLocalTimeZone, today } from "@rivetjs/cdk/date";
import { signal } from "@rivetjs/reactivity";

export function FormExample() {
  // Rivet: a controlled value is a two-way signal of the date string; ISO date strings compare like the dates.
  const value = signal<string | null>(null);
  const isSubmitting = signal(false);
  const currentDate = today(getLocalTimeZone()).toString();
  const isInvalid = () => value() != null && value()! < currentDate;

  const handleSubmit = (event: SubmitEvent) => {
    event.preventDefault();

    if (!value() || isInvalid()) {
      return;
    }

    isSubmitting.set(true);

    setTimeout(() => {
      value.set(null);
      isSubmitting.set(false);
    }, 1200);
  };

  return (
    <Form class="flex w-72 flex-col gap-3" onSubmit={handleSubmit}>
      <DatePicker isRequired isInvalid={isInvalid} minValue={currentDate} name="appointmentDate" value={value}>
        <Label>Appointment date</Label>
        <DateField.Group fullWidth>
          <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
          <DateField.Suffix>
            <DatePicker.Trigger>
              <DatePicker.TriggerIndicator />
            </DatePicker.Trigger>
          </DateField.Suffix>
        </DateField.Group>
        {isInvalid() ? <FieldError>Date must be today or in the future.</FieldError> : <Description>Choose a valid appointment date.</Description>}
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
