// Type-level suite (`tsc -p libs/ui` only): `Select` props (cdk Select parts form props + variants + `onClear` + `class`), single /
// multiple values, accessor render props on the parts, compound statics.
import type { Key } from "@rivetjs/cdk/select";
import { signal } from "@rivetjs/reactivity";
import { ListBox } from "../src/components/list-box/index.ts";
import { Select } from "../src/components/select/index.ts";

const value = signal<Key | null>(null);

export const single = () => (
  <Select class="w-64" variant="secondary" fullWidth placeholder="Pick" value={value} onClear={() => void 0} isRequired name="s">
    <Select.Trigger class={({ isFocusVisible }) => (isFocusVisible() ? "ring" : "")}>
      <Select.Value>{({ isPlaceholder, selectedText }) => (isPlaceholder() ? "none" : selectedText())}</Select.Value>
      <Select.ClearButton class="c" />
      <Select.Indicator class="i" />
    </Select.Trigger>
    <Select.Popover placement="bottom end" class="p">
      <ListBox>
        <ListBox.Item id="a">A</ListBox.Item>
      </ListBox>
    </Select.Popover>
  </Select>
);

export const multiple = () => (
  <Select selectionMode="multiple" defaultValue={["a"]} onChange={(keys) => void keys.length}>
    {({ isOpen }) => (
      <Select.Trigger>
        <Select.Value />
        {isOpen() ? "open" : null}
      </Select.Trigger>
    )}
  </Select>
);

export type Props = Select["Props"];
export type TriggerProps = Select["TriggerProps"];
// @ts-expect-error -- unknown variant
export const bad = () => <Select variant="tertiary" />;
