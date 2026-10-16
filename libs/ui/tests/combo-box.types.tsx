// Type-level suite (`tsc -p libs/ui` only): `ComboBox` props (cdk ComboBox props + variants + `class`), single / multiple values,
// two-way signals, accessor render props on the parts, compound statics.
import type { Key } from "@rivetjs/cdk/combobox";
import { signal } from "@rivetjs/reactivity";
import { ComboBox } from "../src/components/combo-box/index.ts";
import { Input } from "../src/components/input/index.ts";
import { ListBox } from "../src/components/list-box/index.ts";

const selected = signal<Key | null>(null);
const input = signal("");

export const single = () => (
  <ComboBox class="w-64" variant="secondary" fullWidth selectedKey={selected} inputValue={input} menuTrigger="input" isRequired name="a">
    <ComboBox.InputGroup class={({ isFocusWithin }) => (isFocusWithin() ? "ring" : "")}>
      <Input />
      <ComboBox.Trigger class={({ isPressed }) => (isPressed() ? "p" : "")} />
    </ComboBox.InputGroup>
    <ComboBox.Popover placement="bottom end" class="p">
      <ListBox>
        <ListBox.Item id="a">A</ListBox.Item>
      </ListBox>
    </ComboBox.Popover>
  </ComboBox>
);

export const multiple = () => (
  <ComboBox selectionMode="multiple" defaultValue={["a"]} onChange={(keys) => void keys.length}>
    {({ isOpen }) => (
      <>
        <ComboBox.Value placeholder="none">{({ isPlaceholder, selectedText }) => (isPlaceholder() ? "none" : selectedText())}</ComboBox.Value>
        {isOpen() ? "open" : null}
      </>
    )}
  </ComboBox>
);

export type Props = ComboBox["Props"];
export type TriggerProps = ComboBox["TriggerProps"];
// @ts-expect-error -- unknown variant
export const bad = () => <ComboBox variant="tertiary" />;
