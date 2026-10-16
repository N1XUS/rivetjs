// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/color-swatch-picker/custom-indicator.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Heart } from "lucide";
import { ColorSwatchPicker } from "@rivetjs/ui/color-swatch-picker";

export const head = { title: "ColorSwatchPicker: Custom Indicator" };

// #region demo
export function CustomIndicator() {
  const colors = ["#F43F5E", "#D946EF", "#8B5CF6", "#3B82F6", "#06B6D4", "#10B981", "#84CC16"];

  return (
    <ColorSwatchPicker>
      {colors.map((color) => (
        <ColorSwatchPicker.Item color={color}>
          <ColorSwatchPicker.Swatch />
          <ColorSwatchPicker.Indicator>
            <Icon icon={Heart} size={16} />
          </ColorSwatchPicker.Indicator>
        </ColorSwatchPicker.Item>
      ))}
    </ColorSwatchPicker>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomIndicator />
    </div>
  );
}
