// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/number-field/with-description.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { NumberField } from "@rivetjs/ui/number-field";

export const head = { title: "NumberField: With Description" };

// #region demo
export function WithDescription() {
  return (
    <div class="flex w-full max-w-64 flex-col gap-4">
      <NumberField defaultValue={1024} minValue={0} name="width">
        <Label>Width</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input class="w-[120px]" />
          <NumberField.IncrementButton />
        </NumberField.Group>
        <Description>Enter the width in pixels</Description>
      </NumberField>
      <NumberField defaultValue={0.5} formatOptions={{ style: "percent" }} maxValue={1} minValue={0} name="percentage" step={0.1}>
        <Label>Percentage</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input class="w-[120px]" />
          <NumberField.IncrementButton />
        </NumberField.Group>
        <Description>Value must be between 0 and 100</Description>
      </NumberField>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithDescription />
    </div>
  );
}
