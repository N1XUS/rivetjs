// Rivet-authored NumberStepper demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Label } from "@rivetjs/ui/label";
import { NumberStepper } from "@rivetjs/ui/number-stepper";

export const head = { title: "NumberStepper: Min Max Values" };

// #region demo
export function MinMax() {
  return (
    <NumberStepper defaultValue={2} minValue={1} maxValue={3}>
      <Label>Monitors (1-3)</Label>
      <NumberStepper.Group>
        <NumberStepper.DecrementButton />
        <NumberStepper.Value />
        <NumberStepper.IncrementButton />
      </NumberStepper.Group>
    </NumberStepper>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <MinMax />
    </div>
  );
}
