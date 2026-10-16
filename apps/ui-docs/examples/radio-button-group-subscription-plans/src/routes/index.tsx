// Rivet-authored RadioButtonGroup demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { Building2, Rocket, Users } from "lucide";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { RadioButtonGroup } from "@rivetjs/ui/radio-button-group";

export const head = { title: "RadioButtonGroup: Subscription Plans" };

// #region demo
export function SubscriptionPlans() {
  return (
    <RadioButtonGroup class="w-[30rem] flex-col" defaultValue="pro">
      <Label>Plan</Label>
      <RadioButtonGroup.Item value="starter">
        <RadioButtonGroup.Indicator />
        <RadioButtonGroup.ItemIcon>
          <Icon icon={Rocket} />
        </RadioButtonGroup.ItemIcon>
        <RadioButtonGroup.ItemContent>
          <Label>Starter</Label>
          <Description>For side projects</Description>
        </RadioButtonGroup.ItemContent>
        <span class="ms-auto text-sm font-semibold tabular-nums">$0</span>
      </RadioButtonGroup.Item>
      <RadioButtonGroup.Item value="pro">
        <RadioButtonGroup.Indicator />
        <RadioButtonGroup.ItemIcon>
          <Icon icon={Users} />
        </RadioButtonGroup.ItemIcon>
        <RadioButtonGroup.ItemContent>
          <Label>Pro</Label>
          <Description>For growing teams</Description>
        </RadioButtonGroup.ItemContent>
        <span class="ms-auto text-sm font-semibold tabular-nums">$24</span>
      </RadioButtonGroup.Item>
      <RadioButtonGroup.Item value="enterprise">
        <RadioButtonGroup.Indicator />
        <RadioButtonGroup.ItemIcon>
          <Icon icon={Building2} />
        </RadioButtonGroup.ItemIcon>
        <RadioButtonGroup.ItemContent>
          <Label>Enterprise</Label>
          <Description>SSO, audit log, SLA</Description>
        </RadioButtonGroup.ItemContent>
        <span class="ms-auto text-sm font-semibold tabular-nums">Custom</span>
      </RadioButtonGroup.Item>
    </RadioButtonGroup>
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
