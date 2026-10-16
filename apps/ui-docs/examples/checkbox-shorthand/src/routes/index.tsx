// Rivet addition (no upstream demo): Checkbox shorthand, same parts as the compound form.
import { Checkbox } from "@rivetjs/ui/checkbox";

export const head = { title: "Checkbox: Shorthand" };

// #region demo
export function Shorthand() {
  return (
    <div class="flex flex-col gap-4">
      <Checkbox name="shorthand-terms" label="Accept terms and conditions" />
      <Checkbox name="shorthand-mentions" label="Email notifications" description="Get notified when someone mentions you" />
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Shorthand />
    </div>
  );
}
