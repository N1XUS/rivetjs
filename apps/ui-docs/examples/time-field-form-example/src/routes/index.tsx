// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/time-field/form-example.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Clock } from "lucide";
import { Button } from "@rivetjs/ui/button";
import { Description } from "@rivetjs/ui/description";
import { FieldError } from "@rivetjs/ui/field-error";
import { Form } from "@rivetjs/ui/form";
import { Label } from "@rivetjs/ui/label";
import { TimeField } from "@rivetjs/ui/time-field";

export const head = { title: "TimeField: Form Example" };

// #region demo
import { signal } from "@rivetjs/reactivity";

export function FormExample() {
  // Rivet: a controlled value is a two-way signal of the time string; "HH:MM:SS" strings compare like the times.
  const value = signal<string | null>(null);
  const isSubmitting = signal(false);
  const minTime = "09:00:00";
  const maxTime = "17:00:00";
  const isInvalid = () => value() !== null && (value()! < minTime || value()! > maxTime);

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();

    if (!value() || isInvalid()) {
      return;
    }

    isSubmitting.set(true);

    // Simulate API call
    setTimeout(() => {
      console.log("Time submitted:", { time: value() });
      value.set(null);
      isSubmitting.set(false);
    }, 1500);
  };

  return (
    <Form class="flex w-[280px] flex-col gap-4" onSubmit={handleSubmit}>
      <TimeField isRequired class="w-full" isInvalid={isInvalid} maxValue={maxTime} minValue={minTime} name="time" value={value}>
        <Label>Appointment time</Label>
        <TimeField.Group>
          <TimeField.Prefix>
            <Icon icon={Clock} size={16} class="size-4 text-muted" />
          </TimeField.Prefix>
          <TimeField.Input>{(segment) => <TimeField.Segment segment={segment} />}</TimeField.Input>
        </TimeField.Group>
        {isInvalid() ? <FieldError>Time must be between 9:00 AM and 5:00 PM</FieldError> : <Description>Enter a time between 9:00 AM and 5:00 PM</Description>}
      </TimeField>
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
