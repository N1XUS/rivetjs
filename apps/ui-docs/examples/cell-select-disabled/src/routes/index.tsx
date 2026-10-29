// Rivet-authored CellSelect demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { CellSelect } from "@rivetjs/ui/cell-select";
import { ListBox } from "@rivetjs/ui/list-box";

export const head = { title: "CellSelect: Disabled" };

// #region demo
export function Disabled() {
  return (
    <div class="flex w-80 flex-col gap-2">
      <CellSelect defaultValue="en" isDisabled>
        <CellSelect.Trigger>
          <CellSelect.Label>Language</CellSelect.Label>
          <CellSelect.Value />
          <CellSelect.Indicator />
        </CellSelect.Trigger>
        <CellSelect.Popover>
          <ListBox>
            <ListBox.Item id="en" textValue="English">
              English
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="de" textValue="Deutsch">
              Deutsch
              <ListBox.ItemIndicator />
            </ListBox.Item>
          </ListBox>
        </CellSelect.Popover>
      </CellSelect>
      <CellSelect defaultValue="weekly" disabledKeys={["hourly"]}>
        <CellSelect.Trigger>
          <CellSelect.Label>Backups</CellSelect.Label>
          <CellSelect.Value />
          <CellSelect.Indicator />
        </CellSelect.Trigger>
        <CellSelect.Popover>
          <ListBox>
            <ListBox.Item id="hourly" textValue="Hourly">
              Hourly
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="daily" textValue="Daily">
              Daily
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="weekly" textValue="Weekly">
              Weekly
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
      <Disabled />
    </div>
  );
}
