// Rivet-authored CellSlider demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { CellSlider } from "@rivetjs/ui/cell-slider";

export const head = { title: "CellSlider: Secondary Group" };

// #region demo
export function SecondaryGroup() {
  return (
    <div class="flex w-80 flex-col gap-1.5 rounded-2xl bg-default p-1.5">
      <CellSlider defaultValue={70} variant="secondary">
        <CellSlider.Track>
          <CellSlider.Fill />
          <CellSlider.Thumb />
        </CellSlider.Track>
        <CellSlider.Label>Brightness</CellSlider.Label>
        <CellSlider.Output />
      </CellSlider>
      <CellSlider defaultValue={50} variant="secondary">
        <CellSlider.Track>
          <CellSlider.Fill />
          <CellSlider.Thumb />
        </CellSlider.Track>
        <CellSlider.Label>Contrast</CellSlider.Label>
        <CellSlider.Output />
      </CellSlider>
      <CellSlider defaultValue={40} variant="secondary">
        <CellSlider.Track>
          <CellSlider.Fill />
          <CellSlider.Thumb />
        </CellSlider.Track>
        <CellSlider.Label>Saturation</CellSlider.Label>
        <CellSlider.Output />
      </CellSlider>
      <CellSlider defaultValue={0.25} minValue={0} maxValue={1} step={0.05} formatOptions={{ style: "percent" }} variant="secondary">
        <CellSlider.Track>
          <CellSlider.Fill />
          <CellSlider.Thumb />
        </CellSlider.Track>
        <CellSlider.Label>Warmth</CellSlider.Label>
        <CellSlider.Output />
      </CellSlider>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <SecondaryGroup />
    </div>
  );
}
