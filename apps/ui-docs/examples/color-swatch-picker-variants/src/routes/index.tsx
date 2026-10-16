// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/color-swatch-picker/variants.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { ColorSwatchPicker } from "@rivetjs/ui/color-swatch-picker";

export const head = { title: "ColorSwatchPicker: Variants" };

// #region demo
const colors = ["#F43F5E", "#D946EF", "#8B5CF6", "#3B82F6", "#06B6D4", "#10B981", "#84CC16"];

export function Variants() {
  return (
    <div class="flex flex-col gap-6">
      <div class="flex flex-col gap-2">
        <span class="text-sm text-muted">Circle (default)</span>
        <ColorSwatchPicker variant="circle">
          {colors.map((color) => (
            <ColorSwatchPicker.Item color={color}>
              <ColorSwatchPicker.Swatch />
              <ColorSwatchPicker.Indicator />
            </ColorSwatchPicker.Item>
          ))}
        </ColorSwatchPicker>
      </div>
      <div class="flex flex-col gap-2">
        <span class="text-sm text-muted">Square</span>
        <ColorSwatchPicker variant="square">
          {colors.map((color) => (
            <ColorSwatchPicker.Item color={color}>
              <ColorSwatchPicker.Swatch />
              <ColorSwatchPicker.Indicator />
            </ColorSwatchPicker.Item>
          ))}
        </ColorSwatchPicker>
      </div>
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
