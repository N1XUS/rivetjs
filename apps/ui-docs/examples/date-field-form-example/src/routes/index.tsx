// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/date-field/form-example.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Calendar } from "lucide";
import { Button } from "@rivetjs/ui/button";
import { DateField } from "@rivetjs/ui/date-field";
import { Description } from "@rivetjs/ui/description";
import { FieldError } from "@rivetjs/ui/field-error";
import { Form } from "@rivetjs/ui/form";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "DateField: Form Example" };

// #region demo
import { getLocalTimeZone, today } from "@rivetjs/cdk/date";
import { signal } from "@rivetjs/reactivity";

export function FormExample() {
  // Rivet: a controlled value is a two-way signal of the date string; ISO date strings compare like the dates.
  const value = signal<string | null>(null);
  const isSubmitting = signal(false);
  const todayDate = today(getLocalTimeZone()).toString();
  const isInvalid = () => value() !== null && value()! < todayDate;

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();

    if (!value() || isInvalid()) {
      return;
    }

    isSubmitting.set(true);

    // Simulate API call
    setTimeout(() => {
      console.log("Date submitted:", { date: value() });
      value.set(null);
      isSubmitting.set(false);
    }, 1500);
  };

  return (
    <Form class="flex w-[280px] flex-col gap-4" onSubmit={handleSubmit}>
      <DateField isRequired class="w-full" isInvalid={isInvalid} minValue={todayDate} name="date" value={value}>
        <Label>Appointment date</Label>
        <DateField.Group>
          <DateField.Prefix>
            <Icon icon={Calendar} size={16} class="size-4 text-muted" />
          </DateField.Prefix>
          <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        </DateField.Group>
        {isInvalid() ? <FieldError>Date must be today or in the future</FieldError> : <Description>Enter a date from today onwards</Description>}
      </DateField>
      <Button class="w-full" isDisabled={!value() || isInvalid()} isPending={isSubmitting()} type="submit" variant="primary">
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
