// Rivet-authored CellSlider demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { signal } from "@rivetjs/reactivity";
import { CellSlider } from "@rivetjs/ui/cell-slider";

export const head = { title: "CellSlider: Controlled" };

// #region demo
export function Controlled() {
  const zoom = signal(100);
  const committed = signal(100);
  return (
    <div class="flex w-80 flex-col gap-3">
      <CellSlider value={zoom} minValue={50} maxValue={200} step={10} onChangeEnd={(v: number) => committed.set(v)}>
        <CellSlider.Track>
          <CellSlider.Fill />
          <CellSlider.Thumb />
        </CellSlider.Track>
        <CellSlider.Label>Zoom</CellSlider.Label>
        <CellSlider.Output>{() => <span>{zoom()}%</span>}</CellSlider.Output>
      </CellSlider>
      <p class="text-sm text-muted">
        Live: <span id="live">{zoom()}</span> · Committed: <span id="committed">{committed()}</span>
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Controlled />
    </div>
  );
}
