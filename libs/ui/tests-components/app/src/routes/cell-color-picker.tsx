import { signal } from "@rivetjs/reactivity";
import { CellColorPicker } from "@rivetjs/ui/cell-color-picker";
import { ColorSwatchPicker } from "@rivetjs/ui/color-swatch-picker";

export const head = { title: "CellColorPicker" };

const PRESETS = ["#EF4444", "#22C55E", "#3B82F6"];

// Rivet addition (feature set inspired by HeroUI Pro's public Cell Color Picker docs): a controlled cell with preset swatches
// and a disabled cell. Resumes on the first press.
export default function CellColorPickerStory() {
  const color = signal("#EF4444");
  return (
    <main class="flex max-w-sm flex-col gap-4 bg-background p-6 text-foreground">
      <CellColorPicker value={color}>
        <CellColorPicker.Trigger id="ccp">
          <CellColorPicker.Label>Accent</CellColorPicker.Label>
          <CellColorPicker.ValueDisplay id="ccp-value" />
          <CellColorPicker.Swatch />
        </CellColorPicker.Trigger>
        <CellColorPicker.Popover id="ccp-popover">
          <ColorSwatchPicker aria-label="Presets" size="xs">
            {PRESETS.map((preset) => (
              <ColorSwatchPicker.Item color={preset}>
                <ColorSwatchPicker.Swatch />
              </ColorSwatchPicker.Item>
            ))}
          </ColorSwatchPicker>
        </CellColorPicker.Popover>
      </CellColorPicker>
      <p id="ccp-signal">{color()}</p>
      <CellColorPicker defaultValue="#000000" isDisabled>
        <CellColorPicker.Trigger id="ccp-off">
          <CellColorPicker.Label>Locked</CellColorPicker.Label>
          <CellColorPicker.ValueDisplay />
        </CellColorPicker.Trigger>
      </CellColorPicker>
    </main>
  );
}
