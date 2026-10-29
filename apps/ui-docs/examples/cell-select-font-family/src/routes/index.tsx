// Rivet-authored CellSelect demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { CellSelect } from "@rivetjs/ui/cell-select";
import { ListBox } from "@rivetjs/ui/list-box";

export const head = { title: "CellSelect: Font Family" };

// #region demo
const FONTS = [
  { id: "inter", name: "Inter", stack: "Inter, ui-sans-serif, system-ui, sans-serif" },
  { id: "serif", name: "Georgia", stack: "Georgia, ui-serif, serif" },
  { id: "mono", name: "Menlo", stack: "Menlo, ui-monospace, monospace" },
  { id: "rounded", name: "Rounded", stack: "ui-rounded, 'SF Pro Rounded', system-ui, sans-serif" },
];

export function FontFamily() {
  return (
    <div class="w-80">
      <CellSelect defaultValue="serif">
        <CellSelect.Trigger>
          <CellSelect.Label>Font</CellSelect.Label>
          <CellSelect.Value />
          <CellSelect.Indicator />
        </CellSelect.Trigger>
        <CellSelect.Popover>
          <ListBox>
            {FONTS.map((font) => (
              <ListBox.Item id={font.id} textValue={font.name}>
                <span style={{ "font-family": font.stack }}>{font.name}</span>
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </CellSelect.Popover>
      </CellSelect>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <FontFamily />
    </div>
  );
}
