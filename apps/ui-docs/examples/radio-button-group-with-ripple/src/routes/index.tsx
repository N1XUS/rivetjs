// Rivet-authored RadioButtonGroup demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { Package, Truck, Zap } from "lucide";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { PressableFeedback } from "@rivetjs/ui/pressable-feedback";
import { RadioButtonGroup } from "@rivetjs/ui/radio-button-group";

export const head = { title: "RadioButtonGroup: With Ripple" };

// #region demo
const OPTIONS = [
  { value: "standard", icon: Package, label: "Standard", description: "3 to 5 business days" },
  { value: "express", icon: Truck, label: "Express", description: "Next business day" },
  { value: "same-day", icon: Zap, label: "Same day", description: "Order before noon" },
];

export function WithRipple() {
  return (
    <RadioButtonGroup class="w-[30rem] flex-col" defaultValue="standard">
      <Label>Shipping speed</Label>
      {OPTIONS.map((option) => (
        <RadioButtonGroup.Item value={option.value}>
          <PressableFeedback.Ripple />
          <RadioButtonGroup.Indicator />
          <RadioButtonGroup.ItemIcon>
            <Icon icon={option.icon} />
          </RadioButtonGroup.ItemIcon>
          <RadioButtonGroup.ItemContent>
            <Label>{option.label}</Label>
            <Description>{option.description}</Description>
          </RadioButtonGroup.ItemContent>
        </RadioButtonGroup.Item>
      ))}
    </RadioButtonGroup>
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
