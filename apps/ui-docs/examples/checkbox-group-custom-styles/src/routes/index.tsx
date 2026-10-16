// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/checkbox-group/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Checkbox } from "@rivetjs/ui/checkbox";
import { CheckboxGroup } from "@rivetjs/ui/checkbox-group";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "CheckboxGroup: Tailwind CSS" };

// #region demo
const controlClassName = "bg-success-soft before:bg-success";
const indicatorClassName = "**:data-[slot=checkbox-default-indicator--checkmark]:text-success-foreground";

const channels = [
  { label: "Email", value: "email" },
  { label: "SMS", value: "sms" },
  { label: "Push", value: "push" },
] as const;

export function CustomStyles() {
  return (
    <CheckboxGroup class="gap-3 **:data-[slot=checkbox]:mt-0" defaultValue={["email"]} name="notification-channels">
      <Label>Notification channels</Label>
      <Description>Choose how we should reach you for account updates.</Description>
      {channels.map(({ label, value }) => (
        <Checkbox value={value}>
          <Checkbox.Content>
            <Checkbox.Control class={controlClassName}>
              <Checkbox.Indicator class={indicatorClassName} />
            </Checkbox.Control>
            {label}
          </Checkbox.Content>
        </Checkbox>
      ))}
    </CheckboxGroup>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomStyles />
    </div>
  );
}
