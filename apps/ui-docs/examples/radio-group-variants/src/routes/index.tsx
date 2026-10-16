// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/radio-group/variants.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Description } from "@rivetjs/ui/description";
import { Radio } from "@rivetjs/ui/radio";
import { RadioGroup } from "@rivetjs/ui/radio-group";

export const head = { title: "RadioGroup: Variants" };

// #region demo
export function Variants() {
  return (
    <div class="flex flex-col gap-8">
      <div class="flex flex-col gap-2">
        <p class="text-sm font-medium text-muted">Primary variant</p>
        <RadioGroup defaultValue="option1" name="primary-plan" variant="primary">
          <Radio value="option1">
            <Radio.Content>
              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
              Option 1
            </Radio.Content>
            <Description>Standard styling with default background</Description>
          </Radio>
          <Radio value="option2">
            <Radio.Content>
              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
              Option 2
            </Radio.Content>
            <Description>Another option with primary styling</Description>
          </Radio>
        </RadioGroup>
      </div>
      <div class="flex flex-col gap-2">
        <p class="text-sm font-medium text-muted">Secondary variant</p>
        <RadioGroup defaultValue="option1" name="secondary-plan" variant="secondary">
          <Radio value="option1">
            <Radio.Content>
              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
              Option 1
            </Radio.Content>
            <Description>Lower emphasis variant for use in surfaces</Description>
          </Radio>
          <Radio value="option2">
            <Radio.Content>
              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
              Option 2
            </Radio.Content>
            <Description>Another option with secondary styling</Description>
          </Radio>
        </RadioGroup>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Variants />
    </div>
  );
}
