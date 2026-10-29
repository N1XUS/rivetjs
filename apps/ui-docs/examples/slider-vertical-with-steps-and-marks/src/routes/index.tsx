// Port of HeroUI `v3` branch @ e5feb0a3 `apps/docs/src/demos/en/slider/vertical-with-steps-and-marks.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Label } from "@rivetjs/ui/label";
import { Slider } from "@rivetjs/ui/slider";

export const head = { title: "Slider: Vertical with Steps and Marks" };

// #region demo
export function VerticalWithStepsAndMarks() {
  return (
    <div class="flex h-64 items-center justify-center">
      <Slider class="h-full" defaultValue={0.4} maxValue={1} orientation="vertical" step={0.1}>
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
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <VerticalWithStepsAndMarks />
    </div>
  );
}
