// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/number-field/basic.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Label } from "@rivetjs/ui/label";
import { NumberField } from "@rivetjs/ui/number-field";

export const head = { title: "NumberField: Usage" };

// #region demo
export function Basic() {
  return (
    <NumberField class="w-full max-w-64" defaultValue={1024} minValue={0} name="width">
      <Label>Width</Label>
      <NumberField.Group>
        <NumberField.DecrementButton />
        <NumberField.Input class="w-[120px]" />
        <NumberField.IncrementButton />
      </NumberField.Group>
    </NumberField>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Basic />
    </div>
  );
}
