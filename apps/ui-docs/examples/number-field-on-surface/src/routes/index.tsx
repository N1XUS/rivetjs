// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/number-field/on-surface.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { NumberField } from "@rivetjs/ui/number-field";
import { Surface } from "@rivetjs/ui/surface";

export const head = { title: "NumberField: In Surface" };

// #region demo
export function OnSurface() {
  return (
    <Surface class="flex w-full max-w-[280px] flex-col gap-4 rounded-3xl p-6">
      <NumberField defaultValue={1024} minValue={0} name="width" variant="secondary">
        <Label>Width</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input class="w-full" />
          <NumberField.IncrementButton />
        </NumberField.Group>
        <Description>Enter the width in pixels</Description>
      </NumberField>
      <NumberField defaultValue={0.5} formatOptions={{ style: "percent" }} maxValue={1} minValue={0} name="percentage" step={0.1} variant="secondary">
        <Label>Percentage</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input class="w-full" />
          <NumberField.IncrementButton />
        </NumberField.Group>
        <Description>Value must be between 0 and 100</Description>
      </NumberField>
    </Surface>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <OnSurface />
    </div>
  );
}
