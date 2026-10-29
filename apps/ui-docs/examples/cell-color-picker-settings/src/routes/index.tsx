// Rivet-authored CellColorPicker demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { CellColorPicker } from "@rivetjs/ui/cell-color-picker";
import { ColorSwatchPicker } from "@rivetjs/ui/color-swatch-picker";

export const head = { title: "CellColorPicker: Settings Group" };

// #region demo
const PRESETS = ["#EF4444", "#F97316", "#EAB308", "#22C55E", "#06B6D4", "#3B82F6", "#8B5CF6", "#EC4899"];

export function Settings() {
  return (
    <div class="w-full max-w-sm flex flex-col gap-1 rounded-3xl bg-default p-1.5">
      <CellColorPicker defaultValue="#3B82F6" variant="secondary">
        <CellColorPicker.Trigger>
          <CellColorPicker.Label>Primary</CellColorPicker.Label>
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
      <CellColorPicker defaultValue="#EC4899" variant="secondary">
        <CellColorPicker.Trigger>
          <CellColorPicker.Label>Secondary</CellColorPicker.Label>
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
      <CellColorPicker defaultValue="#F97316" variant="secondary">
        <CellColorPicker.Trigger>
          <CellColorPicker.Label>Warning</CellColorPicker.Label>
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
      <Settings />
    </div>
  );
}
