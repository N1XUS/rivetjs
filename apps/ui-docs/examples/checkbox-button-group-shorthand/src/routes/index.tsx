// Rivet addition (no upstream demo): CheckboxButtonGroup shorthand, same parts as the compound form.
import { CheckboxButtonGroup } from "@rivetjs/ui/checkbox-button-group";

export const head = { title: "CheckboxButtonGroup: Shorthand" };

// #region demo
export function Shorthand() {
  return (
    <CheckboxButtonGroup
      class="w-[34rem]"
      defaultValue={["email"]}
      label="Notifications"
      items={[
        { value: "email", label: "Email", description: "Daily summary" },
        { value: "push", label: "Push", description: "Instant alerts" },
        { value: "sms", label: "SMS", description: "Only urgent" },
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
