// Rivet-authored NumberStepper demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { NumberStepper } from "@rivetjs/ui/number-stepper";

export const head = { title: "NumberStepper: Sizes" };

// #region demo
export function Sizes() {
  return (
    <div class="flex items-center gap-6">
      {(["sm", "md", "lg"] as const).map((size) => (
        <NumberStepper aria-label={`Size ${size}`} defaultValue={5} size={size}>
          <NumberStepper.Group>
            <NumberStepper.DecrementButton />
            <NumberStepper.Value />
            <NumberStepper.IncrementButton />
          </NumberStepper.Group>
        </NumberStepper>
      ))}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Sizes />
    </div>
  );
}
