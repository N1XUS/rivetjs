// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/number-field/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Label } from "@rivetjs/ui/label";
import { NumberField } from "@rivetjs/ui/number-field";

export const head = { title: "NumberField: Tailwind CSS" };

// #region demo
export function CustomStyles() {
  return (
    <NumberField class="w-full max-w-48" defaultValue={2} minValue={1} name="guests" variant="secondary">
      <Label class="font-medium text-foreground">Guests</Label>
      <NumberField.Group class="rounded-xl bg-default">
        <NumberField.DecrementButton class="text-muted hover:text-foreground" />
        <NumberField.Input class="text-center tabular-nums" />
        <NumberField.IncrementButton class="text-muted hover:text-foreground" />
      </NumberField.Group>
    </NumberField>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomStyles />
    </div>
  );
}
