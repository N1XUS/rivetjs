// Rivet-authored CellSlider demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { CellSlider } from "@rivetjs/ui/cell-slider";

export const head = { title: "CellSlider: Variants" };

// #region demo
export function Variants() {
  return (
    <div class="flex w-80 flex-col gap-4">
      <CellSlider defaultValue={45}>
        <CellSlider.Track>
          <CellSlider.Fill />
          <CellSlider.Thumb />
        </CellSlider.Track>
        <CellSlider.Label>Default</CellSlider.Label>
        <CellSlider.Output />
      </CellSlider>
      <div class="rounded-2xl bg-default p-1.5">
        <CellSlider defaultValue={45} variant="secondary">
          <CellSlider.Track>
            <CellSlider.Fill />
            <CellSlider.Thumb />
          </CellSlider.Track>
          <CellSlider.Label>Secondary</CellSlider.Label>
          <CellSlider.Output />
        </CellSlider>
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
