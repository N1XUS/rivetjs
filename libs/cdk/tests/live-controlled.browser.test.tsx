// Live props: a controlled value passed as a value-form expression (`value={n()}`, `selectedKeys={keys()}`,
// `isOpen={open()}`) reaches the part as a getter and must stay live — React Aria semantics: a controlled component
// always shows its prop. The state takes it as a read-only accessor (never written; changes only call the handler).
// One case per component: a prop change after mount updates the same elements in place. Resumed pages:
// tests-components/live-props.test.ts (`#lc-*`).
import { afterEach, describe, expect, it } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal } from "@rivetjs/reactivity";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { CalendarDate, Time } from "@rivetjs/cdk/date";
import { NumberField } from "../number-field/index.tsx";
import { Input } from "../input/index.tsx";
import { Label } from "../label/index.tsx";
import { Group } from "../group/index.tsx";
import { Button } from "../button/index.tsx";
import { Radio, RadioGroup } from "../radio-group/index.tsx";
import { Checkbox, CheckboxGroup } from "../checkbox/index.tsx";
import { ComboBox } from "../combobox/index.tsx";
import { Popover } from "../popover/index.tsx";
import { ListBox, ListBoxItem } from "../listbox/index.tsx";
import { ColorField } from "../color-field/index.tsx";
import { ColorSlider } from "../color-slider/index.tsx";
import { ColorThumb } from "../color-thumb/index.tsx";
import { SliderTrack } from "../slider/index.tsx";
import { ColorArea } from "../color-area/index.tsx";
import { ColorWheel, ColorWheelTrack } from "../color-wheel/index.tsx";
import { DateField, TimeField, DateInput, DateSegment } from "../date-field/index.tsx";
import { Calendar, CalendarGrid, CalendarCell } from "../calendar/index.tsx";
import { ToggleButtonGroup } from "../toggle-button-group/index.tsx";
import { ToggleButton } from "../toggle-button/index.tsx";
import { Disclosure, DisclosureGroup, DisclosurePanel } from "../disclosure/index.tsx";
import { GridList, GridListItem } from "../grid-list/index.tsx";
import { Tag, TagGroup, TagList } from "../tag-group/index.tsx";
import { DialogTrigger, Dialog } from "../dialog/index.tsx";
import { Modal } from "../modal/index.tsx";
import { parseColor } from "../color/index.ts";
import { Tree, TreeItem, TreeItemContent } from "../tree/index.tsx";
import { Menu, MenuItem, MenuTrigger } from "../menu/index.tsx";
import { DatePicker, DateRangePicker } from "../date-picker/index.tsx";
import { RangeCalendar } from "../calendar/index.tsx";
import { userEvent } from "@testing-library/user-event";
import { TextField } from "../text-field/index.tsx";
import { SearchField } from "../search-field/index.tsx";
import { CheckboxField, CheckboxButton } from "../checkbox/index.tsx";
import { SwitchButton, SwitchField } from "../switch/index.tsx";

afterEach(cleanup);
const mount = (ui: () => unknown) => render(ui as never).container as HTMLElement;

