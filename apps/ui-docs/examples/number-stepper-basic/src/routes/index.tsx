// Rivet-authored NumberStepper demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { NumberStepper } from "@rivetjs/ui/number-stepper";

export const head = { title: "NumberStepper: Usage" };

// #region demo
export function Basic() {
  return (
    <NumberStepper aria-label="Quantity" defaultValue={1} minValue={0}>
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
      <Basic />
    </div>
  );
}
