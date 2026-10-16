// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/color-field/basic.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import type { Color } from "@rivetjs/cdk/color";
import { ColorField } from "@rivetjs/ui/color-field";
import { ColorSwatch } from "@rivetjs/ui/color-swatch";
import { Label } from "@rivetjs/ui/label";
import { parseColor } from "@rivetjs/cdk/color";
import { signal } from "@rivetjs/reactivity";

export const head = { title: "ColorField: Usage" };

// #region demo
export function Basic() {
  // Rivet: a controlled value is a two-way signal of the color string (Color instances are not resumable).
  const color = signal<string | null>("#0485F7");

  return (
    <ColorField class="w-[280px]" name="color" value={color}>
      <Label>Color</Label>
      <ColorField.Group>
        <ColorField.Prefix>
          <ColorSwatch color={() => color() ?? undefined} size="xs" />
        </ColorField.Prefix>
        <ColorField.Input />
      </ColorField.Group>
    </ColorField>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Basic />
    </div>
  );
}
