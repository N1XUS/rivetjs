// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/color-swatch-picker/controlled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { ColorSwatchPicker } from "@rivetjs/ui/color-swatch-picker";
import { parseColor } from "@rivetjs/cdk/color";
import { signal } from "@rivetjs/reactivity";

export const head = { title: "ColorSwatchPicker: Controlled" };

// #region demo
const colors = ["#F43F5E", "#D946EF", "#8B5CF6", "#3B82F6", "#06B6D4", "#10B981", "#84CC16"];

export function Controlled() {
  // Rivet: a controlled value is a two-way signal of the color string (Color instances are not resumable).
  const value = signal("#F43F5E");

  return (
    <div class="flex flex-col gap-4">
      <ColorSwatchPicker value={value}>
        {colors.map((color) => (
          <ColorSwatchPicker.Item color={color}>
            <ColorSwatchPicker.Swatch />
            <ColorSwatchPicker.Indicator />
          </ColorSwatchPicker.Item>
        ))}
      </ColorSwatchPicker>
      <p class="text-sm text-muted">
        Selected: <span class="font-medium">{parseColor(value()).toString("hex")}</span>
      </p>
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
