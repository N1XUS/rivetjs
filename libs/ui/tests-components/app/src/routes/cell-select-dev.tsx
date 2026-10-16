// CELLSELECT-DEV (2026-10-08): the ui-docs "CellSelect: Usage" demo for the dev-server test (`cell-select-dev.test.ts`):
// `#csd` = CellSelect `defaultValue="system"` (Light / Dark / System), centred like the docs example frame.
import { CellSelect } from "@rivetjs/ui/cell-select";
import { ListBox } from "@rivetjs/ui/list-box";

export default function CellSelectDev() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [&>*]:max-w-full">
      <div id="csd" class="w-80">
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
    </div>
  );
}
