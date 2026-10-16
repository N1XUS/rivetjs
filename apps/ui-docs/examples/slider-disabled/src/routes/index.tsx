// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/slider/disabled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Label } from "@rivetjs/ui/label";
import { Slider } from "@rivetjs/ui/slider";

export const head = { title: "Slider: Disabled" };

// #region demo
export function Disabled() {
  return (
    <Slider isDisabled class="w-full max-w-xs" defaultValue={30}>
      <Label>Volume</Label>
      <Slider.Output />
      <Slider.Track>
        <Slider.Fill />
        <Slider.Thumb />
      </Slider.Track>
    </Slider>
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