// Live state flags (`isDisabled={d()}`, `isReadOnly={r()}`, `isRequired={q()}`): read on every use like a React Aria
// prop re-read per render — attributes follow in place, handlers check the current value at event time.
describe("live flags: CheckboxGroup / ComboBox", () => {
  it("CheckboxGroup isDisabled / isReadOnly / isRequired follow the prop in place", () => {
    const off = signal(false);
    const ro = signal(false);
    const req = signal(false);
    const v = signal<string[]>([]);
    const root = mount(() => (
      <CheckboxGroup aria-label="c" value={v} isDisabled={off()} isReadOnly={ro()} isRequired={req()} validationBehavior="native">
        <Checkbox value="a">A</Checkbox>
        <Checkbox value="b">B</Checkbox>
      </CheckboxGroup>
    ));
    const group = root.querySelector("[role=group]")!;
    const inputs = [...root.querySelectorAll("input")];
    const labels = [...root.querySelectorAll("label")];
    expect(group).not.toHaveAttribute("data-disabled");
    expect(inputs[0]!.disabled).toBe(false);
    off.set(true);
    flush();
    expect(root.querySelector("[role=group]")).toBe(group);
    expect([...root.querySelectorAll("input")]).toEqual(inputs);
    expect(group).toHaveAttribute("data-disabled", "true");
    expect(group).toHaveAttribute("aria-disabled", "true");
    expect(inputs[0]!.disabled).toBe(true);
    expect(labels[0]).toHaveAttribute("data-disabled", "true");
    off.set(false);
    ro.set(true);
    flush();
    expect(group).not.toHaveAttribute("data-disabled");
    expect(group).toHaveAttribute("data-readonly", "true");
    expect(labels[0]).toHaveAttribute("data-readonly", "true");
    expect(inputs[0]!.disabled).toBe(false);
    // Read-only: a click does not change the value.
    inputs[0]!.click();
    flush();
    expect(v()).toEqual([]);
    ro.set(false);
    flush();
    expect(group).not.toHaveAttribute("data-readonly");
    inputs[0]!.click();
    flush();
    expect(v()).toEqual(["a"]);
    v.set([]);
    req.set(true);
    flush();
    expect(group).toHaveAttribute("data-required", "true");
    expect(inputs[0]!.required).toBe(true);
    req.set(false);
    flush();
    expect(group).not.toHaveAttribute("data-required");
    expect(inputs[0]!.required).toBe(false);
  });
  it("ComboBox isDisabled / isReadOnly / isRequired follow the prop in place", () => {
    const off = signal(false);
    const ro = signal(false);
    const req = signal(false);
    const root = mount(() => (
      <ComboBox aria-label="cb" isDisabled={off()} isReadOnly={ro()} isRequired={req()} validationBehavior="native">
        <Input />
        <Button>v</Button>
        <Popover>
          <ListBox>
            <ListBoxItem id="1">Cat</ListBoxItem>
            <ListBoxItem id="2">Dog</ListBoxItem>
          </ListBox>
        </Popover>
      </ComboBox>
    ));
    const box = root.querySelector(".rv-ComboBox")!;
    const input = root.querySelector("input")!;
    const button = root.querySelector("button")!;
    expect(input.disabled).toBe(false);
    off.set(true);
    flush();
    expect(root.querySelector("input")).toBe(input);
    expect(input.disabled).toBe(true);
    expect(button.disabled).toBe(true);
    expect(box).toHaveAttribute("data-disabled", "true");
    off.set(false);
    ro.set(true);
    flush();
    expect(input.disabled).toBe(false);
    expect(input.readOnly).toBe(true);
    expect(box).toHaveAttribute("data-readonly", "true");
    expect(box).not.toHaveAttribute("data-disabled");
    expect(button.disabled).toBe(true);
    // Read-only: ArrowDown does not open the list.
    input.focus();
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    flush();
    expect(input).toHaveAttribute("aria-expanded", "false");
    ro.set(false);
    flush();
    expect(input.readOnly).toBe(false);
    expect(button.disabled).toBe(false);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    flush();
    expect(input).toHaveAttribute("aria-expanded", "true");
    req.set(true);
    flush();
    expect(input.required).toBe(true);
    expect(box).toHaveAttribute("data-required", "true");
    expect(root.querySelector("input")).toBe(input);
  });
  it("ComboBox selectedKey: the input node is kept and its text follows", () => {
    const v = signal<string | null>("1");
    const root = mount(() => (
      <ComboBox selectedKey={v()} onSelectionChange={() => {}} aria-label="cb">
        <Input />
        <Popover>
          <ListBox>
            <ListBoxItem id="1">Cat</ListBoxItem>
            <ListBoxItem id="2">Dog</ListBoxItem>
          </ListBox>
        </Popover>
      </ComboBox>
    ));
    const input = root.querySelector("input")!;
    expect(input.value).toBe("Cat");
    v.set("2");
    flush();
    expect(root.querySelector("input")).toBe(input);
    expect(input.value).toBe("Dog");
    v.set(null);
    flush();
    expect(input.value).toBe("");
  });
});

// `isRequired={q()}`: RA re-reads it per render — root `data-required` and the input's native `required` /
// `aria-required` follow the prop on the same nodes.
describe("live flags: isRequired", () => {
  const cases: [string, (req: () => boolean) => unknown, string][] = [
    [
      "TextField",
      (req) => (
        <TextField aria-label="t" isRequired={req()} validationBehavior="native">
          <Input />
        </TextField>
      ),
      ".rv-TextField",
    ],
    [
      "SearchField",
      (req) => (
        <SearchField aria-label="s" isRequired={req()} validationBehavior="native">
          <Input />
        </SearchField>
      ),
      ".rv-SearchField",
    ],
    [
      "NumberField",
      (req) => (
        <NumberField aria-label="n" isRequired={req()} validationBehavior="native">
          <Input />
        </NumberField>
      ),
      ".rv-NumberField",
    ],
    [
      "RadioGroup",
      (req) => (
        <RadioGroup aria-label="r" isRequired={req()} validationBehavior="native">
          <Radio value="a">A</Radio>
        </RadioGroup>
      ),
      ".rv-RadioGroup",
    ],
    [
      "CheckboxField",
      (req) => (
        <CheckboxField isRequired={req()} validationBehavior="native">
          <CheckboxButton>A</CheckboxButton>
        </CheckboxField>
      ),
      ".rv-CheckboxField",
    ],
    [
      "Checkbox",
      (req) => (
        <Checkbox isRequired={req()} validationBehavior="native">
          A
        </Checkbox>
      ),
      ".rv-Checkbox",
    ],
  ];
  for (const [name, ui, root] of cases)
    it(`${name} isRequired follows the prop in place`, () => {
      const req = signal(false);
      const container = mount(() => ui(req));
      const el = container.querySelector(root)!;
      const input = container.querySelector("input")!;
      expect(el).not.toHaveAttribute("data-required");
      expect(input.required).toBe(false);
      req.set(true);
      flush();
      expect(container.querySelector(root)).toBe(el);
      expect(container.querySelector("input")).toBe(input);
      expect(el).toHaveAttribute("data-required", "true");
      expect(input.required).toBe(true);
      req.set(false);
      flush();
      expect(el).not.toHaveAttribute("data-required");
      expect(input.required).toBe(false);
    });
  it("SwitchField isRequired follows the prop in place", () => {
    const req = signal(false);
    const container = mount(() => (
      <SwitchField isRequired={req()}>
        <SwitchButton>S</SwitchButton>
      </SwitchField>
    ));
    const el = container.querySelector(".rv-SwitchField")!;
    expect(el).not.toHaveAttribute("data-required");
    req.set(true);
    flush();
    expect(container.querySelector(".rv-SwitchField")).toBe(el);
    expect(el).toHaveAttribute("data-required", "true");
    expect(container.querySelector(".rv-SwitchButton")).toHaveAttribute("data-required", "true");
  });
  it("TextField aria-required follows a live isRequired (aria validation)", () => {
    const req = signal(false);
    const container = mount(() => (
      <TextField aria-label="t" isRequired={req()} validationBehavior="aria">
        <Input />
      </TextField>
    ));
    const input = container.querySelector("input")!;
    expect(input).not.toHaveAttribute("aria-required");
    req.set(true);
    flush();
    expect(input).toHaveAttribute("aria-required", "true");
    expect(input.required).toBe(false);
  });
});

