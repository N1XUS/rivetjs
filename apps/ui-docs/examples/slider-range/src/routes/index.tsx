// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/slider/range.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Label } from "@rivetjs/ui/label";
import { Slider } from "@rivetjs/ui/slider";

export const head = { title: "Slider: Range" };

// #region demo
export function Range() {
  return (
    <Slider class="w-full max-w-xs" defaultValue={[100, 500]} formatOptions={{ currency: "USD", style: "currency" }} maxValue={1000} minValue={0} step={50}>
      <Label>Price Range</Label>
      <Slider.Output />
      <Slider.Track>
        {({ state }) => (
          <>
            <Slider.Fill />
            {state.defaultValues.map((_, i) => (
              <Slider.Thumb index={i} />
            ))}
          </>
        )}
      </Slider.Track>
    </Slider>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Range />
    </div>
  );
}
