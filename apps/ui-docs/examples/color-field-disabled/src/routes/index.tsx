// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/color-field/disabled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { ColorField } from "@rivetjs/ui/color-field";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "ColorField: Disabled State" };

// #region demo
export function Disabled() {
  return (
    <div class="flex flex-col gap-4">
      <ColorField isDisabled class="w-[280px]" defaultValue="#0485F7" name="color">
        <Label>Color</Label>
        <ColorField.Group>
          <ColorField.Input />
        </ColorField.Group>
        <Description>This color field is disabled</Description>
      </ColorField>
      <ColorField isDisabled class="w-[280px]" name="color-empty">
        <Label>Color</Label>
        <ColorField.Group>
          <ColorField.Input placeholder="#000000" />
        </ColorField.Group>
        <Description>This color field is disabled</Description>
      </ColorField>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Disabled />
    </div>
  );
}
