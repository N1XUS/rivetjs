// Rivet example (no HeroUI counterpart): the default morph indicator (TWEAKS.md TW-149) and its style hooks.
import { CellSelect } from "@rivetjs/ui/cell-select";

export const head = { title: "CellSelect: Indicator" };

// #region demo
export function Indicator() {
  return (
    <div class="flex w-80 flex-col gap-2">
      <CellSelect class="" label="Default" defaultValue="system">
        <CellSelect.Item id="light">Light</CellSelect.Item>
        <CellSelect.Item id="dark">Dark</CellSelect.Item>
        <CellSelect.Item id="system">System</CellSelect.Item>
      </CellSelect>
      <CellSelect
        class="[--cell-select-indicator-size:20px] [--cell-select-indicator-stroke:2px] [--cell-select-indicator-duration:640ms]"
        label="Larger, slower"
        defaultValue="system"
      >
        <CellSelect.Item id="light">Light</CellSelect.Item>
        <CellSelect.Item id="dark">Dark</CellSelect.Item>
        <CellSelect.Item id="system">System</CellSelect.Item>
      </CellSelect>
      <CellSelect class="[--cell-select-indicator-duration:0s]" label="No morph" defaultValue="system">
        <CellSelect.Item id="light">Light</CellSelect.Item>
        <CellSelect.Item id="dark">Dark</CellSelect.Item>
        <CellSelect.Item id="system">System</CellSelect.Item>
      </CellSelect>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Indicator />
    </div>
  );
}
