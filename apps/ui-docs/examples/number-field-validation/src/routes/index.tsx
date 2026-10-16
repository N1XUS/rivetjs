// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/number-field/validation.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { FieldError } from "@rivetjs/ui/field-error";
import { Label } from "@rivetjs/ui/label";
import { NumberField } from "@rivetjs/ui/number-field";

export const head = { title: "NumberField: Validation" };

// #region demo
export function Validation() {
  return (
    <div class="flex w-full max-w-64 flex-col gap-4">
      <NumberField isInvalid isRequired minValue={0} name="quantity" value={-5}>
        <Label>Quantity</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input class="w-[120px]" />
          <NumberField.IncrementButton />
        </NumberField.Group>
        <FieldError>Quantity must be greater than or equal to 0</FieldError>
      </NumberField>
      <NumberField isInvalid formatOptions={{ style: "percent" }} maxValue={1} minValue={0} name="percentage" step={0.1} value={1.5}>
        <Label>Percentage</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input class="w-[120px]" />
          <NumberField.IncrementButton />
        </NumberField.Group>
        <FieldError>Percentage must be between 0 and 100</FieldError>
      </NumberField>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Validation />
    </div>
  );
}
