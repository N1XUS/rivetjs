// Rivet addition (no upstream demo): RadioGroup shorthand, same parts as the compound form.
import { RadioGroup } from "@rivetjs/ui/radio-group";

export const head = { title: "RadioGroup: Shorthand" };

// #region demo
export function Shorthand() {
  return (
    <RadioGroup
      defaultValue="premium"
      name="shorthand-plan"
      label="Plan selection"
      description="Choose the plan that suits you best"
      items={[
        { value: "basic", label: "Basic Plan", description: "Includes 100 messages per month" },
        { value: "premium", label: "Premium Plan", description: "Includes 200 messages per month" },
        { value: "business", label: "Business Plan", description: "Unlimited messages" },
      ]}
    />
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
