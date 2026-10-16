// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/color-swatch-picker/sizes.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { ColorSwatchPicker } from "@rivetjs/ui/color-swatch-picker";

export const head = { title: "ColorSwatchPicker: Sizes" };

// #region demo
const colors = ["#F43F5E", "#D946EF", "#8B5CF6", "#3B82F6", "#06B6D4", "#10B981", "#84CC16"];

const sizes = ["xs", "sm", "md", "lg", "xl"] as const;

export function Sizes() {
  return (
    <div class="flex flex-col gap-6">
      {sizes.map((size) => (
        <div class="flex items-center gap-4">
          <span class="w-8 text-sm text-muted">{size}</span>
          <ColorSwatchPicker size={size}>
            {colors.map((color) => (
              <ColorSwatchPicker.Item color={color}>
                <ColorSwatchPicker.Swatch />
                <ColorSwatchPicker.Indicator />
              </ColorSwatchPicker.Item>
            ))}
          </ColorSwatchPicker>
        </div>
      ))}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Sizes />
    </div>
  );
}
