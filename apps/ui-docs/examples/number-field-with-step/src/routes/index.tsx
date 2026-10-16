// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/number-field/with-step.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { NumberField } from "@rivetjs/ui/number-field";

export const head = { title: "NumberField: Step Values" };

// #region demo
export function WithStep() {
  return (
    <div class="flex w-full max-w-64 flex-col gap-4">
      <NumberField defaultValue={0} maxValue={100} minValue={0} name="step1" step={1}>
        <Label>Step: 1</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input class="w-[120px]" />
          <NumberField.IncrementButton />
        </NumberField.Group>
        <Description>Increments by 1</Description>
      </NumberField>
      <NumberField defaultValue={0} maxValue={100} minValue={0} name="step5" step={5}>
        <Label>Step: 5</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input class="w-[120px]" />
          <NumberField.IncrementButton />
        </NumberField.Group>
        <Description>Increments by 5</Description>
      </NumberField>
      <NumberField defaultValue={0} maxValue={100} minValue={0} name="step10" step={10}>
        <Label>Step: 10</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input class="w-[120px]" />
          <NumberField.IncrementButton />
        </NumberField.Group>
        <Description>Increments by 10</Description>
      </NumberField>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithStep />
    </div>
  );
}
