// Rivet-authored CellSwitch demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { CellSwitch } from "@rivetjs/ui/cell-switch";

export const head = { title: "CellSwitch: Secondary Group" };

// #region demo
export function SecondaryGroup() {
  return (
    <div id="cs-secondary" class="flex w-full max-w-sm flex-col gap-2 rounded-3xl bg-background-secondary p-3">
      <CellSwitch variant="secondary" defaultSelected>
        <CellSwitch.Trigger>
          <CellSwitch.Label>Show previews</CellSwitch.Label>
          <CellSwitch.Control />
        </CellSwitch.Trigger>
      </CellSwitch>
      <CellSwitch variant="secondary">
        <CellSwitch.Trigger>
          <CellSwitch.Label>Play sounds</CellSwitch.Label>
          <CellSwitch.Control />
        </CellSwitch.Trigger>
      </CellSwitch>
      <CellSwitch variant="secondary" defaultSelected>
        <CellSwitch.Trigger>
          <CellSwitch.Label>Badge app icon</CellSwitch.Label>
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
      <SecondaryGroup />
    </div>
  );
}
