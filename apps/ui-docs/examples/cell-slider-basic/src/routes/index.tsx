// Rivet-authored CellSlider demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { CellSlider } from "@rivetjs/ui/cell-slider";

export const head = { title: "CellSlider: Usage" };

// #region demo
export function Basic() {
  return (
    <div class="w-80">
      <CellSlider defaultValue={60}>
        <CellSlider.Track>
          <CellSlider.Fill />
          <CellSlider.Thumb />
        </CellSlider.Track>
        <CellSlider.Label>Volume</CellSlider.Label>
        <CellSlider.Output />
      </CellSlider>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Basic />
    </div>
  );
}
