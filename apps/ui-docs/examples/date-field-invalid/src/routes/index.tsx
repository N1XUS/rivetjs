// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/date-field/invalid.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { DateField } from "@rivetjs/ui/date-field";
import { FieldError } from "@rivetjs/ui/field-error";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "DateField: Validation" };

// #region demo
export function Invalid() {
  return (
    <div class="flex flex-col gap-4">
      <DateField isInvalid isRequired class="w-[256px]" name="date">
        <Label>Date</Label>
        <DateField.Group>
          <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        </DateField.Group>
        <FieldError>Please enter a valid date</FieldError>
      </DateField>
      <DateField isInvalid class="w-[256px]" name="invalid-date">
        <Label>Date</Label>
        <DateField.Group>
          <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        </DateField.Group>
        <FieldError>Date must be in the future</FieldError>
      </DateField>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Invalid />
    </div>
  );
}