describe("live controlled values", () => {
  it("NumberField value: follows the prop in place; edits report through onChange, the prop decides", () => {
    const v = signal(1);
    const seen: number[] = [];
    const root = mount(() => (
      <NumberField value={v()} onChange={(n) => seen.push(n)} aria-label="n">
        <Group>
          <Input />
        </Group>
      </NumberField>
    ));
    const input = root.querySelector("input")!;
    expect(input.value).toBe("1");
    v.set(5);
    flush();
    expect(root.querySelector("input")).toBe(input);
    expect(input.value).toBe("5");
    input.focus();
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowUp", bubbles: true }));
    flush();
    expect(seen).toEqual([6]);
    // Controlled: the parent did not take the change, the field keeps showing the prop.
    expect(input.value).toBe("5");
    v.set(6);
    flush();
    expect(input.value).toBe("6");
  });
  it("RadioGroup value", () => {
    const v = signal("a");
    const root = mount(() => (
      <RadioGroup value={v()} onChange={() => {}} aria-label="r">
        <Radio value="a">A</Radio>
        <Radio value="b">B</Radio>
      </RadioGroup>
    ));
    const inputs = [...root.querySelectorAll("input")];
    expect(inputs[0]!.checked).toBe(true);
    v.set("b");
    flush();
    expect([...root.querySelectorAll("input")]).toEqual(inputs);
    expect(inputs[0]!.checked).toBe(false);
    expect(inputs[1]!.checked).toBe(true);
  });
  it("CheckboxGroup value", () => {
    const v = signal<string[]>(["a"]);
    const root = mount(() => (
      <CheckboxGroup value={v()} onChange={(n) => v.set(n)} aria-label="c">
        <Checkbox value="a">A</Checkbox>
        <Checkbox value="b">B</Checkbox>
      </CheckboxGroup>
    ));
    v.set(["b"]);
    flush();
    expect((root.querySelectorAll("input")[1] as HTMLInputElement).checked).toBe(true);
  });
  it("ComboBox selectedKey", () => {
    const v = signal<string | null>("1");
    const root = mount(() => (
      <ComboBox selectedKey={v()} onSelectionChange={(k) => v.set(k as string)} aria-label="cb">
        <Input />
        <Popover>
          <ListBox>
            <ListBoxItem id="1">Cat</ListBoxItem>
            <ListBoxItem id="2">Dog</ListBoxItem>
          </ListBox>
        </Popover>
      </ComboBox>
    ));
    v.set("2");
    flush();
    expect(root.querySelector("input")!.value).toBe("Dog");
  });
  it("ComboBox inputValue", () => {
    const v = signal("x");
    const root = mount(() => (
      <ComboBox inputValue={v()} onInputChange={(k) => v.set(k)} aria-label="cb">
        <Input />
        <Popover>
          <ListBox>
            <ListBoxItem id="1">Cat</ListBoxItem>
          </ListBox>
        </Popover>
      </ComboBox>
    ));
    v.set("yy");
    flush();
    expect(root.querySelector("input")!.value).toBe("yy");
  });
  it("ColorField value", () => {
    const v = signal(parseColor("#ff0000"));
    const root = mount(() => (
      <ColorField value={v()} onChange={(c) => c && v.set(c)} aria-label="cf">
        <Input />
      </ColorField>
    ));
    v.set(parseColor("#00ff00"));
    flush();
    expect(root.querySelector("input")!.value.toLowerCase()).toBe("#00ff00");
  });
  it("ColorSlider value", () => {
    const v = signal(parseColor("hsl(0, 100%, 50%)"));
    const root = mount(() => (
      <ColorSlider value={v()} onChange={(c) => v.set(c)} channel="hue" aria-label="cs">
        <SliderTrack>
          <ColorThumb />
        </SliderTrack>
      </ColorSlider>
    ));
    v.set(parseColor("hsl(120, 100%, 50%)"));
    flush();
    expect(root.querySelector("input")!.value).toBe("120");
  });
  it("ColorArea value", () => {
    const v = signal(parseColor("rgb(255, 0, 0)"));
    const root = mount(() => (
      <ColorArea value={v()} onChange={(c) => v.set(c)} xChannel="red" yChannel="green">
        <ColorThumb />
      </ColorArea>
    ));
    v.set(parseColor("rgb(10, 0, 0)"));
    flush();
    expect(root.querySelector("input")!.value).toBe("10");
  });
  it("ColorWheel value", () => {
    const v = signal(parseColor("hsl(0, 100%, 50%)"));
    const root = mount(() => (
      <ColorWheel value={v()} onChange={(c) => v.set(c)} outerRadius={100} innerRadius={80}>
        <ColorWheelTrack />
        <ColorThumb />
      </ColorWheel>
    ));
    v.set(parseColor("hsl(90, 100%, 50%)"));
    flush();
    expect(root.querySelector("input")!.value).toBe("90");
  });
  it("DateField value", () => {
    const v = signal(new CalendarDate(2024, 3, 10));
    const root = mount(() => (
      <DateField value={v()} onChange={(d) => d && v.set(d as CalendarDate)} aria-label="d">
        <DateInput>{(s) => <DateSegment segment={s} />}</DateInput>
      </DateField>
    ));
    v.set(new CalendarDate(2025, 4, 11));
    flush();
    expect(root.textContent).toContain("2025");
  });
  it("TimeField value", () => {
    const v = signal(new Time(10, 30));
    const root = mount(() => (
      <TimeField value={v()} onChange={(d) => d && v.set(d as Time)} aria-label="t">
        <DateInput>{(s) => <DateSegment segment={s} />}</DateInput>
      </TimeField>
    ));
    v.set(new Time(11, 45));
    flush();
    expect(root.textContent).toContain("45");
  });
  it("Calendar value", () => {
    const v = signal(new CalendarDate(2024, 3, 10));
    const root = mount(() => (
      <Calendar value={v()} onChange={(d) => v.set(d as CalendarDate)} aria-label="c">
        <CalendarGrid>{(date) => <CalendarCell date={date} />}</CalendarGrid>
      </Calendar>
    ));
    v.set(new CalendarDate(2024, 3, 12));
    flush();
    expect(root.querySelector("[aria-selected=true]")?.textContent).toContain("12");
  });
  it("ToggleButtonGroup selectedKeys", () => {
    const v = signal<Set<string>>(new Set(["a"]));
    const root = mount(() => (
      <ToggleButtonGroup selectedKeys={v()} onSelectionChange={(k) => v.set(k as Set<string>)}>
        <ToggleButton id="a">A</ToggleButton>
        <ToggleButton id="b">B</ToggleButton>
      </ToggleButtonGroup>
    ));
    v.set(new Set(["b"]));
    flush();
    expect(root.querySelectorAll("button")[1]).toHaveAttribute("aria-checked", "true");
  });
  it("DisclosureGroup expandedKeys", () => {
    const v = signal<Set<string>>(new Set(["a"]));
    const root = mount(() => (
      <DisclosureGroup expandedKeys={v()} onExpandedChange={(k) => v.set(k as Set<string>)}>
        <Disclosure id="a">
          <Button slot="trigger">A</Button>
          <DisclosurePanel>pa</DisclosurePanel>
        </Disclosure>
        <Disclosure id="b">
          <Button slot="trigger">B</Button>
          <DisclosurePanel>pb</DisclosurePanel>
        </Disclosure>
      </DisclosureGroup>
    ));
    v.set(new Set(["b"]));
    flush();
    expect(root.querySelectorAll("button")[1]).toHaveAttribute("aria-expanded", "true");
  });
  it("ListBox selectedKeys", () => {
    const v = signal<Set<string>>(new Set(["a"]));
    const root = mount(() => (
      <ListBox aria-label="l" selectionMode="single" selectedKeys={v()} onSelectionChange={(k) => v.set(k as Set<string>)}>
        <ListBoxItem id="a">A</ListBoxItem>
        <ListBoxItem id="b">B</ListBoxItem>
      </ListBox>
    ));
    v.set(new Set(["b"]));
    flush();
    expect(root.querySelectorAll("[role=option]")[1]).toHaveAttribute("aria-selected", "true");
  });
  it("GridList selectedKeys", () => {
    const v = signal<Set<string>>(new Set(["a"]));
    const root = mount(() => (
      <GridList aria-label="l" selectionMode="single" selectedKeys={v()} onSelectionChange={(k) => v.set(k as Set<string>)}>
        <GridListItem id="a">A</GridListItem>
        <GridListItem id="b">B</GridListItem>
      </GridList>
    ));
    v.set(new Set(["b"]));
    flush();
    expect(root.querySelectorAll("[role=row]")[1]).toHaveAttribute("aria-selected", "true");
  });
  it("TagGroup selectedKeys", () => {
    const v = signal<Set<string>>(new Set(["a"]));
    const root = mount(() => (
      <TagGroup aria-label="l" selectionMode="single" selectedKeys={v()} onSelectionChange={(k) => v.set(k as Set<string>)}>
        <TagList>
          <Tag id="a">A</Tag>
          <Tag id="b">B</Tag>
        </TagList>
      </TagGroup>
    ));
    v.set(new Set(["b"]));
    flush();
    expect(root.querySelectorAll("[role=row]")[1]).toHaveAttribute("aria-selected", "true");
  });
  it("DialogTrigger isOpen", () => {
    const v = signal(false);
    mount(() => (
      <DialogTrigger isOpen={v()} onOpenChange={(o) => v.set(o)}>
        <Button>open</Button>
        <Modal>
          <Dialog aria-label="dd">hi</Dialog>
        </Modal>
      </DialogTrigger>
    ));
    v.set(true);
    flush();
    expect(document.querySelector("[role=dialog]")).not.toBeNull();
  });
  it("Tree expandedKeys / selectedKeys", () => {
    const expanded = signal<Set<string>>(new Set());
    const selected = signal<Set<string>>(new Set());
    const root = mount(() => (
      <Tree aria-label="t" selectionMode="single" expandedKeys={expanded()} selectedKeys={selected()}>
        <TreeItem id="a" textValue="A">
          <TreeItemContent>A</TreeItemContent>
          <TreeItem id="a1" textValue="A1">
            <TreeItemContent>A1</TreeItemContent>
          </TreeItem>
        </TreeItem>
      </Tree>
    ));
    expect(root.querySelectorAll("[role=row]").length).toBe(1);
    expanded.set(new Set(["a"]));
    selected.set(new Set(["a"]));
    flush();
    expect(root.querySelectorAll("[role=row]").length).toBe(2);
    expect(root.querySelector("[role=row]")).toHaveAttribute("aria-expanded", "true");
    expect(root.querySelector("[role=row]")).toHaveAttribute("aria-selected", "true");
  });
  it("Menu selectedKeys", () => {
    const v = signal<Set<string>>(new Set(["a"]));
    const root = mount(() => (
      <Menu aria-label="m" selectionMode="single" selectedKeys={v()} onSelectionChange={() => {}}>
        <MenuItem id="a">A</MenuItem>
        <MenuItem id="b">B</MenuItem>
      </Menu>
    ));
    const items = [...root.querySelectorAll("[role=menuitemradio]")];
    expect(items[0]).toHaveAttribute("aria-checked", "true");
    v.set(new Set(["b"]));
    flush();
    expect([...root.querySelectorAll("[role=menuitemradio]")]).toEqual(items);
    expect(items[0]).toHaveAttribute("aria-checked", "false");
    expect(items[1]).toHaveAttribute("aria-checked", "true");
  });
  it("MenuTrigger isOpen", () => {
    const v = signal(false);
    mount(() => (
      <MenuTrigger isOpen={v()} onOpenChange={() => {}}>
        <Button>open</Button>
        <Popover>
          <Menu aria-label="m">
            <MenuItem id="a">A</MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
    ));
    expect(document.querySelector("[role=menu]")).toBeNull();
    v.set(true);
    flush();
    expect(document.querySelector("[role=menu]")).not.toBeNull();
  });
  it("DatePicker value", () => {
    const v = signal(new CalendarDate(2024, 3, 10));
    const root = mount(() => <DatePicker aria-label="p" value={v()} onChange={() => {}} />);
    expect(root.textContent).toContain("2024");
    v.set(new CalendarDate(2025, 4, 11));
    flush();
    expect(root.textContent).toContain("2025");
  });
});

