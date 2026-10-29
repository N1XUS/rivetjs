// Rivet-authored CellColorPicker demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { CellColorPicker } from "@rivetjs/ui/cell-color-picker";
import { ColorArea } from "@rivetjs/ui/color-area";
import { ColorSlider } from "@rivetjs/ui/color-slider";

export const head = { title: "CellColorPicker: Usage" };

// #region demo
export function Basic() {
  return (
    <div class="w-full max-w-sm">
      <CellColorPicker defaultValue="#3B82F6">
        <CellColorPicker.Trigger id="ccp-basic">
          <CellColorPicker.Label>Accent color</CellColorPicker.Label>
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
        </CellColorPicker.Popover>
      </CellColorPicker>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Basic />
    </div>
  );
}
