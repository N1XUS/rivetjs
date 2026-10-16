// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/time-field/with-validation.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Description } from "@rivetjs/ui/description";
import { FieldError } from "@rivetjs/ui/field-error";
import { Label } from "@rivetjs/ui/label";
import { TimeField } from "@rivetjs/ui/time-field";

export const head = { title: "TimeField: With Validation" };

// #region demo
import { signal } from "@rivetjs/reactivity";

export function WithValidation() {
  // Rivet: a controlled value is a two-way signal of the time string; "HH:MM:SS" strings compare like the times.
  const value = signal<string | null>(null);
  const minTime = "09:00:00";
  const maxTime = "17:00:00";
  const isInvalid = () => value() !== null && (value()! < minTime || value()! > maxTime);

  return (
    <div class="flex flex-col gap-4">
      <TimeField isRequired class="w-[256px]" isInvalid={isInvalid} maxValue={maxTime} minValue={minTime} name="time" value={value}>
        <Label>Time</Label>
        <TimeField.Group>
          <TimeField.Input>{(segment) => <TimeField.Segment segment={segment} />}</TimeField.Input>
        </TimeField.Group>
        {isInvalid() ? <FieldError>Time must be between 9:00 AM and 5:00 PM</FieldError> : <Description>Enter a time between 9:00 AM and 5:00 PM</Description>}
      </TimeField>
    </div>
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
