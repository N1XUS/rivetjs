// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/color-field/variants.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { ColorField } from "@rivetjs/ui/color-field";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "ColorField: Variants" };

// #region demo
export function Variants() {
  return (
    <div class="flex flex-col gap-4">
      <ColorField class="w-[280px]" defaultValue="#0485F7" name="primary-color">
        <Label>Primary variant</Label>
        <ColorField.Group variant="primary">
          <ColorField.Input />
        </ColorField.Group>
      </ColorField>
      <ColorField class="w-[280px]" defaultValue="#F43F5E" name="secondary-color">
        <Label>Secondary variant</Label>
        <ColorField.Group variant="secondary">
          <ColorField.Input />
        </ColorField.Group>
      </ColorField>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Variants />
    </div>
  );
}
