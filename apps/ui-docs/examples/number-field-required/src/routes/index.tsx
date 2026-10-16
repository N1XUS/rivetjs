// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/number-field/required.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { NumberField } from "@rivetjs/ui/number-field";

export const head = { title: "NumberField: Required Field" };

// #region demo
export function Required() {
  return (
    <div class="flex w-full max-w-64 flex-col gap-4">
      <NumberField isRequired minValue={0} name="quantity">
        <Label>Quantity</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input class="w-[120px]" />
          <NumberField.IncrementButton />
        </NumberField.Group>
      </NumberField>
      <NumberField isRequired defaultValue={1} maxValue={10} minValue={1} name="rating">
        <Label>Rating</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input class="w-[120px]" />
          <NumberField.IncrementButton />
        </NumberField.Group>
        <Description>Rate from 1 to 10</Description>
      </NumberField>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Required />
    </div>
  );
}
