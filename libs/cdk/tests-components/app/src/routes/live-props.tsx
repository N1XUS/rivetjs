// Live props (P5): value-form props (`aria-pressed={on()}`, `isDisabled={d()}`, `class={c()}`, …) on cdk parts of a
// resumed page update in place — `#lp-flip` (a native button) flips every state: Button, ToggleButton, Checkbox, Switch,
// TextField + Input, Slider, Select, ListBoxItem, Tabs, RadioGroup, Text / Link (class + children), SearchField, Disclosure, Meter, ProgressBar, NumberField, Breadcrumbs, ColorSwatch, Group, `#lv-*` (children capturing a class instance), `#lc-*` (controlled values: NumberField, RadioGroup, CheckboxGroup, ComboBox, ColorField, DateField, ToggleButtonGroup, DisclosureGroup, ListBox, Tree), `#lf-*` (state flags isDisabled / isReadOnly / isRequired: CheckboxGroup, ComboBox; `#lf-color-*`: ColorField hex + channel, ColorSlider, ColorArea, ColorWheel; `#lf-date-*`: DateField, TimeField, DatePicker, DateRangePicker, Calendar, RangeCalendar); `#lp-modal-flip` opens a Modal (`isOpen={shown()}`); tests-components/live-props.test.ts.
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { ToggleButton } from "@rivetjs/cdk/toggle-button";
import { Checkbox } from "@rivetjs/cdk/checkbox";
import { Switch } from "@rivetjs/cdk/switch";
import { TextField } from "@rivetjs/cdk/text-field";
import { Input } from "@rivetjs/cdk/input";
import { Slider, SliderThumb, SliderTrack } from "@rivetjs/cdk/slider";
import { Modal } from "@rivetjs/cdk/modal";
import { Select, SelectValue } from "@rivetjs/cdk/select";
import { Label } from "@rivetjs/cdk/label";
import { Popover } from "@rivetjs/cdk/popover";
import { ListBox, ListBoxItem } from "@rivetjs/cdk/listbox";
import { Dialog } from "@rivetjs/cdk/dialog";
import { Tab, TabList, TabPanel, Tabs } from "@rivetjs/cdk/tabs";
import { Radio, RadioButton, RadioField, RadioGroup } from "@rivetjs/cdk/radio-group";
import { Text } from "@rivetjs/cdk/text";
import { Link } from "@rivetjs/cdk/link";
import { SearchField } from "@rivetjs/cdk/search-field";
import { Disclosure, DisclosurePanel } from "@rivetjs/cdk/disclosure";
import { Meter } from "@rivetjs/cdk/meter";
import { ProgressBar } from "@rivetjs/cdk/progress-bar";
import { NumberField } from "@rivetjs/cdk/number-field";
import { Breadcrumb, Breadcrumbs } from "@rivetjs/cdk/breadcrumbs";
import { ColorSwatch } from "@rivetjs/cdk/color-swatch";
import { Group } from "@rivetjs/cdk/group";
import { Checkbox as GroupCheckbox, CheckboxGroup } from "@rivetjs/cdk/checkbox";
import { ComboBox } from "@rivetjs/cdk/combobox";
import { ColorField } from "@rivetjs/cdk/color-field";
import { DateField, DateInput, DateSegment, TimeField } from "@rivetjs/cdk/date-field";
import { DatePicker, DateRangePicker } from "@rivetjs/cdk/date-picker";
import { Calendar, CalendarCell, CalendarGrid, RangeCalendar } from "@rivetjs/cdk/calendar";
import { parseDate } from "@rivetjs/cdk/date";
import { ToggleButtonGroup } from "@rivetjs/cdk/toggle-button-group";
import { DisclosureGroup } from "@rivetjs/cdk/disclosure";
import { Tree, TreeItem, TreeItemContent } from "@rivetjs/cdk/tree";
import { ColorSlider } from "@rivetjs/cdk/color-slider";
import { ColorArea } from "@rivetjs/cdk/color-area";
import { ColorWheel, ColorWheelTrack } from "@rivetjs/cdk/color-wheel";
import { ColorThumb } from "@rivetjs/cdk/color-thumb";

export const head = { title: "Live props" };

// Children capturing a class instance next to a live class / style (`#lv-*`): parts read class / style / children
// through one live view per key, so the class / style bindings resume without the children
// (tests-components/live-props.test.ts "per-key live views"). A factory: the compiler does not see the instance.
class Tag {
  name: string;
  constructor(name: string) {
    this.name = name;
  }
}
const makeTag = (name: string) => new Tag(name);

