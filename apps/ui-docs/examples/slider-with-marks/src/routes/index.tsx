// Port of HeroUI `v3` branch @ e5feb0a3 `apps/docs/src/demos/en/slider/with-marks.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Label } from "@rivetjs/ui/label";
import { Slider } from "@rivetjs/ui/slider";

export const head = { title: "Slider: With Marks" };

// #region demo
export function WithMarks() {
  return (
    <Slider class="w-full max-w-xs" defaultValue={40}>
      <Label>Volume</Label>
      <Slider.Output />
      <Slider.Track>
        <Slider.Fill />
        <Slider.Thumb />
      </Slider.Track>
      <Slider.Marks>
        <Slider.Mark value={0}>Off</Slider.Mark>
        <Slider.Mark value={20}>Quiet</Slider.Mark>
        <Slider.Mark value={60}>Loud</Slider.Mark>
        <Slider.Mark value={100}>Max</Slider.Mark>
      </Slider.Marks>
    </Slider>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithMarks />
    </div>
  );
}
