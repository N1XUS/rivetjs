// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/color-field/full-width.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { ColorField } from "@rivetjs/ui/color-field";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "ColorField: Full Width" };

// #region demo
export function FullWidth() {
  return (
    <div class="w-[400px] space-y-4">
      <ColorField fullWidth defaultValue="#10B981" name="color">
        <Label>Brand Color</Label>
        <ColorField.Group>
          <ColorField.Input />
        </ColorField.Group>
      </ColorField>
      <ColorField fullWidth defaultValue="#8B5CF6" name="color-with-suffix">
        <Label>Theme Color</Label>
        <ColorField.Group>
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
      <FullWidth />
    </div>
  );
}
