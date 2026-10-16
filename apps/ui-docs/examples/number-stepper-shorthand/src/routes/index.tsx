// Rivet addition (no upstream demo): NumberStepper shorthand, same parts as the compound form.
import { NumberStepper } from "@rivetjs/ui/number-stepper";

export const head = { title: "NumberStepper: Shorthand" };

// #region demo
export function Shorthand() {
  return <NumberStepper aria-label="Quantity" defaultValue={1} minValue={0} />;
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Shorthand />
    </div>
  );
}
