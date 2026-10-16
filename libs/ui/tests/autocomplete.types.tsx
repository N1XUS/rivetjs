// Type-level suite (`tsc -p libs/ui` only): `Autocomplete` props (cdk Select parts form props + variants + `onClear` + `class`),
// single / multiple values, the Filter's `filter`, accessor render props on the parts, compound statics.
import type { Key } from "@rivetjs/cdk/select";
import { signal } from "@rivetjs/reactivity";
import { Autocomplete } from "../src/components/autocomplete/index.ts";
import { ListBox } from "../src/components/list-box/index.ts";

const value = signal<Key | null>(null);

export const single = () => (
  <Autocomplete class="w-64" variant="secondary" fullWidth placeholder="Pick" value={value} onClear={() => void 0} isRequired name="s">
    <Autocomplete.Trigger class={({ isHovered }) => (isHovered() ? "h" : "")}>
      <Autocomplete.Value>{({ isPlaceholder, selectedText }) => (isPlaceholder() ? "none" : selectedText())}</Autocomplete.Value>
      <Autocomplete.ClearButton class="c" />
      <Autocomplete.Indicator class="i" />
    </Autocomplete.Trigger>
    <Autocomplete.Popover placement="bottom end" class="p">
      <Autocomplete.Filter filter={(text, input) => text.startsWith(input)}>
        <ListBox>
          <ListBox.Item id="a">A</ListBox.Item>
        </ListBox>
      </Autocomplete.Filter>
    </Autocomplete.Popover>
  </Autocomplete>
);

export const multiple = () => (
  <Autocomplete selectionMode="multiple" defaultValue={["a"]} onChange={(keys) => void keys.length}>
    <Autocomplete.Trigger>
      <Autocomplete.Value />
    </Autocomplete.Trigger>
  </Autocomplete>
);

export type Props = Autocomplete["Props"];
export type FilterProps = Autocomplete["FilterProps"];
// @ts-expect-error -- unknown variant
export const bad = () => <Autocomplete variant="tertiary" />;
