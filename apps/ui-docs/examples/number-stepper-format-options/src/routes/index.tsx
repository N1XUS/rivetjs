// Rivet-authored NumberStepper demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Label } from "@rivetjs/ui/label";
import { NumberStepper } from "@rivetjs/ui/number-stepper";

export const head = { title: "NumberStepper: With Format Options" };

// #region demo
export function FormatOptions() {
  return (
    <div class="flex flex-col items-start gap-4">
      <NumberStepper defaultValue={49} minValue={0} step={1} formatOptions={{ style: "currency", currency: "EUR" }}>
        <Label>Budget</Label>
        <NumberStepper.Group>
          <NumberStepper.DecrementButton />
          <NumberStepper.Value />
          <NumberStepper.IncrementButton />
        </NumberStepper.Group>
      </NumberStepper>
      <NumberStepper defaultValue={0.25} minValue={0} maxValue={1} step={0.05} formatOptions={{ style: "percent" }}>
        <Label>Discount</Label>
        <NumberStepper.Group>
          <NumberStepper.DecrementButton />
          <NumberStepper.Value />
          <NumberStepper.IncrementButton />
        </NumberStepper.Group>
      </NumberStepper>
      <NumberStepper defaultValue={5} minValue={0} formatOptions={{ style: "unit", unit: "kilometer" }}>
        <Label>Radius</Label>
        <NumberStepper.Group>
          <NumberStepper.DecrementButton />
          <NumberStepper.Value />
          <NumberStepper.IncrementButton />
        </NumberStepper.Group>
      </NumberStepper>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <FormatOptions />
    </div>
  );
}
