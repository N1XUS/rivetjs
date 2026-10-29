// Rivet-authored NumberStepper demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { NumberStepper } from "@rivetjs/ui/number-stepper";

export const head = { title: "NumberStepper: Disabled" };

// #region demo
export function Disabled() {
  return (
    <NumberStepper aria-label="Locked" defaultValue={7} isDisabled>
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
      <Disabled />
    </div>
  );
}
