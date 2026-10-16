// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/number-field/custom-icons.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { ZoomIn, ZoomOut } from "lucide";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { NumberField } from "@rivetjs/ui/number-field";

export const head = { title: "NumberField: Custom Icons" };

// #region demo
// Rivet: upstream's inline svg icons → lucide via `@rivetjs/kit/icon` (icon rule: no hand-written SVG paths).
export function CustomIcons() {
  return (
    <div class="flex w-full max-w-64 flex-col gap-4">
      <NumberField defaultValue={1024} minValue={0} name="width">
        <Label>Width (Custom Icons)</Label>
        <NumberField.Group>
          <NumberField.DecrementButton>
            <Icon icon={ZoomOut} size={16} />
          </NumberField.DecrementButton>
          <NumberField.Input class="w-[120px]" />
          <NumberField.IncrementButton>
            <Icon icon={ZoomIn} size={16} />
          </NumberField.IncrementButton>
        </NumberField.Group>
        <Description>Custom icon children</Description>
      </NumberField>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomIcons />
    </div>
  );
}
