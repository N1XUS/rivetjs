// Port of HeroUI `v3` branch @ e5feb0a3 `apps/docs/src/demos/en/slider/with-steps.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Label } from "@rivetjs/ui/label";
import { Slider } from "@rivetjs/ui/slider";

export const head = { title: "Slider: With Steps" };

// #region demo
export function WithSteps() {
  return (
    <Slider class="w-full max-w-xs" defaultValue={40} step={10}>
      <Label>Volume</Label>
      <Slider.Output />
      <Slider.Track>
        <Slider.Fill />
        <Slider.Steps />
        <Slider.Thumb />
      </Slider.Track>
    </Slider>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithSteps />
    </div>
  );
}
