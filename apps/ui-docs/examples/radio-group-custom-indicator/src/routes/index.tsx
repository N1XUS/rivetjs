// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/radio-group/custom-indicator.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Check } from "lucide";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { Radio } from "@rivetjs/ui/radio";
import { RadioGroup } from "@rivetjs/ui/radio-group";

export const head = { title: "RadioGroup: Custom Indicator" };

// #region demo
export function CustomIndicator() {
  return (
    <RadioGroup defaultValue="premium" name="plan-custom-indicator">
      <Label>Plan selection</Label>
      <Description>Choose the plan that suits you best</Description>
      <Radio value="basic">
        <Radio.Content>
          <Radio.Control>
            <Radio.Indicator>
              {({ isSelected }) => (isSelected() ? <Icon class="size-3 text-background" icon={Check} stroke-width={3} /> : null)}
            </Radio.Indicator>
          </Radio.Control>
          Basic Plan
        </Radio.Content>
        <Description>Includes 100 messages per month</Description>
      </Radio>
      <Radio value="premium">
        <Radio.Content>
          <Radio.Control>
            <Radio.Indicator>
              {({ isSelected }) => (isSelected() ? <Icon class="size-3 text-background" icon={Check} stroke-width={3} /> : null)}
            </Radio.Indicator>
          </Radio.Control>
          Premium Plan
        </Radio.Content>
        <Description>Includes 200 messages per month</Description>
      </Radio>
      <Radio value="business">
        <Radio.Content>
          <Radio.Control>
            <Radio.Indicator>
              {({ isSelected }) => (isSelected() ? <Icon class="size-3 text-background" icon={Check} stroke-width={3} /> : null)}
            </Radio.Indicator>
          </Radio.Control>
          Business Plan
        </Radio.Content>
        <Description>Unlimited messages</Description>
      </Radio>
    </RadioGroup>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomIndicator />
    </div>
  );
}
