// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/radio-group/horizontal.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { Radio } from "@rivetjs/ui/radio";
import { RadioGroup } from "@rivetjs/ui/radio-group";

export const head = { title: "RadioGroup: Horizontal Orientation" };

// #region demo
export function Horizontal() {
  return (
    <div class="flex flex-col gap-4">
      <Label>Subscription plan</Label>
      <RadioGroup defaultValue="pro" name="plan-orientation" orientation="horizontal">
        <Radio value="starter">
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            Starter
          </Radio.Content>
          <Description>For side projects</Description>
        </Radio>
        <Radio value="pro">
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            Pro
          </Radio.Content>
          <Description>Advanced reporting</Description>
        </Radio>
        <Radio value="teams">
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            Teams
          </Radio.Content>
          <Description>Up to 10 teammates</Description>
        </Radio>
      </RadioGroup>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Horizontal />
    </div>
  );
}
