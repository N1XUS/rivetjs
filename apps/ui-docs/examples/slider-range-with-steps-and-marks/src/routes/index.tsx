// Port of HeroUI `v3` branch @ e5feb0a3 `apps/docs/src/demos/en/slider/range-with-steps-and-marks.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Label } from "@rivetjs/ui/label";
import { Slider } from "@rivetjs/ui/slider";

export const head = { title: "Slider: Range with Steps and Marks" };

// #region demo
export function RangeWithStepsAndMarks() {
  return (
    <Slider class="w-full max-w-xs" defaultValue={[0.2, 0.8]} maxValue={1} step={0.1}>
      <Label>Range</Label>
      <Slider.Output />
      <Slider.Track>
        {({ state }) => (
          <>
            <Slider.Fill />
            <Slider.Steps />
            {state.defaultValues.map((_, index) => (
              <Slider.Thumb index={index} />
            ))}
          </>
        )}
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
      <RangeWithStepsAndMarks />
    </div>
  );
}
