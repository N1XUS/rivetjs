// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/slider/controlled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Label } from "@rivetjs/ui/label";
import { Slider } from "@rivetjs/ui/slider";

export const head = { title: "Slider: Controlled Value" };

// #region demo
export function Controlled() {
  const value = signal(25);

  return (
    <div class="flex w-full max-w-xs flex-col gap-4">
      <Slider value={value}>
        <Label>Volume</Label>
        <Slider.Output />
        <Slider.Track>
          <Slider.Fill />
          <Slider.Thumb />
        </Slider.Track>
      </Slider>
      <p class="text-sm text-muted">Current value: {value()}</p>
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
