// Rivet addition (no upstream demo): CellSlider shorthand, same parts as the compound form.
import { CellSlider } from "@rivetjs/ui/cell-slider";

export const head = { title: "CellSlider: Shorthand" };

// #region demo
export function Shorthand() {
  return (
    <div class="w-80">
      <CellSlider label="Volume" defaultValue={60} />
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
