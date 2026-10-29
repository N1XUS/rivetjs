// Rivet-authored CellColorPicker demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { signal } from "@rivetjs/reactivity";
import { CellColorPicker } from "@rivetjs/ui/cell-color-picker";
import { ColorSwatchPicker } from "@rivetjs/ui/color-swatch-picker";

export const head = { title: "CellColorPicker: Controlled" };

// #region demo
const PRESETS = ["#EF4444", "#F97316", "#EAB308", "#22C55E", "#06B6D4", "#3B82F6", "#8B5CF6", "#EC4899"];

export function Controlled() {
  const color = signal("#8B5CF6");
  return (
    <div class="w-full max-w-sm flex flex-col gap-3">
      <CellColorPicker value={color}>
        <CellColorPicker.Trigger id="ccp-ctrl">
          <CellColorPicker.Label>Highlight</CellColorPicker.Label>
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
      <p id="ccp-ctrl-value" class="text-sm text-muted">
        Value: {String(color())}
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Controlled />
    </div>
  );
}
