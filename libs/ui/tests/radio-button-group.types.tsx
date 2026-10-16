// Type-level suite (`tsc -p libs/ui` only): `RadioButtonGroup` props (layout union, value string / Signal, RadioGroup field
// props), Item `value` required + render-prop children + `fieldClass`, Indicator content / function children, part span props;
// errors: bad layout, Item without `value`.
import { signal } from "@rivetjs/reactivity";
import { RadioButtonGroup } from "../src/components/radio-button-group/index.ts";
import type { RadioButtonGroupProps } from "../src/components/radio-button-group/index.ts";

const props: RadioButtonGroup["Props"] = { layout: "grid", defaultValue: "a", isRequired: true, orientation: "horizontal" };
const rootProps: RadioButtonGroupProps = props;
const value = signal<string | null>("a");

export const ok = () => (
  <>
    <RadioButtonGroup {...rootProps} name="x" onChange={(v: string) => void v}>
      <RadioButtonGroup.Item value="a" class="c" fieldClass="f" isDisabled>
        <RadioButtonGroup.Indicator>{({ isSelected }) => (isSelected() ? "on" : "off")}</RadioButtonGroup.Indicator>
        <RadioButtonGroup.ItemIcon class="i">I</RadioButtonGroup.ItemIcon>
        <RadioButtonGroup.ItemContent id="c">A</RadioButtonGroup.ItemContent>
      </RadioButtonGroup.Item>
      <RadioButtonGroup.Item value="b">{({ isSelected, isFocusVisible }) => <span>{isSelected() && isFocusVisible() ? "x" : "y"}</span>}</RadioButtonGroup.Item>
    </RadioButtonGroup>
    <RadioButtonGroup value={value} aria-label="Two-way">
      <RadioButtonGroup.Item value="a">A</RadioButtonGroup.Item>
    </RadioButtonGroup>
  </>
);

// @ts-expect-error unknown layout
export const badLayout = () => <RadioButtonGroup layout="list" />;
// @ts-expect-error Item needs a value
export const noValue = () => <RadioButtonGroup.Item>A</RadioButtonGroup.Item>;
