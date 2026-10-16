// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/number-field/variants.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Label } from "@rivetjs/ui/label";
import { NumberField } from "@rivetjs/ui/number-field";

export const head = { title: "NumberField: Variants" };

// #region demo
export function Variants() {
  return (
    <div class="flex flex-col gap-4">
      <NumberField defaultValue={100} minValue={0} name="primary-width" variant="primary">
        <Label>Primary variant</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input class="w-[120px]" />
          <NumberField.IncrementButton />
        </NumberField.Group>
      </NumberField>
      <NumberField defaultValue={100} minValue={0} name="secondary-width" variant="secondary">
        <Label>Secondary variant</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input class="w-[120px]" />
          <NumberField.IncrementButton />
        </NumberField.Group>
      </NumberField>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Variants />
    </div>
  );
}
