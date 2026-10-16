// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/color-field/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import type { Color } from "@rivetjs/cdk/color";
import { ColorField } from "@rivetjs/ui/color-field";
import { ColorSwatch } from "@rivetjs/ui/color-swatch";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { parseColor } from "@rivetjs/cdk/color";
import { signal } from "@rivetjs/reactivity";

export const head = { title: "ColorField: Tailwind CSS" };

// #region demo
export function CustomStyles() {
  // Rivet: a controlled value is a two-way signal of the color string (Color instances are not resumable).
  const color = signal<string | null>("#6366F1");

  return (
    <ColorField class="w-full max-w-xs gap-1.5" name="accent-color" value={color}>
      <Label class="font-medium text-foreground">Accent color</Label>
      <Description>Applied to buttons, links, and focus rings.</Description>
      <ColorField.Group class="rounded-xl bg-default shadow-none focus-within:ring-2 focus-within:ring-accent/15" variant="secondary">
        <ColorField.Prefix>
          <ColorSwatch class="rounded-md" color={() => color() ?? undefined} size="xs" />
        </ColorField.Prefix>
        <ColorField.Input class="font-mono text-sm text-foreground placeholder:text-muted" />
      </ColorField.Group>
    </ColorField>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomStyles />
    </div>
  );
}
