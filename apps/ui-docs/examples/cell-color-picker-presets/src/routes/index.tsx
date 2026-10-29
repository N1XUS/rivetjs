// Rivet-authored CellColorPicker demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { CellColorPicker } from "@rivetjs/ui/cell-color-picker";
import { ColorArea } from "@rivetjs/ui/color-area";
import { ColorSlider } from "@rivetjs/ui/color-slider";
import { ColorSwatchPicker } from "@rivetjs/ui/color-swatch-picker";

export const head = { title: "CellColorPicker: With Presets" };

// #region demo
const PRESETS = ["#EF4444", "#F97316", "#EAB308", "#22C55E", "#06B6D4", "#3B82F6", "#8B5CF6", "#EC4899"];

export function WithPresets() {
  return (
    <div class="w-full max-w-sm">
      <CellColorPicker defaultValue="#22C55E">
        <CellColorPicker.Trigger>
          <CellColorPicker.Label>Brand color</CellColorPicker.Label>
          <CellColorPicker.ValueDisplay />
          <CellColorPicker.Swatch />
        </CellColorPicker.Trigger>
        <CellColorPicker.Popover>
          <ColorArea aria-label="Color area" class="max-w-full" colorSpace="hsb" xChannel="saturation" yChannel="brightness">
            <ColorArea.Thumb />
          </ColorArea>
          <ColorSlider aria-label="Hue" channel="hue" colorSpace="hsb" class="px-1">
            <ColorSlider.Track>
              <ColorSlider.Thumb />
            </ColorSlider.Track>
          </ColorSlider>
          <ColorSwatchPicker aria-label="Presets" class="justify-center px-1" size="xs">
            {PRESETS.map((preset) => (
              <ColorSwatchPicker.Item color={preset}>
                <ColorSwatchPicker.Swatch />
              </ColorSwatchPicker.Item>
            ))}
          </ColorSwatchPicker>
        </CellColorPicker.Popover>
      </CellColorPicker>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <WithPresets />
    </div>
  );
}
