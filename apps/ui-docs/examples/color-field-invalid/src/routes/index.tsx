// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/color-field/invalid.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { ColorField } from "@rivetjs/ui/color-field";
import { FieldError } from "@rivetjs/ui/field-error";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "ColorField: Validation" };

// #region demo
export function Invalid() {
  return (
    <div class="flex flex-col gap-4">
      <ColorField isInvalid isRequired class="w-[280px]" name="color">
        <Label>Color</Label>
        <ColorField.Group>
          <ColorField.Input placeholder="#000000" />
        </ColorField.Group>
        <FieldError>Please enter a valid hex color</FieldError>
      </ColorField>
      <ColorField isInvalid class="w-[280px]" name="invalid-color">
        <Label>Background Color</Label>
        <ColorField.Group>
          <ColorField.Input defaultValue="not-a-color" />
        </ColorField.Group>
        <FieldError>Invalid color format. Use hex (e.g., #FF5733)</FieldError>
      </ColorField>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Invalid />
    </div>
  );
}
