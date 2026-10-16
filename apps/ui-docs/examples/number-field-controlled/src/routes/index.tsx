// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/number-field/controlled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { NumberField } from "@rivetjs/ui/number-field";

export const head = { title: "NumberField: Controlled" };

// #region demo
export function Controlled() {
  const value = signal<number | null>(1024);

  return (
    <div class="flex w-full max-w-64 flex-col gap-4">
      <NumberField minValue={0} name="width" value={value}>
        <Label>Width</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input class="w-[120px]" />
          <NumberField.IncrementButton />
        </NumberField.Group>
        <Description>Current value: {value()}</Description>
      </NumberField>
      <div class="flex gap-2">
        <Button variant="tertiary" onPress={() => value.set(0)}>
          Reset to 0
        </Button>
        <Button variant="tertiary" onPress={() => value.set(2048)}>
          Set to 2048
        </Button>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Controlled />
    </div>
  );
}
