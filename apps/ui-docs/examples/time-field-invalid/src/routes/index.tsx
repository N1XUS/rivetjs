// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/time-field/invalid.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { FieldError } from "@rivetjs/ui/field-error";
import { Label } from "@rivetjs/ui/label";
import { TimeField } from "@rivetjs/ui/time-field";

export const head = { title: "TimeField: Validation" };

// #region demo
export function Invalid() {
  return (
    <div class="flex flex-col gap-4">
      <TimeField isInvalid isRequired class="w-[256px]" name="time">
        <Label>Time</Label>
        <TimeField.Group>
          <TimeField.Input>{(segment) => <TimeField.Segment segment={segment} />}</TimeField.Input>
        </TimeField.Group>
        <FieldError>Please enter a valid time</FieldError>
      </TimeField>
      <TimeField isInvalid class="w-[256px]" name="invalid-time">
        <Label>Time</Label>
        <TimeField.Group>
          <TimeField.Input>{(segment) => <TimeField.Segment segment={segment} />}</TimeField.Input>
        </TimeField.Group>
        <FieldError>Time must be within business hours</FieldError>
      </TimeField>
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
