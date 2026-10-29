// Rivet-authored NumberStepper demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { ChevronDown, ChevronUp } from "lucide";
import { NumberStepper } from "@rivetjs/ui/number-stepper";

export const head = { title: "NumberStepper: Custom Icons" };

// #region demo
export function CustomIcons() {
  return (
    <NumberStepper aria-label="Floor" defaultValue={3} minValue={-2} maxValue={40}>
      <NumberStepper.Group>
        <NumberStepper.DecrementButton>
          <Icon icon={ChevronDown} />
        </NumberStepper.DecrementButton>
        <NumberStepper.Value />
        <NumberStepper.IncrementButton>
          <Icon icon={ChevronUp} />
        </NumberStepper.IncrementButton>
      </NumberStepper.Group>
    </NumberStepper>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomIcons />
    </div>
  );
}
