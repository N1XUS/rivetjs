// Type-level tests (`tsc -p libs/ui` only): Checkbox / CheckboxGroup / Radio / RadioGroup / Switch / SwitchGroup props.
import { signal } from "@rivetjs/reactivity";
import { Checkbox } from "../src/components/checkbox/index.ts";
import type { Checkbox as CheckboxTypes, CheckboxRenderProps } from "../src/components/checkbox/index.ts";
import { CheckboxGroup } from "../src/components/checkbox-group/index.ts";
import { Radio } from "../src/components/radio/index.ts";
import { RadioGroup } from "../src/components/radio-group/index.ts";
import { Switch } from "../src/components/switch/index.ts";
import { SwitchGroup } from "../src/components/switch-group/index.ts";

const on = signal(false);
const picks = signal<string[]>([]);
const plan = signal<string | null>("a");

export const ok = [
  <Checkbox class="c" isSelected={on} name="terms" value="t" variant="secondary" onChange={(v: boolean) => v}>
    <Checkbox.Content class="x">
      <Checkbox.Control>
        <Checkbox.Indicator>{(s: CheckboxRenderProps) => (s.isSelected() ? "y" : "n")}</Checkbox.Indicator>
      </Checkbox.Control>
      Terms
    </Checkbox.Content>
  </Checkbox>,
  <Checkbox isIndeterminate defaultSelected isDisabled>
    <Checkbox.Content>
      <Checkbox.Control render={(p) => <span {...p} />}>
        <Checkbox.Indicator />
      </Checkbox.Control>
    </Checkbox.Content>
  </Checkbox>,
  <CheckboxGroup value={picks} variant="primary" isDisabled name="g" onChange={(v: string[]) => v.length}>
    <Checkbox value="a" />
  </CheckboxGroup>,
  <RadioGroup value={plan} name="plan" variant="secondary" orientation="horizontal" onChange={(v: string) => v}>
    <Radio value="a">
      <Radio.Content>
        <Radio.Control>
          <Radio.Indicator />
        </Radio.Control>
      </Radio.Content>
    </Radio>
  </RadioGroup>,
  <Switch isSelected={on} size="lg" onChange={(v: boolean) => v}>
    <Switch.Content>
      <Switch.Control>
        <Switch.Thumb>
          <Switch.Icon>x</Switch.Icon>
        </Switch.Thumb>
      </Switch.Control>
    </Switch.Content>
  </Switch>,
  <SwitchGroup orientation="horizontal" class="s">
    <Switch />
  </SwitchGroup>,
];

export const props: CheckboxTypes["Props"] = { variant: "primary" };

// @ts-expect-error bad variant
export const bad1 = <Checkbox variant="tertiary" />;
// @ts-expect-error bad size
export const bad2 = <Switch size="xl" />;
// @ts-expect-error bad orientation
export const bad3 = <SwitchGroup orientation="diagonal" />;
// @ts-expect-error Radio needs a value
export const bad4 = <Radio />;
