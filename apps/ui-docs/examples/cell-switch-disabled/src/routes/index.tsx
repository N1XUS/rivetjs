// Rivet-authored CellSwitch demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { CellSwitch } from "@rivetjs/ui/cell-switch";

export const head = { title: "CellSwitch: Disabled" };

// #region demo
export function Disabled() {
  return (
    <div id="cs-disabled" class="flex w-full max-w-sm flex-col gap-2">
      <CellSwitch isDisabled defaultSelected>
        <CellSwitch.Trigger>
          <CellSwitch.Label>
            Bluetooth
            <span class="text-xs font-normal text-muted">Managed by your organisation</span>
          </CellSwitch.Label>
          <CellSwitch.Control />
        </CellSwitch.Trigger>
      </CellSwitch>
      <CellSwitch isDisabled>
        <CellSwitch.Trigger>
          <CellSwitch.Label>Hotspot</CellSwitch.Label>
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
      <Disabled />
    </div>
  );
}
