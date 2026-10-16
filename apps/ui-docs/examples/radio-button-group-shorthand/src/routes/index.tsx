// Rivet addition (no upstream demo): RadioButtonGroup shorthand, same parts as the compound form.
import { RadioButtonGroup } from "@rivetjs/ui/radio-button-group";

export const head = { title: "RadioButtonGroup: Shorthand" };

// #region demo
export function Shorthand() {
  return (
    <RadioButtonGroup
      class="w-[34rem]"
      defaultValue="medium"
      label="Workspace size"
      items={[
        { value: "small", label: "Small", description: "Up to 5 people" },
        { value: "medium", label: "Medium", description: "Up to 25 people" },
        { value: "large", label: "Large", description: "Unlimited" },
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
