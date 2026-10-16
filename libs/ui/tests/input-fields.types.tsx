// Type-level tests (`tsc -p libs/ui` only): InputGroup / SearchField / NumberField props.
import { InputGroup } from "../src/components/input-group/index.ts";
import type { InputGroup as InputGroupTypes } from "../src/components/input-group/index.ts";
import { NumberField } from "../src/components/number-field/index.ts";
import { SearchField } from "../src/components/search-field/index.ts";

export const ok = [
  <InputGroup fullWidth variant="secondary" onClick={(e: MouseEvent) => e.preventDefault()}>
    <InputGroup.Prefix class="x">$</InputGroup.Prefix>
    <InputGroup.Input placeholder="0" />
    <InputGroup.TextArea rows={2} />
    <InputGroup.Suffix>USD</InputGroup.Suffix>
  </InputGroup>,
  <SearchField defaultValue="a" onChange={(v: string) => v.length} variant="primary" fullWidth>
    <SearchField.Group class={({ isFocusWithin }) => (isFocusWithin() ? "f" : "")}>
      <SearchField.SearchIcon class="i" />
      <SearchField.Input />
      <SearchField.ClearButton />
    </SearchField.Group>
  </SearchField>,
  <NumberField defaultValue={1} minValue={0} maxValue={9} step={1} onChange={(v: number) => v + 1} formatOptions={{ style: "percent" }}>
    <NumberField.Group>
      <NumberField.DecrementButton />
      <NumberField.Input />
      <NumberField.IncrementButton />
    </NumberField.Group>
  </NumberField>,
];

export const props: InputGroupTypes["PrefixProps"] = { children: "$" };

// @ts-expect-error bad variant
export const bad1 = <InputGroup variant="tertiary" />;
// @ts-expect-error bad variant
export const bad2 = <SearchField variant="ghost" />;
// @ts-expect-error onChange takes a number
export const bad3 = <NumberField onChange={(v: string) => v} />;
