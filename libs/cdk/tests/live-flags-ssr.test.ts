// Resumable server HTML of cdk parts with live state flags (`isDisabled={on()}`, `isReadOnly={on()}`,
// `isRequired={on()}`) and live controlled values: every accessor the parts store (state, aria bags, handler captures)
// must serialize. Resumed behaviour: tests-components/live-props.test.ts (`#lf-*`, `#lc-*`).
import { test } from "vitest";
import assert from "node:assert/strict";
import { importModule, renderHtml } from "./server.ts";

/** [name, imports, element: `$F` = live flags] */
const parts: [string, string, string][] = [
  [
    "TextField",
    `import { TextField } from "@rivetjs/cdk/text-field"; import { Input } from "@rivetjs/cdk/input";`,
    `<TextField aria-label="T" $F><Input /></TextField>`,
  ],
  [
    "SearchField",
    `import { SearchField } from "@rivetjs/cdk/search-field"; import { Input } from "@rivetjs/cdk/input";`,
    `<SearchField aria-label="S" $F><Input /></SearchField>`,
  ],
  [
    "NumberField",
    `import { NumberField } from "@rivetjs/cdk/number-field"; import { Input } from "@rivetjs/cdk/input";`,
    `<NumberField aria-label="N" $F><Input /></NumberField>`,
  ],
  ["RadioGroup", `import { Radio, RadioGroup } from "@rivetjs/cdk/radio-group";`, `<RadioGroup aria-label="R" $F><Radio value="a">A</Radio></RadioGroup>`],
  [
    "CheckboxField",
    `import { CheckboxField, CheckboxButton } from "@rivetjs/cdk/checkbox";`,
    `<CheckboxField $F><CheckboxButton>A</CheckboxButton></CheckboxField>`,
  ],
  ["Checkbox", `import { Checkbox } from "@rivetjs/cdk/checkbox";`, `<Checkbox $F>A</Checkbox>`],
  ["SwitchField", `import { SwitchField, SwitchButton } from "@rivetjs/cdk/switch";`, `<SwitchField $F><SwitchButton>A</SwitchButton></SwitchField>`],
  [
    "CheckboxGroup",
    `import { Checkbox, CheckboxGroup } from "@rivetjs/cdk/checkbox";`,
    `<CheckboxGroup aria-label="C" $F><Checkbox value="a">A</Checkbox></CheckboxGroup>`,
  ],
  [
    "ComboBox",
    `import { ComboBox } from "@rivetjs/cdk/combobox"; import { Input } from "@rivetjs/cdk/input"; import { Button } from "@rivetjs/cdk/button"; import { Popover } from "@rivetjs/cdk/popover"; import { ListBox, ListBoxItem } from "@rivetjs/cdk/listbox";`,
    `<ComboBox aria-label="P" $F><Input /><Button>v</Button><Popover><ListBox><ListBoxItem id="cat">Cat</ListBoxItem></ListBox></Popover></ComboBox>`,
  ],
  [
    "ComboBox selectedKey",
    `import { ComboBox } from "@rivetjs/cdk/combobox"; import { Input } from "@rivetjs/cdk/input"; import { Popover } from "@rivetjs/cdk/popover"; import { ListBox, ListBoxItem } from "@rivetjs/cdk/listbox";`,
    `<ComboBox aria-label="P" selectedKey={on() ? "dog" : "cat"} onSelectionChange={() => {}}><Input /><Popover><ListBox><ListBoxItem id="cat">Cat</ListBoxItem><ListBoxItem id="dog">Dog</ListBoxItem></ListBox></Popover></ComboBox>`,
  ],
  [
    "ColorField",
    `import { ColorField } from "@rivetjs/cdk/color-field"; import { Input } from "@rivetjs/cdk/input";`,
    `<ColorField aria-label="C" defaultValue="#ff0000" $F><Input /></ColorField>`,
  ],
  // Not here (gap, static props too): a channel ColorField (`ColorChannelField` capture #2) and ColorSlider + SliderTrack
  // (SliderTrack captures the transient `sliderView` with closures) do not render resumably in this harness.
  [
    "ColorArea",
    `import { ColorArea } from "@rivetjs/cdk/color-area"; import { ColorThumb } from "@rivetjs/cdk/color-thumb";`,
    `<ColorArea defaultValue="rgb(0, 0, 0)" xChannel="red" yChannel="green" $F><ColorThumb /></ColorArea>`,
  ],
  [
    "ColorWheel",
    `import { ColorWheel, ColorWheelTrack } from "@rivetjs/cdk/color-wheel"; import { ColorThumb } from "@rivetjs/cdk/color-thumb";`,
    `<ColorWheel outerRadius={100} innerRadius={80} defaultValue="hsl(0, 100%, 50%)" $F><ColorWheelTrack /><ColorThumb /></ColorWheel>`,
  ],
  [
    "DateField",
    `import { DateField, DateInput, DateSegment } from "@rivetjs/cdk/date-field";`,
    `<DateField aria-label="D" defaultValue="2024-03-10" $F><DateInput>{(s) => <DateSegment segment={s} />}</DateInput></DateField>`,
  ],
  ["TimeField", `import { TimeField } from "@rivetjs/cdk/date-field";`, `<TimeField aria-label="T" defaultValue="10:30" $F />`],
  ["DatePicker", `import { DatePicker } from "@rivetjs/cdk/date-picker";`, `<DatePicker aria-label="P" defaultValue="2024-03-10" $F />`],
  ["DateRangePicker", `import { DateRangePicker } from "@rivetjs/cdk/date-picker";`, `<DateRangePicker aria-label="R" $F />`],
  ["Calendar", `import { Calendar } from "@rivetjs/cdk/calendar";`, `<Calendar aria-label="C" defaultFocusedValue="2024-03-10" $F />`],
  ["RangeCalendar", `import { RangeCalendar } from "@rivetjs/cdk/range-calendar";`, `<RangeCalendar aria-label="RC" defaultFocusedValue="2024-03-10" $F />`],
];

