// Rivet-authored NumberStepper demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { NumberStepper } from "@rivetjs/ui/number-stepper";

export const head = { title: "NumberStepper: With Custom Buttons" };

// #region demo
export function CustomButtons() {
  return (
    <NumberStepper aria-label="Batch size" defaultValue={10} minValue={0} step={10}>
      <NumberStepper.Group>
        <NumberStepper.DecrementButton class="w-auto rounded-full bg-transparent px-3 text-xs font-semibold shadow-none">-10</NumberStepper.DecrementButton>
        <NumberStepper.Value />
        <NumberStepper.IncrementButton class="w-auto rounded-full bg-accent px-3 text-xs font-semibold text-accent-foreground">
          +10
        </NumberStepper.IncrementButton>
      </NumberStepper.Group>
    </NumberStepper>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomButtons />
    </div>
  );
}
