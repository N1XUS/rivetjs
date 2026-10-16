// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/color-picker/with-swatches.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { ColorArea } from "@rivetjs/ui/color-area";
import { ColorPicker } from "@rivetjs/ui/color-picker";
import { ColorSlider } from "@rivetjs/ui/color-slider";
import { ColorSwatch } from "@rivetjs/ui/color-swatch";
import { ColorSwatchPicker } from "@rivetjs/ui/color-swatch-picker";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "ColorPicker: With Swatches" };

// #region demo
export function WithSwatches() {
  const presets = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#f43f5e"];

  return (
    <ColorPicker defaultValue="#F43F5E">
      <ColorPicker.Trigger>
        <ColorSwatch size="lg" />
        <Label>Brand Color</Label>
      </ColorPicker.Trigger>
      <ColorPicker.Popover>
        <ColorArea aria-label="Color area" class="max-w-full" colorSpace="hsb" xChannel="saturation" yChannel="brightness">
          <ColorArea.Thumb />
        </ColorArea>
        <ColorSlider aria-label="Hue slider" channel="hue" class="gap-1 px-1" colorSpace="hsb">
          <Label>Hue</Label>
          <ColorSlider.Output class="text-muted" />
          <ColorSlider.Track>
            <ColorSlider.Thumb />
          </ColorSlider.Track>
        </ColorSlider>
        <ColorSwatchPicker class="justify-center px-1" size="xs">
          {presets.map((preset) => (
            <ColorSwatchPicker.Item color={preset}>
              <ColorSwatchPicker.Swatch />
            </ColorSwatchPicker.Item>
          ))}
        </ColorSwatchPicker>
      </ColorPicker.Popover>
    </ColorPicker>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithSwatches />
    </div>
  );
}
