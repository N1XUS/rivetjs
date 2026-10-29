// Rivet-authored CellSlider demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { CellSlider } from "@rivetjs/ui/cell-slider";

export const head = { title: "CellSlider: Disabled" };

// #region demo
export function Disabled() {
  return (
    <div class="w-80">
      <CellSlider defaultValue={30} isDisabled>
        <CellSlider.Track>
          <CellSlider.Fill />
          <CellSlider.Thumb />
        </CellSlider.Track>
        <CellSlider.Label>Bass</CellSlider.Label>
        <CellSlider.Output />
      </CellSlider>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Disabled />
    </div>
  );
}
