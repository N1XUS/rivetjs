// Rivet-authored NumberStepper demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { NumberStepper } from "@rivetjs/ui/number-stepper";

export const head = { title: "NumberStepper: With Label" };

// #region demo
export function WithLabel() {
  return (
    <NumberStepper defaultValue={2} minValue={1} maxValue={6}>
      <Label>Players</Label>
      <NumberStepper.Group>
        <NumberStepper.DecrementButton />
        <NumberStepper.Value />
        <NumberStepper.IncrementButton />
      </NumberStepper.Group>
      <Description>Up to six per table</Description>
    </NumberStepper>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithLabel />
    </div>
  );
}
