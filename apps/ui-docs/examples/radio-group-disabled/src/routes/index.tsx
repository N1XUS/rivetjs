// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/radio-group/disabled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { Radio } from "@rivetjs/ui/radio";
import { RadioGroup } from "@rivetjs/ui/radio-group";

export const head = { title: "RadioGroup: Disabled" };

// #region demo
export function Disabled() {
  return (
    <RadioGroup isDisabled defaultValue="pro" name="plan-disabled">
      <Label>Subscription plan</Label>
      <Description>Plan changes are temporarily paused while we roll out updates.</Description>
      <Radio value="starter">
        <Radio.Content>
          <Radio.Control>
            <Radio.Indicator />
          </Radio.Control>
          Starter
        </Radio.Content>
        <Description>For side projects and small teams</Description>
      </Radio>
      <Radio value="pro">
        <Radio.Content>
          <Radio.Control>
            <Radio.Indicator />
          </Radio.Control>
          Pro
        </Radio.Content>
        <Description>Advanced reporting and analytics</Description>
      </Radio>
      <Radio value="teams">
        <Radio.Content>
          <Radio.Control>
            <Radio.Indicator />
          </Radio.Control>
          Teams
        </Radio.Content>
        <Description>Share access with up to 10 teammates</Description>
      </Radio>
    </RadioGroup>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Disabled />
    </div>
  );
}
