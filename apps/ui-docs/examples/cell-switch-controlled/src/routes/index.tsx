// Rivet-authored CellSwitch demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { signal } from "@rivetjs/reactivity";
import { CellSwitch } from "@rivetjs/ui/cell-switch";

export const head = { title: "CellSwitch: Controlled" };

// #region demo
export function Controlled() {
  const enabled = signal(true);
  return (
    <div id="cs-controlled" class="flex w-full max-w-sm flex-col gap-2">
      <CellSwitch isSelected={enabled}>
        <CellSwitch.Trigger>
          <CellSwitch.Label>Auto-update apps</CellSwitch.Label>
          <CellSwitch.Control />
        </CellSwitch.Trigger>
      </CellSwitch>
      <p id="cs-controlled-state" class="text-sm text-muted">
        Auto-update is {() => (enabled() ? "on" : "off")}.
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Controlled />
    </div>
  );
}
