// Type-level suite (`tsc -p libs/ui` only): `CheckboxButtonGroup` props (layout union, value string[] / Signal, CheckboxGroup field
// props), Item `value` required + render-prop children + `fieldClass`, Indicator content / function children, part span props;
// errors: bad layout, Item without `value`.
import { signal } from "@rivetjs/reactivity";
import { CheckboxButtonGroup } from "../src/components/checkbox-button-group/index.ts";
import type { CheckboxButtonGroupProps } from "../src/components/checkbox-button-group/index.ts";

const props: CheckboxButtonGroup["Props"] = { layout: "grid", defaultValue: ["a"], isRequired: true };
const rootProps: CheckboxButtonGroupProps = props;
const value = signal<string[]>(["a"]);

export const ok = () => (
  <>
    <CheckboxButtonGroup {...rootProps} name="x" onChange={(v: string[]) => void v}>
      <CheckboxButtonGroup.Item value="a" class="c" fieldClass="f" isDisabled>
        <CheckboxButtonGroup.Indicator>{({ isSelected }) => (isSelected() ? "on" : "off")}</CheckboxButtonGroup.Indicator>
        <CheckboxButtonGroup.ItemIcon class="i">I</CheckboxButtonGroup.ItemIcon>
        <CheckboxButtonGroup.ItemContent id="c">A</CheckboxButtonGroup.ItemContent>
      </CheckboxButtonGroup.Item>
      <CheckboxButtonGroup.Item value="b">
        {({ isSelected, isFocusVisible }) => <span>{isSelected() && isFocusVisible() ? "x" : "y"}</span>}
      </CheckboxButtonGroup.Item>
    </CheckboxButtonGroup>
    <CheckboxButtonGroup value={value} aria-label="Two-way">
      <CheckboxButtonGroup.Item value="a">A</CheckboxButtonGroup.Item>
    </CheckboxButtonGroup>
  </>
);

// @ts-expect-error unknown layout
export const badLayout = () => <CheckboxButtonGroup layout="list" />;
// @ts-expect-error Item needs a value
export const noValue = () => <CheckboxButtonGroup.Item>A</CheckboxButtonGroup.Item>;
