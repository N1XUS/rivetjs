// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/color-field/channel-editing.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import type { Color } from "@rivetjs/cdk/color";
import { ColorField } from "@rivetjs/ui/color-field";
import { ColorSwatch } from "@rivetjs/ui/color-swatch";
import { Label } from "@rivetjs/ui/label";
import { parseColor } from "@rivetjs/cdk/color";
import { signal } from "@rivetjs/reactivity";

export const head = { title: "ColorField: Channel Editing" };

// #region demo
export function ChannelEditing() {
  // Rivet: a controlled value is a two-way signal of the color string (Color instances are not resumable).
  const color = signal<string | null>("#7F007F");

  return (
    <div class="flex flex-col gap-4">
      <p class="text-sm text-muted">Edit individual HSL channels:</p>
      <div class="flex gap-4">
        <ColorField channel="hue" class="w-[100px]" colorSpace="hsl" name="hue" value={color}>
          <Label>Hue</Label>
          <ColorField.Group>
            <ColorField.Input />
          </ColorField.Group>
        </ColorField>
        <ColorField channel="saturation" class="w-[100px]" colorSpace="hsl" name="saturation" value={color}>
          <Label>Saturation</Label>
          <ColorField.Group>
            <ColorField.Input />
            <ColorField.Suffix>
              <span class="text-sm text-muted">%</span>
            </ColorField.Suffix>
          </ColorField.Group>
        </ColorField>
        <ColorField channel="lightness" class="w-[100px]" colorSpace="hsl" name="lightness" value={color}>
          <Label>Lightness</Label>
          <ColorField.Group>
            <ColorField.Input />
            <ColorField.Suffix>
              <span class="text-sm text-muted">%</span>
            </ColorField.Suffix>
          </ColorField.Group>
        </ColorField>
      </div>
      <div class="flex items-center gap-2">
        <ColorSwatch color={() => color() ?? undefined} size="md" />
        <span class="text-sm">Current: {color() ? parseColor(color()!).toString("hex") : "(empty)"}</span>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ChannelEditing />
    </div>
  );
}
