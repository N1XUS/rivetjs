// Rivet-authored CheckboxButtonGroup demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { Building2, Rocket, Users } from "lucide";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { CheckboxButtonGroup } from "@rivetjs/ui/checkbox-button-group";

export const head = { title: "CheckboxButtonGroup: Subscription Plans" };

// #region demo
export function SubscriptionPlans() {
  return (
    <CheckboxButtonGroup class="w-[30rem] flex-col" defaultValue={["pro"]}>
      <Label>Add-ons</Label>
      <CheckboxButtonGroup.Item value="starter">
        <CheckboxButtonGroup.Indicator />
        <CheckboxButtonGroup.ItemIcon>
          <Icon icon={Rocket} />
        </CheckboxButtonGroup.ItemIcon>
        <CheckboxButtonGroup.ItemContent>
          <Label>Starter</Label>
          <Description>For side projects</Description>
        </CheckboxButtonGroup.ItemContent>
        <span class="ms-auto text-sm font-semibold tabular-nums">$0</span>
      </CheckboxButtonGroup.Item>
      <CheckboxButtonGroup.Item value="pro">
        <CheckboxButtonGroup.Indicator />
        <CheckboxButtonGroup.ItemIcon>
          <Icon icon={Users} />
        </CheckboxButtonGroup.ItemIcon>
        <CheckboxButtonGroup.ItemContent>
          <Label>Pro</Label>
          <Description>For growing teams</Description>
        </CheckboxButtonGroup.ItemContent>
        <span class="ms-auto text-sm font-semibold tabular-nums">$24</span>
      </CheckboxButtonGroup.Item>
      <CheckboxButtonGroup.Item value="enterprise">
        <CheckboxButtonGroup.Indicator />
        <CheckboxButtonGroup.ItemIcon>
          <Icon icon={Building2} />
        </CheckboxButtonGroup.ItemIcon>
        <CheckboxButtonGroup.ItemContent>
          <Label>Enterprise</Label>
          <Description>SSO, audit log, SLA</Description>
        </CheckboxButtonGroup.ItemContent>
        <span class="ms-auto text-sm font-semibold tabular-nums">Custom</span>
      </CheckboxButtonGroup.Item>
    </CheckboxButtonGroup>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <SubscriptionPlans />
    </div>
  );
}