export default function LivePropsStory() {
  const on = signal(false);
  const shown = signal(false);
  const tag = makeTag("tag");
  return (
    <section>
      <h1>Live props</h1>
      <button id="lp-flip" type="button" onClick={() => on.set(!on())}>
        flip
      </button>
      <Button id="lp-button" aria-pressed={on()} isDisabled={on()} class={on() ? "b-on" : "b-off"} aria-label={on() ? "Unlike" : "Like"}>
        Like
      </Button>
      <ToggleButton id="lp-toggle" isSelected={on()} isDisabled={on()} class={on() ? "t-on" : "t-off"}>
        Pin
      </ToggleButton>
      <Checkbox id="lp-check" data-testid="lp-check" isSelected={on()} isInvalid={on()} class={on() ? "c-on" : "c-off"}>
        Accept
      </Checkbox>
      <Switch data-testid="lp-switch" isSelected={on()} isDisabled={on()} class={on() ? "s-on" : "s-off"}>
        Wi-Fi
      </Switch>
      <TextField data-testid="lp-field" value={on() ? "yes" : "no"} isDisabled={on()} isInvalid={on()} aria-label="Answer">
        <Input id="lp-input" placeholder={on() ? "P-on" : "P-off"} />
      </TextField>
      <Slider data-testid="lp-slider" value={on() ? 60 : 20} isDisabled={on()} class={on() ? "r-on" : "r-off"} aria-label="Volume">
        <SliderTrack>
          <SliderThumb />
        </SliderTrack>
      </Slider>
      <Select data-testid="lp-select" value={on() ? "dog" : "cat"} isDisabled={on()} class={on() ? "sel-on" : "sel-off"} onChange={() => {}}>
        <Label>Animal</Label>
        <Button id="lp-select-button">
          <SelectValue />
        </Button>
        <Popover>
          <ListBox>
            <ListBoxItem id="cat">Cat</ListBoxItem>
            <ListBoxItem id="dog">Dog</ListBoxItem>
          </ListBox>
        </Popover>
      </Select>
      <ListBox id="lp-list" aria-label="Pets" selectionMode="single">
        <ListBoxItem id="lp-cat" isDisabled={on()} class={on() ? "li-on" : "li-off"}>
          Cat
        </ListBoxItem>
        <ListBoxItem id="lp-dog">Dog</ListBoxItem>
      </ListBox>
      <Tabs data-testid="lp-tabs" selectedKey={on() ? "two" : "one"} isDisabled={false} onSelectionChange={() => {}}>
        <TabList aria-label="Live tabs">
          <Tab id="one" class={on() ? "tb-on" : "tb-off"}>
            One
          </Tab>
          <Tab id="two">Two</Tab>
          <Tab id="three" isDisabled={on()}>
            Three
          </Tab>
        </TabList>
        <TabPanel id="one" data-testid="lp-tp1" shouldForceMount class={on() ? "tp-on" : "tp-off"}>
          Panel one
        </TabPanel>
        <TabPanel id="two" shouldForceMount>
          Panel two
        </TabPanel>
        <TabPanel id="three">Panel three</TabPanel>
      </Tabs>
      <RadioGroup data-testid="lp-radio" aria-label="Size" isReadOnly={on()} class={on() ? "rg-on" : "rg-off"}>
        <RadioField value="s" data-testid="lp-radio-s" class={on() ? "rf-on" : "rf-off"}>
          <RadioButton>Small</RadioButton>
        </RadioField>
        <Radio value="l" data-testid="lp-radio-l" isDisabled={on()} class={on() ? "ra-on" : "ra-off"}>
          Large
        </Radio>
      </RadioGroup>
      <Text data-testid="lp-text" class={on() ? "tx-on" : "tx-off"}>
        {on() ? "Text on" : "Text off"}
      </Text>
      <Link data-testid="lp-link" href="#lp" class={on() ? "lk-on" : "lk-off"}>
        {on() ? "Link on" : "Link off"}
      </Link>
      <SearchField data-testid="lp-search" aria-label="Search" isDisabled={on()} isReadOnly={on()} class={on() ? "sf-on" : "sf-off"}>
        <Input />
      </SearchField>
      <Disclosure data-testid="lp-disclosure" isDisabled={on()} class={on() ? "dc-on" : "dc-off"}>
        <Button slot="trigger">More</Button>
        <DisclosurePanel>Details</DisclosurePanel>
      </Disclosure>
      <Meter data-testid="lp-meter" aria-label="Storage" value={on() ? 80 : 20} class={on() ? "me-on" : "me-off"} />
      <ProgressBar data-testid="lp-progress" aria-label="Loading" value={on() ? 70 : 10} class={on() ? "pb-on" : "pb-off"} />
      <NumberField data-testid="lp-number" aria-label="Count" defaultValue={1} isDisabled={on()} class={on() ? "nf-on" : "nf-off"}>
        <Input />
      </NumberField>
      <Breadcrumbs data-testid="lp-crumbs" isDisabled={on()} class={on() ? "bc-on" : "bc-off"}>
        <Breadcrumb id="home" data-testid="lp-crumb">
          <Link href="#home">Home</Link>
        </Breadcrumb>
        <Breadcrumb id="here">
          <Link href="#here">Here</Link>
        </Breadcrumb>
      </Breadcrumbs>
      <ColorSwatch data-testid="lp-swatch" color={on() ? "#f00" : "#00f"} class={on() ? "cw-on" : "cw-off"} />
      <Group data-testid="lp-group" isDisabled={on()} class={on() ? "gr-on" : "gr-off"}>
        group
      </Group>
      <Link data-testid="lv-link" href="#lv" class={on() ? "lv-on" : "lv-off"} style={on() ? { color: "red" } : { color: "blue" }}>
        {() => <b>{tag.name}</b>}
      </Link>
      <Checkbox data-testid="lv-check" class={on() ? "lv-on" : "lv-off"} style={on() ? { color: "red" } : { color: "blue" }}>
        {() => <b>{tag.name}</b>}
      </Checkbox>
      <Group data-testid="lv-group" class={on() ? "lv-on" : "lv-off"} style={on() ? { color: "red" } : { color: "blue" }}>
        {() => <b>{tag.name}</b>}
      </Group>
      <Text data-testid="lv-text" class={on() ? "lv-on" : "lv-off"}>
        <b>{tag.name}</b>
      </Text>
      <Meter data-testid="lv-meter" aria-label="Lv" value={30} class={on() ? "lv-on" : "lv-off"} style={on() ? { color: "red" } : { color: "blue" }}>
        {() => <b>{tag.name}</b>}
      </Meter>
      {/* Controlled values (`#lc-*`): plain value-form props follow the flip in place (read live, never written). */}
      <NumberField data-testid="lc-number" aria-label="Qty" value={on() ? 5 : 1} onChange={() => {}}>
        <Input />
      </NumberField>
      <RadioGroup data-testid="lc-radio" aria-label="Pick" value={on() ? "b" : "a"} onChange={() => {}}>
        <Radio value="a">A</Radio>
        <Radio value="b">B</Radio>
      </RadioGroup>
      <CheckboxGroup data-testid="lc-checks" aria-label="Many" value={on() ? ["b"] : ["a"]} onChange={() => {}}>
        <GroupCheckbox value="a">A</GroupCheckbox>
        <GroupCheckbox value="b">B</GroupCheckbox>
      </CheckboxGroup>
      <ComboBox data-testid="lc-combo" aria-label="Pet" selectedKey={on() ? "dog" : "cat"} onSelectionChange={() => {}}>
        <Input />
        <Popover>
          <ListBox>
            <ListBoxItem id="cat">Cat</ListBoxItem>
            <ListBoxItem id="dog">Dog</ListBoxItem>
          </ListBox>
        </Popover>
      </ComboBox>
      <ColorField data-testid="lc-color" aria-label="Color" value={on() ? "#00ff00" : "#ff0000"} onChange={() => {}}>
        <Input />
      </ColorField>
      <DateField data-testid="lc-date" aria-label="Date" value={parseDate(on() ? "2025-04-11" : "2024-03-10")} onChange={() => {}}>
        <DateInput>{(segment) => <DateSegment segment={segment} />}</DateInput>
      </DateField>
      <ToggleButtonGroup data-testid="lc-toggles" selectedKeys={on() ? ["b"] : ["a"]} onSelectionChange={() => {}}>
        <ToggleButton id="a">A</ToggleButton>
        <ToggleButton id="b">B</ToggleButton>
      </ToggleButtonGroup>
      <DisclosureGroup data-testid="lc-disclosures" expandedKeys={on() ? ["b"] : ["a"]} onExpandedChange={() => {}}>
        <Disclosure id="a">
          <Button slot="trigger">A</Button>
          <DisclosurePanel>pa</DisclosurePanel>
        </Disclosure>
        <Disclosure id="b">
          <Button slot="trigger">B</Button>
          <DisclosurePanel>pb</DisclosurePanel>
        </Disclosure>
      </DisclosureGroup>
      <ListBox data-testid="lc-list" aria-label="Fruit" selectionMode="single" selectedKeys={on() ? ["b"] : ["a"]} onSelectionChange={() => {}}>
        <ListBoxItem id="a">Apple</ListBoxItem>
        <ListBoxItem id="b">Banana</ListBoxItem>
      </ListBox>
      <Tree data-testid="lc-tree" aria-label="Files" expandedKeys={on() ? ["a"] : []} onExpandedChange={() => {}}>
        <TreeItem id="a" textValue="Docs">
          <TreeItemContent>Docs</TreeItemContent>
          <TreeItem id="a1" textValue="Readme">
            <TreeItemContent>Readme</TreeItemContent>
          </TreeItem>
        </TreeItem>
      </Tree>
      {/* Live state flags (`#lf-*`): `isDisabled` / `isReadOnly` / `isRequired` value forms follow the flip in place. */}
      <CheckboxGroup data-testid="lf-checks" aria-label="Flags" isDisabled={on()} isRequired={on()} validationBehavior="native">
        <GroupCheckbox value="a">A</GroupCheckbox>
        <GroupCheckbox value="b">B</GroupCheckbox>
      </CheckboxGroup>
      <CheckboxGroup data-testid="lf-checks-ro" aria-label="Flags ro" isReadOnly={on()}>
        <GroupCheckbox value="a">A</GroupCheckbox>
      </CheckboxGroup>
      <ComboBox data-testid="lf-combo" aria-label="Flag pet" isDisabled={on()} isRequired={on()} validationBehavior="native">
        <Input />
        <Button>v</Button>
        <Popover>
          <ListBox>
            <ListBoxItem id="cat">Cat</ListBoxItem>
          </ListBox>
        </Popover>
      </ComboBox>
      <ComboBox data-testid="lf-combo-ro" aria-label="Flag pet ro" isReadOnly={on()}>
        <Input />
        <Popover>
          <ListBox>
            <ListBoxItem id="cat">Cat</ListBoxItem>
          </ListBox>
        </Popover>
      </ComboBox>
      {/* Color parts (`#lf-color-*`): `isDisabled` / `isReadOnly` / `isRequired` follow the flip in place. */}
      <ColorField data-testid="lf-color-field" aria-label="Flag color" defaultValue="#ff0000" isDisabled={on()} isRequired={on()}>
        <Input />
      </ColorField>
      <ColorField data-testid="lf-color-field-ro" aria-label="Flag color ro" defaultValue="#ff0000" isReadOnly={on()}>
        <Input />
      </ColorField>
      <ColorField data-testid="lf-color-channel" aria-label="Flag hue" channel="hue" defaultValue="hsl(0, 100%, 50%)" isDisabled={on()}>
        <Input />
      </ColorField>
      <ColorSlider data-testid="lf-color-slider" aria-label="Flag slider" channel="hue" defaultValue="hsl(0, 100%, 50%)" isDisabled={on()}>
        <SliderTrack>
          <ColorThumb />
        </SliderTrack>
      </ColorSlider>
      <ColorArea data-testid="lf-color-area" defaultValue="rgb(0, 0, 0)" xChannel="red" yChannel="green" isDisabled={on()}>
        <ColorThumb />
      </ColorArea>
      <ColorWheel data-testid="lf-color-wheel" outerRadius={50} innerRadius={40} defaultValue="hsl(0, 100%, 50%)" isDisabled={on()}>
        <ColorWheelTrack />
        <ColorThumb />
      </ColorWheel>
      {/* Date parts (`#lf-date-*`): `isDisabled` / `isReadOnly` follow the flip in place (segments, cells, buttons kept). */}
      <DateField data-testid="lf-date-field" aria-label="Flag date" defaultValue={parseDate("2024-03-10")} isDisabled={on()}>
        <DateInput>{(segment) => <DateSegment segment={segment} />}</DateInput>
      </DateField>
      <DateField data-testid="lf-date-field-ro" aria-label="Flag date ro" defaultValue={parseDate("2024-03-10")} isReadOnly={on()} />
      <TimeField data-testid="lf-date-time" aria-label="Flag time" defaultValue="10:30" isDisabled={on()} />
      <DatePicker data-testid="lf-date-picker" aria-label="Flag picker" defaultValue={parseDate("2024-03-10")} isDisabled={on()} />
      <DateRangePicker data-testid="lf-date-range" aria-label="Flag range" isReadOnly={on()} />
      <Calendar data-testid="lf-date-calendar" aria-label="Flag calendar" defaultFocusedValue={parseDate("2024-03-10")} isDisabled={on()}>
        <CalendarGrid>{(date) => <CalendarCell date={date} />}</CalendarGrid>
      </Calendar>
      <RangeCalendar data-testid="lf-date-range-calendar" aria-label="Flag range calendar" defaultFocusedValue={parseDate("2024-03-10")} isReadOnly={on()} />
      <button id="lp-modal-flip" type="button" onClick={() => shown.set(!shown())}>
        modal
      </button>
      <Modal isOpen={shown()} isKeyboardDismissDisabled={!on()} class={on() ? "lm-on" : "lm-off"} onOpenChange={(v) => shown.set(v)}>
        <Dialog aria-label="Live modal">
          <button id="lp-modal-close" type="button" onClick={() => shown.set(false)}>
            close
          </button>
        </Dialog>
      </Modal>
    </section>
  );
}