// Live `isDisabled` / `isReadOnly` / `isRequired` / `isInvalid` on the color parts: same nodes, attributes follow,
// keyboard handlers check the current value at event time (a synthetic keydown reaches the delegated handler).
describe("live flags: color parts", () => {
  const key = (el: Element, k: string) => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
    el.dispatchEvent(new KeyboardEvent("keyup", { key: k, bubbles: true, cancelable: true }));
    flush();
  };
  it("ColorField (hex) isDisabled / isReadOnly / isRequired / isInvalid follow the prop in place", () => {
    const off = signal(false);
    const ro = signal(false);
    const req = signal(false);
    const bad = signal(false);
    const v = signal(parseColor("#000010"));
    const root = mount(() => (
      <ColorField aria-label="cf" value={v()} onChange={(c) => c && v.set(c)} isDisabled={off()} isReadOnly={ro()} isRequired={req()} isInvalid={bad()}>
        <Input />
      </ColorField>
    ));
    const field = root.querySelector(".rv-ColorField")!;
    const input = root.querySelector("input")!;
    expect(field).not.toHaveAttribute("data-disabled");
    off.set(true);
    flush();
    expect(root.querySelector(".rv-ColorField")).toBe(field);
    expect(root.querySelector("input")).toBe(input);
    expect(field).toHaveAttribute("data-disabled", "true");
    expect(input.disabled).toBe(true);
    expect(input).toHaveAttribute("data-disabled", "true");
    key(input, "ArrowUp");
    expect(v().toString("hex")).toBe("#000010");
    off.set(false);
    ro.set(true);
    flush();
    expect(field).not.toHaveAttribute("data-disabled");
    expect(field).toHaveAttribute("data-readonly", "true");
    expect(input.readOnly).toBe(true);
    expect(input).toHaveAttribute("aria-readonly", "true");
    key(input, "ArrowUp");
    expect(v().toString("hex")).toBe("#000010");
    ro.set(false);
    flush();
    expect(input.readOnly).toBe(false);
    key(input, "ArrowUp");
    expect(v().toString("hex")).toBe("#000011");
    req.set(true);
    bad.set(true);
    flush();
    expect(field).toHaveAttribute("data-required", "true");
    expect(input.required).toBe(true);
    expect(field).toHaveAttribute("data-invalid", "true");
    req.set(false);
    bad.set(false);
    flush();
    expect(field).not.toHaveAttribute("data-required");
    expect(input.required).toBe(false);
    expect(field).not.toHaveAttribute("data-invalid");
  });
  it("ColorField (channel) isDisabled / isReadOnly follow the prop in place", () => {
    const off = signal(false);
    const ro = signal(false);
    const v = signal(parseColor("hsl(10, 100%, 50%)"));
    const root = mount(() => (
      <ColorField aria-label="cf" channel="hue" value={v()} onChange={(c) => c && v.set(c)} isDisabled={off()} isReadOnly={ro()}>
        <Input />
      </ColorField>
    ));
    const field = root.querySelector(".rv-ColorField")!;
    const input = root.querySelector("input")!;
    off.set(true);
    flush();
    expect(root.querySelector("input")).toBe(input);
    expect(field).toHaveAttribute("data-disabled", "true");
    expect(input.disabled).toBe(true);
    key(input, "ArrowUp");
    expect(v().getChannelValue("hue")).toBe(10);
    off.set(false);
    ro.set(true);
    flush();
    expect(field).not.toHaveAttribute("data-disabled");
    expect(field).toHaveAttribute("data-readonly", "true");
    expect(input.readOnly).toBe(true);
    key(input, "ArrowUp");
    expect(v().getChannelValue("hue")).toBe(10);
    ro.set(false);
    flush();
    key(input, "ArrowUp");
    expect(v().getChannelValue("hue")).toBe(11);
  });
  it("ColorSlider isDisabled follows the prop in place", () => {
    const off = signal(false);
    const v = signal(parseColor("hsl(0, 100%, 50%)"));
    const root = mount(() => (
      <ColorSlider aria-label="cs" channel="hue" value={v()} onChange={(c) => v.set(c)} isDisabled={off()}>
        <SliderTrack>
          <ColorThumb />
        </SliderTrack>
      </ColorSlider>
    ));
    const slider = root.querySelector(".rv-ColorSlider")!;
    const thumb = root.querySelector(".rv-ColorThumb")!;
    const input = root.querySelector("input")!;
    off.set(true);
    flush();
    expect(root.querySelector(".rv-ColorSlider")).toBe(slider);
    expect(root.querySelector(".rv-ColorThumb")).toBe(thumb);
    expect(root.querySelector("input")).toBe(input);
    expect(slider).toHaveAttribute("data-disabled", "true");
    expect(thumb).toHaveAttribute("data-disabled", "true");
    expect(input.disabled).toBe(true);
    key(thumb, "End");
    expect(v().getChannelValue("hue")).toBe(0);
    off.set(false);
    flush();
    expect(slider).not.toHaveAttribute("data-disabled");
    expect(thumb).not.toHaveAttribute("data-disabled");
    expect(input.disabled).toBe(false);
    key(thumb, "End");
    expect(v().getChannelValue("hue")).toBe(360);
  });
  it("ColorArea isDisabled follows the prop in place", () => {
    const off = signal(false);
    const v = signal(parseColor("rgb(0, 0, 0)"));
    const root = mount(() => (
      <ColorArea value={v()} onChange={(c) => v.set(c)} xChannel="red" yChannel="green" isDisabled={off()}>
        <ColorThumb />
      </ColorArea>
    ));
    const area = root.querySelector(".rv-ColorArea")!;
    const thumb = root.querySelector(".rv-ColorThumb")!;
    const inputs = [...root.querySelectorAll("input")];
    off.set(true);
    flush();
    expect(root.querySelector(".rv-ColorArea")).toBe(area);
    expect([...root.querySelectorAll("input")]).toEqual(inputs);
    expect(area).toHaveAttribute("data-disabled", "true");
    expect(thumb).toHaveAttribute("data-disabled", "true");
    expect(inputs[0]!.disabled).toBe(true);
    expect(inputs[1]!.disabled).toBe(true);
    key(thumb, "PageUp");
    expect(v().getChannelValue("green")).toBe(0);
    off.set(false);
    flush();
    expect(area).not.toHaveAttribute("data-disabled");
    expect(thumb).not.toHaveAttribute("data-disabled");
    expect(inputs[0]!.disabled).toBe(false);
    key(thumb, "PageUp");
    expect(v().getChannelValue("green")).toBeGreaterThan(0);
  });
  it("ColorWheel isDisabled follows the prop in place (wheel, track, thumb)", () => {
    const off = signal(false);
    const v = signal(parseColor("hsl(0, 100%, 50%)"));
    const root = mount(() => (
      <ColorWheel value={v()} onChange={(c) => v.set(c)} outerRadius={100} innerRadius={80} isDisabled={off()}>
        <ColorWheelTrack />
        <ColorThumb />
      </ColorWheel>
    ));
    const wheel = root.querySelector(".rv-ColorWheel")!;
    const track = root.querySelector(".rv-ColorWheelTrack")!;
    const thumb = root.querySelector(".rv-ColorThumb")!;
    const input = root.querySelector("input")!;
    off.set(true);
    flush();
    expect(root.querySelector(".rv-ColorWheel")).toBe(wheel);
    expect(root.querySelector(".rv-ColorThumb")).toBe(thumb);
    expect(root.querySelector("input")).toBe(input);
    expect(wheel).toHaveAttribute("data-disabled", "true");
    expect(track).toHaveAttribute("data-disabled", "true");
    expect(thumb).toHaveAttribute("data-disabled", "true");
    expect(input.disabled).toBe(true);
    key(thumb, "PageUp");
    expect(v().getChannelValue("hue")).toBe(0);
    off.set(false);
    flush();
    expect(wheel).not.toHaveAttribute("data-disabled");
    expect(track).not.toHaveAttribute("data-disabled");
    expect(thumb).not.toHaveAttribute("data-disabled");
    expect(input.disabled).toBe(false);
    key(thumb, "PageUp");
    expect(v().getChannelValue("hue")).toBe(15);
  });
});

