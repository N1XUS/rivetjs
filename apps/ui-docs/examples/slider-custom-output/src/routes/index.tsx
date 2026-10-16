// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/slider/custom-output.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { getThumbValueLabel, sliderValues } from "@rivetjs/cdk/slider";
import { Label } from "@rivetjs/ui/label";
import { Slider } from "@rivetjs/ui/slider";

export const head = { title: "Slider: Custom Output" };

// #region demo
// Rivet: render props carry the cdk `SliderState`; read it with `sliderValues` / `getThumbValueLabel` from `@rivetjs/cdk/slider`.
export function CustomOutput() {
  return (
    <Slider class="w-full max-w-xs" defaultValue={[25, 75]}>
      <Label>Range</Label>
      <Slider.Output>
        {({ state }) =>
          sliderValues(state)
            .map((_, i) => getThumbValueLabel(state, i))
            .join(" – ")
        }
      </Slider.Output>
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
      <CustomOutput />
    </div>
  );
}
