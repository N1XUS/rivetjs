// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/color-field/required.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { ColorField } from "@rivetjs/ui/color-field";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "ColorField: Required Field" };

// #region demo
export function Required() {
  return (
    <div class="flex flex-col gap-4">
      <ColorField isRequired class="w-[280px]" name="color">
        <Label>Brand Color</Label>
        <ColorField.Group>
          <ColorField.Input placeholder="#000000" />
        </ColorField.Group>
      </ColorField>
      <ColorField isRequired class="w-[280px]" name="theme-color">
        <Label>Theme Color</Label>
        <ColorField.Group>
          <ColorField.Input placeholder="#000000" />
        </ColorField.Group>
        <Description>Required field</Description>
      </ColorField>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Required />
    </div>
  );
}