// Live `isDisabled` / `isReadOnly` on the date parts (React Aria: props re-read every render): the same segment / cell /
// button nodes stay, attributes follow, and segment keys / cell presses / the picker button check the value at event time.
describe("live flags: date parts", () => {
  const user = userEvent.setup();
  const key = (el: Element, k: string) => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
    el.dispatchEvent(new KeyboardEvent("keyup", { key: k, bubbles: true, cancelable: true }));
    flush();
  };
  const segmentOf = (root: Element, type: string) => root.querySelector(`[data-rv-segment][data-type=${type}]`) as HTMLElement;
  const expectSegmentOff = (seg: HTMLElement, how: "disabled" | "readonly") => {
    expect(seg).not.toHaveAttribute("contenteditable");
    if (how === "disabled") {
      expect(seg).toHaveAttribute("aria-disabled", "true");
      expect(seg).toHaveAttribute("data-disabled", "true");
      expect(seg).not.toHaveAttribute("tabindex");
    } else {
      expect(seg).toHaveAttribute("aria-readonly", "true");
      expect(seg).toHaveAttribute("data-readonly", "true");
    }
  };
  const expectSegmentOn = (seg: HTMLElement) => {
    expect(seg).toHaveAttribute("contenteditable", "true");
    expect(seg).toHaveAttribute("tabindex", "0");
    expect(seg).not.toHaveAttribute("aria-disabled");
    expect(seg).not.toHaveAttribute("data-disabled");
    expect(seg).not.toHaveAttribute("data-readonly");
  };

  it("DateField isDisabled / isReadOnly: same segments, attributes follow, keys checked at event time", () => {
    const off = signal(false);
    const ro = signal(false);
    const v = signal(new CalendarDate(2024, 3, 10));
    const root = mount(() => (
      <DateField aria-label="d" value={v()} onChange={(d) => d && v.set(d as CalendarDate)} isDisabled={off()} isReadOnly={ro()}>
        <DateInput>{(s) => <DateSegment segment={s} />}</DateInput>
      </DateField>
    ));
    const field = root.querySelector(".rv-DateField")!;
    const group = root.querySelector(".rv-DateInput")!;
    const month = segmentOf(root, "month");
    const hidden = root.querySelector("[data-testid=hidden-dateinput-container] input") as HTMLInputElement;
    expectSegmentOn(month);
    off.set(true);
    flush();
    expect(segmentOf(root, "month")).toBe(month);
    expect(field).toHaveAttribute("data-disabled", "true");
    expect(group).toHaveAttribute("data-disabled", "true");
    expect(hidden.disabled).toBe(true);
    expectSegmentOff(month, "disabled");
    key(month, "ArrowUp");
    expect(v().month).toBe(3);
    off.set(false);
    flush();
    expect(field).not.toHaveAttribute("data-disabled");
    expect(group).not.toHaveAttribute("data-disabled");
    expect(hidden.disabled).toBe(false);
    expectSegmentOn(month);
    key(month, "ArrowUp");
    expect(v().month).toBe(4);
    ro.set(true);
    flush();
    expect(field).toHaveAttribute("data-readonly", "true");
    expect(group).toHaveAttribute("data-readonly", "true");
    expectSegmentOff(month, "readonly");
    key(month, "ArrowUp");
    expect(v().month).toBe(4);
    ro.set(false);
    flush();
    expect(field).not.toHaveAttribute("data-readonly");
    expectSegmentOn(month);
    key(month, "ArrowUp");
    expect(v().month).toBe(5);
    expect(segmentOf(root, "month")).toBe(month);
  });

  it("TimeField isDisabled / isReadOnly", () => {
    const off = signal(false);
    const ro = signal(false);
    const v = signal(new Time(10, 30));
    const root = mount(() => (
      <TimeField aria-label="t" value={v()} onChange={(t) => t && v.set(t as Time)} isDisabled={off()} isReadOnly={ro()}>
        <DateInput>{(s) => <DateSegment segment={s} />}</DateInput>
      </TimeField>
    ));
    const field = root.querySelector(".rv-TimeField")!;
    const hour = segmentOf(root, "hour");
    off.set(true);
    flush();
    expect(segmentOf(root, "hour")).toBe(hour);
    expect(field).toHaveAttribute("data-disabled", "true");
    expectSegmentOff(hour, "disabled");
    key(hour, "ArrowUp");
    expect(v().hour).toBe(10);
    off.set(false);
    ro.set(true);
    flush();
    expect(field).not.toHaveAttribute("data-disabled");
    expect(field).toHaveAttribute("data-readonly", "true");
    expectSegmentOff(hour, "readonly");
    key(hour, "ArrowUp");
    expect(v().hour).toBe(10);
    ro.set(false);
    flush();
    expectSegmentOn(hour);
    key(hour, "ArrowUp");
    expect(v().hour).toBe(11);
  });

  it("DatePicker isDisabled / isReadOnly: group, segments and button follow; the button opens only while enabled", async () => {
    const off = signal(false);
    const ro = signal(false);
    const v = signal(new CalendarDate(2024, 3, 10));
    const root = mount(() => <DatePicker aria-label="p" value={v()} onChange={(d) => d && v.set(d as CalendarDate)} isDisabled={off()} isReadOnly={ro()} />);
    const picker = root.querySelector(".rv-DatePicker")!;
    const group = root.querySelector("[role=group]")!;
    const button = root.querySelector("button")!;
    const month = segmentOf(root, "month");
    off.set(true);
    flush();
    expect(root.querySelector("button")).toBe(button);
    expect(segmentOf(root, "month")).toBe(month);
    expect(picker).toHaveAttribute("data-disabled", "true");
    expect(group).toHaveAttribute("data-disabled", "true");
    expect(group).toHaveAttribute("aria-disabled", "true");
    expect(button).toBeDisabled();
    expectSegmentOff(month, "disabled");
    key(month, "ArrowUp");
    expect(v().month).toBe(3);
    await user.click(button);
    flush();
    expect(document.querySelector("[role=dialog]")).toBeNull();
    // A pointer elsewhere first: a second user-event click on the same once-disabled element does not press (also a
    // plain live `<Button isDisabled>`).
    await user.click(document.body);
    off.set(false);
    ro.set(true);
    flush();
    expect(picker).not.toHaveAttribute("data-disabled");
    expect(picker).toHaveAttribute("data-readonly", "true");
    expect(group).not.toHaveAttribute("aria-disabled");
    expect(button).toBeDisabled();
    expectSegmentOff(month, "readonly");
    key(month, "ArrowUp");
    expect(v().month).toBe(3);
    ro.set(false);
    flush();
    expect(picker).not.toHaveAttribute("data-readonly");
    expect(button).not.toBeDisabled();
    expectSegmentOn(month);
    key(month, "ArrowUp");
    expect(v().month).toBe(4);
    await user.click(button);
    flush();
    expect(document.querySelector("[role=dialog]")).not.toBeNull();
  });

  it("DateRangePicker isDisabled: both fields and the button follow in place", () => {
    const off = signal(false);
    const root = mount(() => (
      <DateRangePicker aria-label="r" defaultValue={{ start: new CalendarDate(2024, 3, 10), end: new CalendarDate(2024, 3, 12) }} isDisabled={off()} />
    ));
    const picker = root.querySelector(".rv-DateRangePicker")!;
    const button = root.querySelector("button")!;
    const months = [...root.querySelectorAll("[data-rv-segment][data-type=month]")] as HTMLElement[];
    expect(months.length).toBe(2);
    off.set(true);
    flush();
    expect(picker).toHaveAttribute("data-disabled", "true");
    expect(button).toBeDisabled();
    for (const m of months) expectSegmentOff(m, "disabled");
    key(months[1]!, "ArrowUp");
    expect(months[1]!.textContent).toBe("3");
    off.set(false);
    flush();
    expect([...root.querySelectorAll("[data-rv-segment][data-type=month]")]).toEqual(months);
    expect(picker).not.toHaveAttribute("data-disabled");
    expect(button).not.toBeDisabled();
    for (const m of months) expectSegmentOn(m);
    key(months[1]!, "ArrowUp");
    expect(months[1]!.textContent).toBe("4");
  });

  it("Calendar isDisabled / isReadOnly: same cells, attributes follow, presses checked at event time", async () => {
    const off = signal(false);
    const ro = signal(false);
    const v = signal(new CalendarDate(2024, 3, 10));
    const root = mount(() => (
      <Calendar aria-label="c" value={v()} onChange={(d) => v.set(d as CalendarDate)} isDisabled={off()} isReadOnly={ro()}>
        <CalendarGrid>{(date) => <CalendarCell date={date} />}</CalendarGrid>
      </Calendar>
    ));
    const cal = root.querySelector(".rv-Calendar")!;
    const grid = root.querySelector("[role=grid]")!;
    const cell = root.querySelector('[data-date$="-03-12"]') as HTMLElement;
    off.set(true);
    flush();
    expect(root.querySelector('[data-date$="-03-12"]')).toBe(cell);
    expect(cal).toHaveAttribute("data-disabled", "true");
    expect(grid).toHaveAttribute("aria-disabled", "true");
    expect(cell).toHaveAttribute("data-disabled", "true");
    expect(cell).not.toHaveAttribute("tabindex");
    await user.click(cell);
    flush();
    expect(v().day).toBe(10);
    off.set(false);
    ro.set(true);
    flush();
    expect(cal).not.toHaveAttribute("data-disabled");
    expect(grid).not.toHaveAttribute("aria-disabled");
    expect(grid).toHaveAttribute("aria-readonly", "true");
    expect(cell).not.toHaveAttribute("data-disabled");
    await user.click(cell);
    flush();
    expect(v().day).toBe(10);
    ro.set(false);
    flush();
    expect(grid).not.toHaveAttribute("aria-readonly");
    await user.click(cell);
    flush();
    expect(v().day).toBe(12);
    expect(root.querySelector('[data-date$="-03-12"]')).toBe(cell);
  });

  it("RangeCalendar isReadOnly / isDisabled", async () => {
    const off = signal(false);
    const ro = signal(true);
    const seen: unknown[] = [];
    const root = mount(() => (
      <RangeCalendar aria-label="rc" defaultFocusedValue={new CalendarDate(2024, 3, 10)} onChange={(r) => seen.push(r)} isDisabled={off()} isReadOnly={ro()}>
        <CalendarGrid>{(date) => <CalendarCell date={date} />}</CalendarGrid>
      </RangeCalendar>
    ));
    const grid = root.querySelector("[role=grid]")!;
    const a = root.querySelector('[data-date$="-03-12"]') as HTMLElement;
    const b = root.querySelector('[data-date$="-03-14"]') as HTMLElement;
    expect(grid).toHaveAttribute("aria-readonly", "true");
    await user.click(a);
    await user.click(b);
    flush();
    expect(seen.length).toBe(0);
    ro.set(false);
    off.set(true);
    flush();
    expect(root.querySelector(".rv-RangeCalendar")).toHaveAttribute("data-disabled", "true");
    expect(a).toHaveAttribute("data-disabled", "true");
    await user.click(a);
    await user.click(b);
    flush();
    expect(seen.length).toBe(0);
    off.set(false);
    flush();
    expect(a).not.toHaveAttribute("data-disabled");
    await user.click(a);
    await user.click(b);
    flush();
    expect(seen.length).toBe(1);
    expect(root.querySelector('[data-date$="-03-12"]')).toBe(a);
  });
});
