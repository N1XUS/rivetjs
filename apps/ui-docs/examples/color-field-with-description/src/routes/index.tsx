// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/color-field/with-description.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { ColorField } from "@rivetjs/ui/color-field";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "ColorField: With Description" };

// #region demo
export function WithDescription() {
  return (
    <div class="flex flex-col gap-4">
      <ColorField class="w-[280px]" defaultValue="#3B82F6" name="color">
        <Label>Primary Color</Label>
        <ColorField.Group>
          <ColorField.Input />
        </ColorField.Group>
        <Description>Enter your brand's primary color</Description>
      </ColorField>
      <ColorField class="w-[280px]" defaultValue="#F59E0B" name="accent-color">
        <Label>Accent Color</Label>
        <ColorField.Group>
          <ColorField.Input />
        </ColorField.Group>
        <Description>Used for highlights and CTAs</Description>
      </ColorField>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithDescription />
    </div>
  );
}
