// Type-level suite (`tsc -p libs/ui` only): `NativeSelect` props (variant union, fullWidth, value string / Signal, TextField
// field props), Trigger `wrapperClass` / `indicator` (content or null), Option `value` required, OptGroup `label` required;
// errors: bad variant, Option without `value`, OptGroup without `label`.
import { signal } from "@rivetjs/reactivity";
import { NativeSelect } from "../src/components/native-select/index.ts";
import type { NativeSelectProps } from "../src/components/native-select/index.ts";

const props: NativeSelect["Props"] = { variant: "secondary", fullWidth: true, defaultValue: "a", isRequired: true };
const rootProps: NativeSelectProps = props;
const value = signal("a");

export const ok = () => (
  <>
    <NativeSelect {...rootProps} name="x" onChange={(v: string) => void v}>
      <NativeSelect.Trigger class="c" wrapperClass="w" indicator={<NativeSelect.Indicator>v</NativeSelect.Indicator>}>
        <NativeSelect.OptGroup label="G">
          <NativeSelect.Option value="a" disabled>
            A
          </NativeSelect.Option>
        </NativeSelect.OptGroup>
      </NativeSelect.Trigger>
    </NativeSelect>
    <NativeSelect value={value} isInvalid>
      <NativeSelect.Trigger indicator={null}>
        <NativeSelect.Option value="a">A</NativeSelect.Option>
      </NativeSelect.Trigger>
    </NativeSelect>
  </>
);

export const bad = () => (
  <>
    {/* @ts-expect-error: unknown variant */}
    <NativeSelect variant="ghost" />
    {/* @ts-expect-error: Option needs a value */}
    <NativeSelect.Option>A</NativeSelect.Option>
    {/* @ts-expect-error: OptGroup needs a label */}
    <NativeSelect.OptGroup>A</NativeSelect.OptGroup>
  </>
);
