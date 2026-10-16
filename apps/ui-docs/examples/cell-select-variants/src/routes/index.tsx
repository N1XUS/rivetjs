// Rivet-authored CellSelect demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { CellSelect } from "@rivetjs/ui/cell-select";
import { ListBox } from "@rivetjs/ui/list-box";

export const head = { title: "CellSelect: Variants" };

// #region demo
export function Variants() {
  return (
    <div class="flex w-80 flex-col gap-4">
      <CellSelect defaultValue="system">
        <CellSelect.Trigger>
          <CellSelect.Label>Default</CellSelect.Label>
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
      <div class="rounded-2xl bg-default p-1.5">
        <CellSelect defaultValue="system" variant="secondary">
          <CellSelect.Trigger>
            <CellSelect.Label>Secondary</CellSelect.Label>
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
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Variants />
    </div>
  );
}
