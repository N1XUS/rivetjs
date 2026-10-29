// Rivet-authored CheckboxButtonGroup demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { Bell, Mail, MessageSquare } from "lucide";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { PressableFeedback } from "@rivetjs/ui/pressable-feedback";
import { CheckboxButtonGroup } from "@rivetjs/ui/checkbox-button-group";

export const head = { title: "CheckboxButtonGroup: With Ripple" };

// #region demo
const OPTIONS = [
  { value: "email", icon: Mail, label: "Email", description: "A digest every morning" },
  { value: "sms", icon: MessageSquare, label: "Text message", description: "Only for urgent alerts" },
  { value: "push", icon: Bell, label: "Push", description: "On this device, right away" },
];

export function WithRipple() {
  return (
    <CheckboxButtonGroup class="w-[30rem] flex-col" defaultValue={["email"]}>
      <Label>Notify me by</Label>
      {OPTIONS.map((option) => (
        <CheckboxButtonGroup.Item value={option.value}>
          <PressableFeedback.Ripple />
          <CheckboxButtonGroup.Indicator />
          <CheckboxButtonGroup.ItemIcon>
            <Icon icon={option.icon} />
          </CheckboxButtonGroup.ItemIcon>
          <CheckboxButtonGroup.ItemContent>
            <Label>{option.label}</Label>
            <Description>{option.description}</Description>
          </CheckboxButtonGroup.ItemContent>
        </CheckboxButtonGroup.Item>
      ))}
    </CheckboxButtonGroup>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithRipple />
    </div>
  );
}
