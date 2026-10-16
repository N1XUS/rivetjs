// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/radio-group/controlled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { Radio } from "@rivetjs/ui/radio";
import { RadioGroup } from "@rivetjs/ui/radio-group";

export const head = { title: "RadioGroup: Controlled" };

// #region demo
export function Controlled() {
  const value = signal<string | null>("pro");

  return (
    <div class="flex flex-col gap-4">
      <RadioGroup name="plan-controlled" value={value}>
        <Label>Subscription plan</Label>
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
      <p class="text-sm text-muted">
        Selected plan: <span class="font-medium">{value()}</span>
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Controlled />
    </div>
  );
}
