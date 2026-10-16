// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/color-area/controlled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import type { Color } from "@rivetjs/cdk/color";
import { ColorArea } from "@rivetjs/ui/color-area";
import { ColorSwatch } from "@rivetjs/ui/color-swatch";
import { parseColor } from "@rivetjs/cdk/color";
import { signal } from "@rivetjs/reactivity";

export const head = { title: "ColorArea: Controlled" };

// #region demo
export function ColorAreaControlled() {
  // Rivet: a controlled value is a two-way signal of the color string (Color instances are not resumable).
  const color = signal("#9B80FF");

  return (
    <div class="flex flex-col gap-4">
      <ColorArea colorSpace="rgb" value={color} xChannel="red" yChannel="green">
        <ColorArea.Thumb />
      </ColorArea>
      <div class="flex w-[300px] items-center gap-3">
        <ColorSwatch color={() => color()} size="md" />
        <p class="text-sm text-muted">
          Current color: <span class="font-medium">{color() ? parseColor(color()).toString("hex") : "(empty)"}</span>
        </p>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ColorAreaControlled />
    </div>
  );
}
