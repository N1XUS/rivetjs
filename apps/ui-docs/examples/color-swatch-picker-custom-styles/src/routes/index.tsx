// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/color-swatch-picker/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { ColorSwatchPicker } from "@rivetjs/ui/color-swatch-picker";

export const head = { title: "ColorSwatchPicker: Tailwind CSS" };

// #region demo
const colors = ["#F43F5E", "#D946EF", "#8B5CF6", "#3B82F6", "#06B6D4", "#10B981", "#84CC16"];

export function CustomStyles() {
  return (
    <ColorSwatchPicker class="rounded-2xl border border-border/80 bg-surface p-4 shadow-sm ring-1 ring-accent/5" defaultValue="#8B5CF6" variant="square">
      {colors.map((color) => (
        <ColorSwatchPicker.Item color={color}>
          <ColorSwatchPicker.Swatch />
          <ColorSwatchPicker.Indicator />
        </ColorSwatchPicker.Item>
      ))}
    </ColorSwatchPicker>
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