const flags: Record<string, string> = {
  isDisabled: `isDisabled={on()}`,
  isReadOnly: `isReadOnly={on()}`,
  isRequired: `isRequired={on()} validationBehavior="native"`,
};

for (const [name, imports, element] of parts)
  for (const [flag, attr] of Object.entries(element.includes("$F") ? flags : { none: "" }))
    test(`${name}: live ${flag} renders resumably`, async () => {
      const source = `import { signal } from "@rivetjs/reactivity";
${imports}
export function Page() {
  const on = signal(false);
  return <section>{${element.replaceAll("$F", attr)}}</section>;
}`;
      const { Page } = await importModule<{ Page: () => unknown }>(`live-flags-${name.replace(/\W+/g, "-")}-${flag}.tsx`, source);
      const html = await renderHtml(() => Page());
      assert.match(html, /<section/);
    });

// LIVE-SWEEP (live by default): attribute-like props as live getters render resumably, with their current value.
const sweep: [string, string, string, RegExp][] = [
  [
    "TextField attributes",
    `import { TextField } from "@rivetjs/cdk/text-field"; import { Input } from "@rivetjs/cdk/input";`,
    `<TextField aria-label="T" type={on() ? "text" : "password"} inputMode={on() ? "email" : "text"} autoComplete={on() ? "email" : "off"} aria-haspopup={on() ? "listbox" : undefined} excludeFromTabOrder={on()}><Input /></TextField>`,
    /type="password"[^>]*|inputmode="text"/,
  ],
  [
    "SearchField attributes",
    `import { SearchField } from "@rivetjs/cdk/search-field"; import { Input } from "@rivetjs/cdk/input";`,
    `<SearchField aria-label="S" type={on() ? "text" : "search"} maxLength={on() ? 3 : 8} aria-describedby={on() ? "h" : undefined}><Input /></SearchField>`,
    /maxlength="8"/,
  ],
  [
    "NumberField step / min / max",
    `import { NumberField } from "@rivetjs/cdk/number-field"; import { Input } from "@rivetjs/cdk/input";`,
    `<NumberField aria-label="N" defaultValue={2} step={on() ? 5 : 1} minValue={on() ? 1 : 0} maxValue={on() ? 6 : 9}><Input placeholder={on() ? "P2" : "P1"} /></NumberField>`,
    /placeholder="P1"/,
  ],
  [
    "Button type",
    `import { Button } from "@rivetjs/cdk/button";`,
    `<Button type={on() ? "button" : "submit"} formMethod={on() ? "get" : "post"}>B</Button>`,
    /type="submit"/,
  ],
  [
    "Select placeholder / isRequired",
    `import { Select, SelectValue } from "@rivetjs/cdk/select"; import { Button } from "@rivetjs/cdk/button"; import { Label } from "@rivetjs/cdk/label"; import { Popover } from "@rivetjs/cdk/popover"; import { ListBox, ListBoxItem } from "@rivetjs/cdk/listbox";`,
    `<Select placeholder={on() ? "Pick" : "Choose"} isRequired={!on()}><Label>A</Label><Button><SelectValue /></Button><Popover><ListBox><ListBoxItem id="cat">Cat</ListBoxItem></ListBox></Popover></Select>`,
    /Choose[\s\S]*required|data-required="true"[\s\S]*Choose/,
  ],
];

for (const [name, imports, element, expected] of sweep)
  test(`${name}: live props render resumably with their current values`, async () => {
    const source = `import { signal } from "@rivetjs/reactivity";
${imports}
export function Page() {
  const on = signal(false);
  return <section>{${element}}</section>;
}`;
    const { Page } = await importModule<{ Page: () => unknown }>(`live-sweep-${name.replace(/\W+/g, "-")}.tsx`, source);
    const html = await renderHtml(() => Page());
    assert.match(html, expected);
  });
