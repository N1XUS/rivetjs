// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/radio-group/on-surface.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { Radio } from "@rivetjs/ui/radio";
import { RadioGroup } from "@rivetjs/ui/radio-group";
import { Surface } from "@rivetjs/ui/surface";

export const head = { title: "RadioGroup: In Surface" };

// #region demo
export function OnSurface() {
  return (
    <Surface class="w-full rounded-3xl p-6">
      <RadioGroup defaultValue="premium" name="plan-on-surface" variant="secondary">
        <Label>Plan selection</Label>
        <Description>Choose the plan that suits you best</Description>
        <Radio value="basic">
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            Basic Plan
          </Radio.Content>
          <Description>Includes 100 messages per month</Description>
        </Radio>
        <Radio value="premium">
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            Premium Plan
          </Radio.Content>
          <Description>Includes 200 messages per month</Description>
        </Radio>
        <Radio value="business">
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            Business Plan
          </Radio.Content>
          <Description>Unlimited messages</Description>
        </Radio>
      </RadioGroup>
    </Surface>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <OnSurface />
    </div>
  );
}
