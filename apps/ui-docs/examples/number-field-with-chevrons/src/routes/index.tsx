// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/number-field/with-chevrons.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { ChevronDown, ChevronUp } from "lucide";
import { Label } from "@rivetjs/ui/label";
import { NumberField } from "@rivetjs/ui/number-field";

export const head = { title: "NumberField: With Chevrons" };

// #region demo
// Rivet: upstream's inline svg icons → lucide via `@rivetjs/kit/icon` (icon rule: no hand-written SVG paths).
export function WithChevrons() {
  return (
    <NumberField
      class="w-full max-w-64"
      defaultValue={99}
      minValue={0}
      name="amount"
      formatOptions={{
        currency: "EUR",
        currencySign: "accounting",
        style: "currency",
      }}
    >
      <Label>Number field with chevrons</Label>
      <NumberField.Group class="flex">
        <NumberField.Input class="flex-1" />
        <div class="flex h-full flex-col border-s border-field-placeholder/15">
          <NumberField.IncrementButton class="flex h-1/2 w-6 items-center justify-center rounded-none border-0 pt-0.5 text-sm">
            <Icon icon={ChevronUp} size={11} />
          </NumberField.IncrementButton>
          <NumberField.DecrementButton class="flex h-1/2 w-6 items-center justify-center rounded-none border-0 pb-0.5 text-sm">
            <Icon icon={ChevronDown} size={11} />
          </NumberField.DecrementButton>
        </div>
      </NumberField.Group>
    </NumberField>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithChevrons />
    </div>
  );
}
