// Rivet-authored CellSwitch demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { CellSwitch } from "@rivetjs/ui/cell-switch";

export const head = { title: "CellSwitch: Variants" };

// #region demo
export function Variants() {
  return (
    <div id="cs-variants" class="grid w-full max-w-xl grid-cols-1 gap-4 sm:grid-cols-2">
      <div class="flex flex-col gap-2 p-3">
        <CellSwitch label="Default" defaultSelected />
        <CellSwitch label="Default" />
      </div>
      <div class="flex flex-col gap-2 rounded-3xl bg-background-secondary p-3">
        <CellSwitch variant="secondary" label="Secondary" defaultSelected />
        <CellSwitch variant="secondary" label="Secondary" />
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Variants />
    </div>
  );
}
