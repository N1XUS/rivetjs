// Rivet-authored CellSelect demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { CellSelect } from "@rivetjs/ui/cell-select";
import { ListBox } from "@rivetjs/ui/list-box";

export const head = { title: "CellSelect: Usage" };

// #region demo
export function Basic() {
  return (
    <div class="w-80">
      <CellSelect defaultValue="system">
        <CellSelect.Trigger>
          <CellSelect.Label>Appearance</CellSelect.Label>
          <CellSelect.Value />
          <CellSelect.Indicator />
        </CellSelect.Trigger>
        <CellSelect.Popover>
          <ListBox>
            <ListBox.Item id="light" textValue="Light">
              Light
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="dark" textValue="Dark">
              Dark
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="system" textValue="System">
              System
              <ListBox.ItemIndicator />
            </ListBox.Item>
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
      <Basic />
    </div>
  );
}
