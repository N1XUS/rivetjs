// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/number-field/with-validation.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Description } from "@rivetjs/ui/description";
import { FieldError } from "@rivetjs/ui/field-error";
import { Label } from "@rivetjs/ui/label";
import { NumberField } from "@rivetjs/ui/number-field";

export const head = { title: "NumberField: With Validation" };

// #region demo
export function WithValidation() {
  const value = signal<number | null>(null);
  const isInvalid = () => value() != null && (value()! < 0 || value()! > 100);

  return (
    <div class="flex w-full max-w-64 flex-col gap-4">
      <NumberField isRequired formatOptions={{ style: "percent" }} isInvalid={isInvalid} maxValue={1} minValue={0} name="percentage" step={0.1} value={value}>
        <Label>Percentage</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input class="w-[120px]" />
          <NumberField.IncrementButton />
        </NumberField.Group>
        {isInvalid() ? <FieldError>Percentage must be between 0 and 100</FieldError> : <Description>Enter a value between 0 and 100</Description>}
      </NumberField>
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
