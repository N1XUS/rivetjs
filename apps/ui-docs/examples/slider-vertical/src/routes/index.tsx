// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/slider/vertical.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Label } from "@rivetjs/ui/label";
import { Slider } from "@rivetjs/ui/slider";

export const head = { title: "Slider: Vertical" };

// #region demo
export function Vertical() {
  return (
    <div class="flex h-64 items-center justify-center">
      <Slider class="h-full" defaultValue={30} orientation="vertical">
        <Label>Volume</Label>
        <Slider.Output />
        <Slider.Track>
          <Slider.Fill />
          <Slider.Thumb />
        </Slider.Track>
      </Slider>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Vertical />
    </div>
  );
}
