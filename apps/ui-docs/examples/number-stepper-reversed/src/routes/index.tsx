// Rivet-authored NumberStepper demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { NumberStepper } from "@rivetjs/ui/number-stepper";

export const head = { title: "NumberStepper: Reversed Layout" };

// #region demo
export function Reversed() {
  return (
    <NumberStepper aria-label="Copies" defaultValue={1} minValue={1}>
      <NumberStepper.Group>
        <NumberStepper.Value wrapperClass="px-3" />
        <NumberStepper.DecrementButton />
        <NumberStepper.IncrementButton />
      </NumberStepper.Group>
    </NumberStepper>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Reversed />
    </div>
  );
}
