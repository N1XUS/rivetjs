// Rivet-authored CellSwitch demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { CellSwitch } from "@rivetjs/ui/cell-switch";

export const head = { title: "CellSwitch: Usage" };

// #region demo
export function Basic() {
  return (
    <div id="cs-basic" class="flex w-full max-w-sm flex-col gap-2">
      <CellSwitch>
        <CellSwitch.Trigger>
          <CellSwitch.Label>Airplane mode</CellSwitch.Label>
          <CellSwitch.Control />
        </CellSwitch.Trigger>
      </CellSwitch>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Basic />
    </div>
  );
}
