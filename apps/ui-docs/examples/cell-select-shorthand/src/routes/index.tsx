// Rivet addition (no upstream demo): CellSelect shorthand, same parts as the compound form.
import { CellSelect } from "@rivetjs/ui/cell-select";

export const head = { title: "CellSelect: Shorthand" };

// #region demo
export function Shorthand() {
  return (
    <div class="w-80">
      <CellSelect label="Appearance" defaultValue="system">
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
      <Shorthand />
    </div>
  );
}
