// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/color-field/controlled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import type { Color } from "@rivetjs/cdk/color";
import { ColorField } from "@rivetjs/ui/color-field";
import { ColorSwatch } from "@rivetjs/ui/color-swatch";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { parseColor } from "@rivetjs/cdk/color";
import { signal } from "@rivetjs/reactivity";

export const head = { title: "ColorField: Controlled" };

// #region demo
export function Controlled() {
  // Rivet: a controlled value is a two-way signal of the color string (Color instances are not resumable).
  const value = signal<string | null>("#0485F7");

  return (
    <div class="flex flex-col gap-4">
      <ColorField class="w-[280px]" name="color" value={value}>
        <Label>Color</Label>
        <ColorField.Group>
          <ColorField.Prefix>
            <ColorSwatch color={() => value() ?? undefined} size="xs" />
          </ColorField.Prefix>
          <ColorField.Input />
        </ColorField.Group>
        <Description>Current value: {value() ? parseColor(value()!).toString("hex") : "(empty)"}</Description>
      </ColorField>
      <div class="flex gap-2">
        <Button variant="tertiary" onPress={() => value.set("#EF4444")}>
          Set Red
        </Button>
        <Button variant="tertiary" onPress={() => value.set("#10B981")}>
          Set Green
        </Button>
        <Button variant="tertiary" onPress={() => value.set(null)}>
          Clear
        </Button>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Controlled />
    </div>
  );
}
