// Port of HeroUI `v3` branch @ e5feb0a3 `apps/docs/src/demos/en/slider/with-steps-and-marks.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Label } from "@rivetjs/ui/label";
import { Slider } from "@rivetjs/ui/slider";

export const head = { title: "Slider: With Steps and Marks" };

// #region demo
export function WithStepsAndMarks() {
  return (
    <Slider class="w-full max-w-xs" defaultValue={0.4} maxValue={1} step={0.1}>
      <Label>Volume</Label>
      <Slider.Output />
      <Slider.Track>
        <Slider.Fill />
        <Slider.Steps />
        <Slider.Thumb />
      </Slider.Track>
      <Slider.Marks>
        <Slider.Mark value={0} />
        <Slider.Mark value={0.5} />
        <Slider.Mark value={1} />
      </Slider.Marks>
    </Slider>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithStepsAndMarks />
    </div>
  );
}
