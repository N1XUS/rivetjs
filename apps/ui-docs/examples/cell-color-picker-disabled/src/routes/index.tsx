// Rivet-authored CellColorPicker demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { CellColorPicker } from "@rivetjs/ui/cell-color-picker";
import { ColorSwatchPicker } from "@rivetjs/ui/color-swatch-picker";

export const head = { title: "CellColorPicker: Disabled" };

// #region demo
const PRESETS = ["#EF4444", "#F97316", "#EAB308", "#22C55E", "#06B6D4", "#3B82F6", "#8B5CF6", "#EC4899"];

export function Disabled() {
  return (
    <div class="w-full max-w-sm">
      <CellColorPicker defaultValue="#EAB308" isDisabled>
        <CellColorPicker.Trigger id="ccp-off">
          <CellColorPicker.Label>Locked color</CellColorPicker.Label>
          <CellColorPicker.ValueDisplay />
          <CellColorPicker.Swatch />
        </CellColorPicker.Trigger>
        <CellColorPicker.Popover>
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
      <Disabled />
    </div>
  );
}
