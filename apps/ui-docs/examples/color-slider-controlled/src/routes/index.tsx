// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/color-slider/controlled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { ColorSlider } from "@rivetjs/ui/color-slider";
import { ColorSwatch } from "@rivetjs/ui/color-swatch";
import { Label } from "@rivetjs/ui/label";
import { signal } from "@rivetjs/reactivity";
import { parseColor } from "@rivetjs/cdk/color";

export const head = { title: "ColorSlider: Controlled" };

// #region demo
export function Controlled() {
  // Rivet: a controlled value is a two-way signal of the color string (Color instances are not resumable).
  const color = signal("hsl(200, 100%, 50%)");

  return (
    <div class="flex w-full max-w-xs flex-col gap-4">
      <ColorSlider channel="hue" value={color}>
        <Label>Hue</Label>
        <ColorSlider.Output />
        <ColorSlider.Track>
          <ColorSlider.Thumb />
        </ColorSlider.Track>
      </ColorSlider>
      <div class="flex items-center gap-2">
        <ColorSwatch color={() => color()} size="sm" />
        <p class="text-sm text-muted">
          Current color: <code class="font-mono">{parseColor(color()).toString("hsl")}</code>
        </p>
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
