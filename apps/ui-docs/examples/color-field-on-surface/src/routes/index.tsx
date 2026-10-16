// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/color-field/on-surface.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { ColorField } from "@rivetjs/ui/color-field";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { Surface } from "@rivetjs/ui/surface";

export const head = { title: "ColorField: On Surface" };

// #region demo
export function OnSurface() {
  return (
    <Surface class="w-[320px] p-4">
      <ColorField defaultValue="#3B82F6" name="color">
        <Label>Theme Color</Label>
        <ColorField.Group variant="secondary">
          <ColorField.Input />
        </ColorField.Group>
        <Description>Select your theme color</Description>
      </ColorField>
    </Surface>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <OnSurface />
    </div>
  );
}
