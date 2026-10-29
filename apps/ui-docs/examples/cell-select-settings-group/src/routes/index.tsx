// Rivet-authored CellSelect demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { CellSelect } from "@rivetjs/ui/cell-select";
import { ListBox } from "@rivetjs/ui/list-box";

export const head = { title: "CellSelect: Settings Group" };

// #region demo
export function SettingsGroup() {
  return (
    <div class="flex w-80 flex-col gap-1.5 rounded-2xl bg-surface p-2 shadow-surface">
      <CellSelect defaultValue="en-US">
        <CellSelect.Trigger>
          <CellSelect.Label>Language</CellSelect.Label>
          <CellSelect.Value />
          <CellSelect.Indicator />
        </CellSelect.Trigger>
        <CellSelect.Popover>
          <ListBox>
            <ListBox.Item id="en-US" textValue="English (US)">
              English (US)
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="en-GB" textValue="English (UK)">
              English (UK)
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="fr" textValue="Français">
              Français
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="ja" textValue="日本語">
              日本語
              <ListBox.ItemIndicator />
            </ListBox.Item>
          </ListBox>
        </CellSelect.Popover>
      </CellSelect>
      <CellSelect defaultValue="eu">
        <CellSelect.Trigger>
          <CellSelect.Label>Region</CellSelect.Label>
          <CellSelect.Value />
          <CellSelect.Indicator />
        </CellSelect.Trigger>
        <CellSelect.Popover>
          <ListBox>
            <ListBox.Item id="us" textValue="United States">
              United States
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="eu" textValue="Europe">
              Europe
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="apac" textValue="Asia Pacific">
              Asia Pacific
              <ListBox.ItemIndicator />
            </ListBox.Item>
          </ListBox>
        </CellSelect.Popover>
      </CellSelect>
      <CellSelect defaultValue="iso">
        <CellSelect.Trigger>
          <CellSelect.Label>Date format</CellSelect.Label>
          <CellSelect.Value />
          <CellSelect.Indicator />
        </CellSelect.Trigger>
        <CellSelect.Popover>
          <ListBox>
            <ListBox.Item id="iso" textValue="2026-10-08">
              2026-10-08
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="us" textValue="10/08/2026">
              10/08/2026
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="eu" textValue="08.10.2026">
              08.10.2026
              <ListBox.ItemIndicator />
            </ListBox.Item>
          </ListBox>
        </CellSelect.Popover>
      </CellSelect>
      <CellSelect defaultValue="mon">
        <CellSelect.Trigger>
          <CellSelect.Label>Week starts on</CellSelect.Label>
          <CellSelect.Value />
          <CellSelect.Indicator />
        </CellSelect.Trigger>
        <CellSelect.Popover>
          <ListBox>
            <ListBox.Item id="sun" textValue="Sunday">
              Sunday
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="mon" textValue="Monday">
              Monday
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
      <SettingsGroup />
    </div>
  );
}
