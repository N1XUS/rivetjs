// Live props (P5, docs/design/specs/2026-10-07-live-props-design.md §8): value-form props (`aria-pressed={on()}`,
// `isDisabled={d()}`, `class={c()}`, `isSelected={s()}`) reach the cdk parts as getters and update in place —
// the element is kept (no re-creation), only the bindings reading the prop re-run. Client renders here; resumed
// pages: tests-components/live-props.test.ts.
import { afterEach, describe, expect, it } from "vitest";
import "@rivetjs/testing/jest-dom";
import { computed, signal } from "@rivetjs/reactivity";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { Button, ButtonContext } from "../button/index.tsx";
import { Provider } from "../slots/index.tsx";
import { ToggleButton } from "../toggle-button/index.tsx";
import { CheckboxButton, CheckboxField } from "../checkbox/index.tsx";
import { Switch, SwitchButton, SwitchField } from "../switch/index.tsx";
import { Slider, SliderThumb, SliderTrack } from "../slider/index.tsx";
import { Modal, ModalOverlay } from "../modal/index.tsx";
import { Dialog } from "../dialog/index.tsx";
import { Select, SelectValue } from "../select/index.tsx";
import { Label } from "../label/index.tsx";
import { Popover } from "../popover/index.tsx";
import { ListBox, ListBoxItem } from "../listbox/index.tsx";
import { Tab, TabList, TabPanel, Tabs } from "../tabs/index.tsx";
import { Radio, RadioButton, RadioField, RadioGroup } from "../radio-group/index.tsx";
import { Text } from "../text/index.tsx";
import { Heading } from "../heading/index.tsx";
import { Link } from "../link/index.tsx";
import { Group } from "../group/index.tsx";
import { Toolbar } from "../toolbar/index.tsx";
import { TextField } from "../text-field/index.tsx";
import { Input } from "../input/index.tsx";
import { SearchField } from "../search-field/index.tsx";
import { Disclosure, DisclosureGroup, DisclosurePanel } from "../disclosure/index.tsx";
import { closeTooltip, createTooltipTriggerState, openTooltip, tooltipCloseDelay, tooltipDelay } from "../state/tooltip.ts";
import { createOverlayTriggerState } from "../state/overlays.ts";
import { hoverTriggerOpen } from "../overlay/hover-trigger.tsx";
import { Meter } from "../meter/index.tsx";
import { ProgressBar } from "../progress-bar/index.tsx";
import { NumberField } from "../number-field/index.tsx";
import { Breadcrumb, Breadcrumbs } from "../breadcrumbs/index.tsx";
import { ColorSwatch } from "../color-swatch/index.tsx";
import { Separator } from "../separator/index.tsx";
import { Form } from "../form/index.tsx";
import { ToggleButtonGroup } from "../toggle-button-group/index.tsx";
import { ColorSlider } from "../color-slider/index.tsx";
import { ColorField } from "../color-field/index.tsx";
import { CheckboxGroup } from "../checkbox/index.tsx";
import { GridList, GridListItem } from "../grid-list/index.tsx";
import { Menu, MenuItem } from "../menu/index.tsx";
import { Tag, TagGroup, TagList } from "../tag-group/index.tsx";
import { Tree, TreeItem, TreeItemContent } from "../tree/index.tsx";
import { Cell, Column, Row, Table, TableBody, TableHeader } from "../table/index.tsx";
import { ComboBox } from "../combobox/index.tsx";
import { UNSTABLE_ToastContent as ToastContent } from "../toast/index.tsx";

afterEach(cleanup);

function mount(ui: () => unknown): HTMLElement {
  return render(ui as never).container as HTMLElement;
}

describe("live props: Button", () => {
  it("aria-pressed / isDisabled / class value forms update in place", () => {
    const pressed = signal(false);
    const disabled = signal(false);
    const cls = signal("a");
    const root = mount(() => (
      <Button aria-pressed={pressed()} isDisabled={disabled()} class={cls()}>
        Like
      </Button>
    ));
    const button = root.querySelector("button")!;
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute("class", "a");
    pressed.set(true);
    disabled.set(true);
    cls.set("b");
    expect(root.querySelector("button")).toBe(button);
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("data-disabled", "true");
    expect(button).toHaveAttribute("class", "b");
  });

  it("live own props merge with ButtonContext props (classes join, own wins)", () => {
    const pressed = signal<boolean | undefined>(undefined);
    const cls = signal("own");
    const root = mount(() => (
      <Provider values={[[ButtonContext, { class: "ctx", "aria-pressed": true }]]}>
        <Button aria-pressed={pressed()} class={cls()}>
          x
        </Button>
      </Provider>
    ));
    const button = root.querySelector("button")!;
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveAttribute("class", "ctx own");
    pressed.set(false);
    cls.set("mine");
    expect(root.querySelector("button")).toBe(button);
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).toHaveAttribute("class", "ctx mine");
  });

  it("live data-* / aria-label pass through", () => {
    const label = signal("one");
    const data = signal("x");
    const root = mount(() => (
      <Button aria-label={label()} data-state={data()}>
        x
      </Button>
    ));
    const button = root.querySelector("button")!;
    expect(button).toHaveAttribute("aria-label", "one");
    expect(button).toHaveAttribute("data-state", "x");
    label.set("two");
    data.set("y");
    expect(root.querySelector("button")).toBe(button);
    expect(button).toHaveAttribute("aria-label", "two");
    expect(button).toHaveAttribute("data-state", "y");
  });
});

describe("live props: ToggleButton", () => {
  it("isSelected / isDisabled / aria-label / class value forms update in place", () => {
    const on = signal(false);
    const root = mount(() => (
      <ToggleButton isSelected={on()} isDisabled={on()} aria-label={on() ? "Unlike" : "Like"} class={on() ? "on" : "off"} onChange={() => {}}>
        x
      </ToggleButton>
    ));
    const button = root.querySelector("button")!;
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).toHaveAttribute("aria-label", "Like");
    expect(button).toHaveAttribute("class", "off");
    expect(button).not.toBeDisabled();
    on.set(true);
    expect(root.querySelector("button")).toBe(button);
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveAttribute("data-selected", "true");
    expect(button).toHaveAttribute("aria-label", "Unlike");
    expect(button).toHaveAttribute("class", "on");
    expect(button).toBeDisabled();
  });
});

describe("live props: Checkbox", () => {
  it("isSelected / isDisabled / isInvalid / isReadOnly / class value forms update in place", () => {
    const on = signal(false);
    const root = mount(() => (
      <CheckboxField isSelected={on()} isDisabled={on()} isInvalid={on()} isReadOnly={on()} class={on() ? "on" : "off"} onChange={() => {}}>
        <CheckboxButton>Accept</CheckboxButton>
      </CheckboxField>
    ));
    const field = root.firstElementChild as HTMLElement;
    const input = root.querySelector("input")!;
    expect(input.checked).toBe(false);
    expect(field).toHaveAttribute("class", "off");
    expect(field).not.toHaveAttribute("data-disabled");
    on.set(true);
    expect(root.querySelector("input")).toBe(input);
    expect(root.firstElementChild).toBe(field);
    expect(input.checked).toBe(true);
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-readonly", "true");
    expect(field).toHaveAttribute("data-selected", "true");
    expect(field).toHaveAttribute("data-disabled", "true");
    expect(field).toHaveAttribute("data-invalid", "true");
    expect(field).toHaveAttribute("data-readonly", "true");
    expect(field).toHaveAttribute("class", "on");
    on.set(false);
    expect(input.checked).toBe(false);
    expect(input).not.toBeDisabled();
    expect(field).not.toHaveAttribute("data-invalid");
  });
});

describe("live props: Switch", () => {
  it("Switch: isSelected / isDisabled / class value forms update in place", () => {
    const on = signal(false);
    const root = mount(() => (
      <Switch isSelected={on()} isDisabled={on()} class={on() ? "on" : "off"} onChange={() => {}}>
        Wi-Fi
      </Switch>
    ));
    const label = root.querySelector("label")!;
    const input = root.querySelector("input")!;
    expect(input.checked).toBe(false);
    expect(label).toHaveAttribute("class", "off");
    on.set(true);
    expect(root.querySelector("input")).toBe(input);
    expect(input.checked).toBe(true);
    expect(input).toBeDisabled();
    expect(label).toHaveAttribute("data-selected", "true");
    expect(label).toHaveAttribute("data-disabled", "true");
    expect(label).toHaveAttribute("class", "on");
    on.set(false);
    expect(input.checked).toBe(false);
    expect(input).not.toBeDisabled();
  });

  it("SwitchField: isSelected / isReadOnly / isInvalid / class update in place; two-way Signal through a wrapper", () => {
    const on = signal(false);
    const sig = signal(false);
    function Wrap(props: { isSelected: typeof sig }) {
      return (
        <SwitchField isSelected={props.isSelected}>
          <SwitchButton>Two-way</SwitchButton>
        </SwitchField>
      );
    }
    const root = mount(() => (
      <div>
        <SwitchField isSelected={on()} isReadOnly={on()} isInvalid={on()} class={on() ? "on" : "off"} onChange={() => {}}>
          <SwitchButton>Live</SwitchButton>
        </SwitchField>
        <Wrap isSelected={sig} />
      </div>
    ));
    const [field, field2] = Array.from(root.firstElementChild!.children) as HTMLElement[];
    const input = field!.querySelector("input")!;
    expect(field).toHaveAttribute("class", "off");
    on.set(true);
    expect(field!.querySelector("input")).toBe(input);
    expect(input.checked).toBe(true);
    expect(input).toHaveAttribute("aria-readonly", "true");
    expect(field).toHaveAttribute("data-readonly", "true");
    expect(field).toHaveAttribute("data-invalid", "true");
    expect(field).toHaveAttribute("class", "on");
    const input2 = field2!.querySelector("input")!;
    input2.click();
    expect(sig()).toBe(true);
    expect(input2.checked).toBe(true);
  });
});

describe("live props: Slider", () => {
  it("value / isDisabled / class value forms update in place; keyboard reports through onChange", () => {
    const value = signal(20);
    const off = signal(false);
    const seen: number[] = [];
    const root = mount(() => (
      <Slider value={value()} isDisabled={off()} class={off() ? "off" : "on"} onChange={(v: number) => seen.push(v)}>
        <SliderTrack>
          <SliderThumb />
        </SliderTrack>
      </Slider>
    ));
    const group = root.firstElementChild as HTMLElement;
    const input = root.querySelector("input")!;
    expect(input.value).toBe("20");
    expect(group).toHaveAttribute("class", "on");
    value.set(40);
    expect(root.querySelector("input")).toBe(input);
    expect(input.value).toBe("40");
    input.focus();
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowRight", bubbles: true }));
    expect(seen).toEqual([41]);
    expect(input.value).toBe("40");
    off.set(true);
    expect(group).toHaveAttribute("data-disabled", "true");
    expect(root.querySelector(".rv-SliderTrack")).toHaveAttribute("data-disabled", "true");
    expect(root.querySelector(".rv-SliderThumb")).toHaveAttribute("data-disabled", "true");
    expect(input).toBeDisabled();
    expect(group).toHaveAttribute("class", "off");
    off.set(false);
    expect(group).not.toHaveAttribute("data-disabled");
    expect(input).not.toBeDisabled();
  });
});

describe("live props: Modal", () => {
  it("Modal: isOpen value form opens / closes; isKeyboardDismissDisabled / class live", async () => {
    const open = signal(false);
    const locked = signal(true);
    const closes: boolean[] = [];
    mount(() => (
      <Modal isOpen={open()} isKeyboardDismissDisabled={locked()} class={locked() ? "m-locked" : "m-free"} onOpenChange={(v: boolean) => closes.push(v)}>
        <Dialog aria-label="Live">Body</Dialog>
      </Modal>
    ));
    expect(document.querySelector(".m-locked, .m-free")).toBeNull();
    open.set(true);
    await new Promise((r) => setTimeout(r, 0));
    const modal = document.querySelector(".m-locked") as HTMLElement;
    expect(modal).not.toBeNull();
    const dialog = document.querySelector("[role=dialog]") as HTMLElement;
    dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(closes).toEqual([]);
    locked.set(false);
    expect(document.querySelector(".m-free")).toBe(modal);
    dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(closes).toEqual([false]);
    open.set(false);
    await new Promise((r) => setTimeout(r, 50));
    expect(document.querySelector("[role=dialog]")).toBeNull();
  });

  it("ModalOverlay: isOpen / isDismissable value forms (DismissButton follows isDismissable)", async () => {
    const open = signal(true);
    const dismissable = signal(false);
    mount(() => (
      <ModalOverlay isOpen={open()} isDismissable={dismissable()} onOpenChange={() => {}} class={dismissable() ? "o-d" : "o-n"}>
        <Modal>
          <Dialog aria-label="Live overlay">Body</Dialog>
        </Modal>
      </ModalOverlay>
    ));
    await new Promise((r) => setTimeout(r, 0));
    const overlay = document.querySelector(".o-n") as HTMLElement;
    expect(overlay).not.toBeNull();
    const dismissButtons = () => document.querySelectorAll("[role=dialog] ~ * button, .rv-Modal > div button, .rv-Modal button[aria-label]").length;
    const before = dismissButtons();
    dismissable.set(true);
    expect(document.querySelector(".o-d")).toBe(overlay);
    expect(dismissButtons()).toBe(before + 1);
    open.set(false);
    await new Promise((r) => setTimeout(r, 50));
    expect(document.querySelector("[role=dialog]")).toBeNull();
  });
});

describe("live props: Select", () => {
  it("value / isDisabled / isInvalid / class value forms update in place", () => {
    const pick = signal<string>("cat");
    const off = signal(false);
    const root = mount(() => (
      <Select value={pick()} isDisabled={off()} isInvalid={off()} class={off() ? "s-off" : "s-on"} onChange={() => {}}>
        <Label>Animal</Label>
        <Button>
          <SelectValue />
        </Button>
        <Popover>
          <ListBox>
            <ListBoxItem id="cat">Cat</ListBoxItem>
            <ListBoxItem id="dog">Dog</ListBoxItem>
          </ListBox>
        </Popover>
      </Select>
    ));
    const select = root.firstElementChild as HTMLElement;
    const button = root.querySelector("button")!;
    expect(button).toHaveTextContent("Cat");
    expect(select).toHaveAttribute("class", "s-on");
    pick.set("dog");
    expect(root.querySelector("button")).toBe(button);
    expect(button).toHaveTextContent("Dog");
    expect((root.querySelector("select") as HTMLSelectElement).value).toBe("dog");
    off.set(true);
    expect(select).toHaveAttribute("data-disabled", "true");
    expect(select).toHaveAttribute("data-invalid", "true");
    expect(select).toHaveAttribute("class", "s-off");
    expect(button).toBeDisabled();
    expect(root.querySelector("select")).toBeDisabled();
    off.set(false);
    expect(select).not.toHaveAttribute("data-disabled");
    expect(button).not.toBeDisabled();
  });
});

describe("live props: ListBoxItem", () => {
  it("isDisabled / class value forms update the option in place (no node rebuild)", () => {
    const off = signal(false);
    const root = mount(() => (
      <ListBox aria-label="Animals" selectionMode="single">
        <ListBoxItem id="cat" isDisabled={off()} class={off() ? "i-off" : "i-on"}>
          Cat
        </ListBoxItem>
        <ListBoxItem id="dog">Dog</ListBoxItem>
      </ListBox>
    ));
    const cat = root.querySelector("[data-key=cat]") as HTMLElement;
    expect(cat).toHaveAttribute("class", "i-on");
    expect(cat).not.toHaveAttribute("aria-disabled");
    off.set(true);
    expect(root.querySelector("[data-key=cat]")).toBe(cat);
    expect(cat).toHaveAttribute("class", "i-off");
    expect(cat).toHaveAttribute("aria-disabled", "true");
    expect(cat).toHaveAttribute("data-disabled", "true");
    expect(cat).toHaveAttribute("data-rv-disabled", "");
    cat.click();
    expect(cat).not.toHaveAttribute("aria-selected", "true");
    off.set(false);
    expect(cat).not.toHaveAttribute("data-disabled");
    expect(cat).not.toHaveAttribute("data-rv-disabled");
  });
});

describe("live props: Tabs", () => {
  it("selectedKey / isDisabled / Tab isDisabled / class value forms update in place", () => {
    const pick = signal<string>("a");
    const off = signal(false);
    const tabOff = signal(false);
    const cls = signal("t1");
    const panelCls = signal("p1");
    const changes: unknown[] = [];
    const root = mount(() => (
      <Tabs selectedKey={pick()} isDisabled={off()} onSelectionChange={(key) => changes.push(key)}>
        <TabList aria-label="tabs">
          <Tab id="a" class={cls()}>
            A
          </Tab>
          <Tab id="b" isDisabled={tabOff()}>
            B
          </Tab>
        </TabList>
        <TabPanel id="a" class={panelCls()}>
          Panel A
        </TabPanel>
        <TabPanel id="b">Panel B</TabPanel>
      </Tabs>
    ));
    const tabs = root.querySelectorAll<HTMLElement>('[role="tab"]');
    const [a, b] = [tabs[0]!, tabs[1]!];
    const tabsRoot = root.firstElementChild as HTMLElement;
    expect(a).toHaveAttribute("aria-selected", "true");
    expect(a).toHaveAttribute("class", "t1");
    expect(root.querySelector('[role="tabpanel"]')).toHaveAttribute("class", "p1");
    expect(b).not.toHaveAttribute("aria-disabled");
    pick.set("b");
    expect(root.querySelectorAll('[role="tab"]')[0]).toBe(a);
    expect(b).toHaveAttribute("aria-selected", "true");
    expect(a).toHaveAttribute("aria-selected", "false");
    expect(root.querySelector('[role="tabpanel"]')).toHaveTextContent("Panel B");
    pick.set("a");
    panelCls.set("p2");
    expect(root.querySelector('[role="tabpanel"]')).toHaveAttribute("class", "p2");
    cls.set("t2");
    expect(a).toHaveAttribute("class", "t2");
    tabOff.set(true);
    expect(b).toHaveAttribute("aria-disabled", "true");
    expect(b).toHaveAttribute("data-disabled", "true");
    expect(b).not.toHaveAttribute("tabindex");
    tabOff.set(false);
    expect(b).not.toHaveAttribute("aria-disabled");
    expect(b).toHaveAttribute("tabindex", "-1");
    off.set(true);
    expect(tabsRoot).toHaveAttribute("data-disabled", "true");
    expect(a).toHaveAttribute("aria-disabled", "true");
    expect(b).toHaveAttribute("aria-disabled", "true");
    b.click();
    expect(changes).toEqual([]);
    off.set(false);
    expect(tabsRoot).not.toHaveAttribute("data-disabled");
    expect(a).not.toHaveAttribute("aria-disabled");
  });
});

describe("live props: RadioGroup", () => {
  it("group isDisabled / isReadOnly / isInvalid / class and radio isDisabled / class value forms update in place", () => {
    const value = signal<string | null>("a");
    const off = signal(false);
    const ro = signal(false);
    const bad = signal(false);
    const radioOff = signal(false);
    const cls = signal("g1");
    const rcls = signal("r1");
    const root = mount(() => (
      <RadioGroup aria-label="Pick" value={value} isDisabled={off()} isReadOnly={ro()} isInvalid={bad()} class={cls()}>
        <RadioField value="a" class={rcls()}>
          <RadioButton>A</RadioButton>
        </RadioField>
        <Radio value="b" isDisabled={radioOff()} class={rcls()}>
          B
        </Radio>
      </RadioGroup>
    ));
    const group = root.querySelector('[role="radiogroup"]') as HTMLElement;
    const inputs = root.querySelectorAll("input");
    const [a, b] = [inputs[0]!, inputs[1]!];
    const field = a.closest(".r1, .r2") as HTMLElement;
    const radioLabel = b.closest("label") as HTMLElement;
    expect(group).toHaveAttribute("class", "g1");
    expect(field).toHaveAttribute("class", "r1");
    expect(radioLabel).toHaveAttribute("class", "r1");
    expect(a.checked).toBe(true);
    radioOff.set(true);
    expect(b).toBeDisabled();
    expect(radioLabel).toHaveAttribute("data-disabled", "true");
    radioOff.set(false);
    expect(b).not.toBeDisabled();
    cls.set("g2");
    rcls.set("r2");
    expect(group).toHaveAttribute("class", "g2");
    expect(field).toHaveAttribute("class", "r2");
    expect(radioLabel).toHaveAttribute("class", "r2");
    bad.set(true);
    expect(group).toHaveAttribute("aria-invalid", "true");
    expect(group).toHaveAttribute("data-invalid", "true");
    ro.set(true);
    expect(group).toHaveAttribute("aria-readonly", "true");
    expect(group).toHaveAttribute("data-readonly", "true");
    expect(field).toHaveAttribute("data-readonly", "true");
    expect(radioLabel).toHaveAttribute("data-readonly", "true");
    b.click();
    expect(value()).toBe("a");
    expect(a.checked).toBe(true);
    ro.set(false);
    expect(group).not.toHaveAttribute("data-readonly");
    off.set(true);
    expect(group).toHaveAttribute("aria-disabled", "true");
    expect(group).toHaveAttribute("data-disabled", "true");
    expect(a).toBeDisabled();
    expect(b).toBeDisabled();
    off.set(false);
    expect(a).not.toBeDisabled();
    b.click();
    expect(value()).toBe("b");
    expect(root.querySelector('[role="radiogroup"]')).toBe(group);
  });
});

describe("live props: class / style / children of render-props parts and text parts", () => {
  it("Label / Text / Heading / Link / Group / Toolbar update class and children in place", () => {
    const cls = signal("a");
    const txt = signal("one");
    const root = mount(() => (
      <div>
        <Label class={cls()}>{txt()}</Label>
        <Text class={cls()} elementType="p">
          {txt()}
        </Text>
        <Heading level={2} class={cls()}>
          {txt()}
        </Heading>
        <Link href="#x" class={cls()}>
          {txt()}
        </Link>
        <Group class={cls()}>{txt()}</Group>
        <Toolbar aria-label="t" class={cls()}>
          {txt()}
        </Toolbar>
      </div>
    ));
    const els = [...root.querySelectorAll(".a")];
    expect(els.map((el) => el.tagName)).toEqual(["LABEL", "P", "H2", "A", "DIV", "DIV"]);
    expect(els.every((el) => el.textContent === "one")).toBe(true);
    cls.set("b");
    txt.set("two");
    expect([...root.querySelectorAll(".b")]).toEqual(els);
    expect(els.every((el) => el.textContent === "two")).toBe(true);
  });
});

describe("live props: forwarded two-way Signal", () => {
  it("isSelected={sig} through a wrapper's getter stays two-way (ui Checkbox)", () => {
    const sig = signal(false);
    function Wrap(props: { isSelected: typeof sig }) {
      return (
        <CheckboxField isSelected={props.isSelected}>
          <CheckboxButton>Accept</CheckboxButton>
        </CheckboxField>
      );
    }
    const root = mount(() => <Wrap isSelected={sig} />);
    const input = root.querySelector("input")!;
    expect(input.checked).toBe(false);
    input.click();
    expect(sig()).toBe(true);
    expect(input.checked).toBe(true);
    sig.set(false);
    expect(input.checked).toBe(false);
  });
});

describe("live props: TextField", () => {
  it("a computed password type follows visibility without replacing the input", () => {
    const visible = signal(false);
    const passwordType = computed(() => (visible() ? "text" : "password"));
    const root = mount(() => (
      <TextField type={passwordType()} defaultValue="secret" aria-label="Password">
        <Input />
      </TextField>
    ));
    const input = root.querySelector("input")!;
    expect(input.type).toBe("password");
    input.focus();
    input.setSelectionRange(1, 4);
    visible.set(true);
    expect(passwordType()).toBe("text");
    expect(input.type).toBe("text");
    expect(root.querySelector("input")).toBe(input);
    expect(input.value).toBe("secret");
    expect(document.activeElement).toBe(input);
    expect([input.selectionStart, input.selectionEnd]).toEqual([1, 4]);
    visible.set(false);
    expect(input.type).toBe("password");
    expect(root.querySelector("input")).toBe(input);
  });

  it("value / isDisabled / isInvalid / isReadOnly / placeholder / class value forms update in place", () => {
    const on = signal(false);
    const root = mount(() => (
      <TextField
        value={on() ? "b" : "a"}
        isDisabled={on()}
        isInvalid={on()}
        isReadOnly={on()}
        class={on() ? "on" : "off"}
        aria-label="Name"
        onChange={() => {}}
      >
        <Input placeholder={on() ? "P2" : "P1"} />
      </TextField>
    ));
    const field = root.firstElementChild as HTMLElement;
    const input = root.querySelector("input")!;
    expect(input.value).toBe("a");
    expect(input).toHaveAttribute("placeholder", "P1");
    expect(field).toHaveAttribute("class", "off");
    on.set(true);
    expect(root.querySelector("input")).toBe(input);
    expect(input.value).toBe("b");
    expect(input).toHaveAttribute("placeholder", "P2");
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute("readonly");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAttribute("data-disabled", "true");
    expect(field).toHaveAttribute("data-invalid", "true");
    expect(field).toHaveAttribute("data-readonly", "true");
    expect(field).toHaveAttribute("class", "on");
    on.set(false);
    expect(input.value).toBe("a");
    expect(input).not.toBeDisabled();
    expect(field).not.toHaveAttribute("data-disabled");
  });
});

describe("live props: fields + display parts (wave 3)", () => {
  it("SearchField isDisabled / isReadOnly / isInvalid / class update in place", () => {
    const on = signal(false);
    const root = mount(() => (
      <SearchField aria-label="Search" isDisabled={on()} isReadOnly={on()} isInvalid={on()} class={on() ? "on" : "off"}>
        <Input />
      </SearchField>
    ));
    const field = root.firstElementChild as HTMLElement;
    const input = root.querySelector("input")!;
    on.set(true);
    expect(root.querySelector("input")).toBe(input);
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute("readonly");
    expect(field).toHaveAttribute("data-disabled", "true");
    expect(field).toHaveAttribute("data-readonly", "true");
    expect(field).toHaveAttribute("data-invalid", "true");
    expect(field).toHaveAttribute("class", "on");
    on.set(false);
    expect(input).not.toBeDisabled();
    expect(field).not.toHaveAttribute("data-disabled");
  });

  it("Disclosure isDisabled / class update in place; a disabled trigger does not toggle", () => {
    const on = signal(false);
    const root = mount(() => (
      <Disclosure isDisabled={on()} class={on() ? "on" : "off"}>
        <Button slot="trigger">T</Button>
        <DisclosurePanel>P</DisclosurePanel>
      </Disclosure>
    ));
    const el = root.firstElementChild as HTMLElement;
    const trigger = root.querySelector("button")!;
    on.set(true);
    expect(root.querySelector("button")).toBe(trigger);
    expect(el).toHaveAttribute("data-disabled", "true");
    expect(el).toHaveAttribute("class", "on");
    expect(trigger).toBeDisabled();
    trigger.click();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    on.set(false);
    expect(el).not.toHaveAttribute("data-disabled");
    expect(trigger).not.toBeDisabled();
  });

  it("Meter / ProgressBar value / class update in place", () => {
    const on = signal(false);
    const root = mount(() => (
      <div>
        <Meter aria-label="m" value={on() ? 80 : 20} class={on() ? "on" : "off"} />
        <ProgressBar aria-label="p" value={on() ? 70 : 10} class={on() ? "on" : "off"} />
      </div>
    ));
    const [meter, bar] = Array.from(root.querySelectorAll("[role]")) as HTMLElement[];
    expect(meter).toHaveAttribute("aria-valuenow", "20");
    expect(bar).toHaveAttribute("aria-valuenow", "10");
    on.set(true);
    expect(root.querySelector("[role]")).toBe(meter);
    expect(meter).toHaveAttribute("aria-valuenow", "80");
    expect(bar).toHaveAttribute("aria-valuenow", "70");
    expect(meter).toHaveAttribute("class", "on");
    expect(bar).toHaveAttribute("class", "on");
  });

  it("NumberField isDisabled / isReadOnly / class update in place", () => {
    const on = signal(false);
    const root = mount(() => (
      <NumberField aria-label="n" defaultValue={1} isDisabled={on()} isReadOnly={on()} class={on() ? "on" : "off"}>
        <Input />
      </NumberField>
    ));
    const field = root.firstElementChild as HTMLElement;
    const input = root.querySelector("input")!;
    on.set(true);
    expect(root.querySelector("input")).toBe(input);
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute("readonly");
    expect(field).toHaveAttribute("data-disabled", "true");
    expect(field).toHaveAttribute("class", "on");
  });

  it("Breadcrumbs isDisabled / class update in place", () => {
    const on = signal(false);
    const root = mount(() => (
      <Breadcrumbs isDisabled={on()} class={on() ? "on" : "off"}>
        <Breadcrumb id="a">
          <Link href="#a">A</Link>
        </Breadcrumb>
        <Breadcrumb id="b">
          <Link href="#b">B</Link>
        </Breadcrumb>
      </Breadcrumbs>
    ));
    const list = root.querySelector("ol")!;
    const first = root.querySelector("li")!;
    expect(first).not.toHaveAttribute("data-disabled");
    on.set(true);
    expect(root.querySelector("li")).toBe(first);
    expect(first).toHaveAttribute("data-disabled", "true");
    expect(list).toHaveAttribute("class", "on");
    on.set(false);
    expect(first).not.toHaveAttribute("data-disabled");
  });

  it("ColorSwatch color / Separator, Form, ToggleButtonGroup, ColorSlider, ColorField class update in place", () => {
    const on = signal(false);
    const root = mount(() => (
      <div>
        <ColorSwatch color={on() ? "#f00" : "#00f"} class={on() ? "on" : "off"} />
        <Separator class={on() ? "on" : "off"} />
        <Form class={on() ? "on" : "off"}>f</Form>
        <ToggleButtonGroup aria-label="g" class={on() ? "on" : "off"}>
          <ToggleButton id="a">A</ToggleButton>
        </ToggleButtonGroup>
        <ColorSlider aria-label="cs" channel="hue" defaultValue="hsl(0,100%,50%)" class={on() ? "on" : "off"} />
        <ColorField aria-label="cf" class={on() ? "on" : "off"}>
          <Input />
        </ColorField>
      </div>
    ));
    const host = root.firstElementChild as HTMLElement;
    const parts = Array.from(host.children) as HTMLElement[];
    const swatch = parts[0]!;
    const before = swatch.getAttribute("aria-label");
    expect(parts.every((p) => p.getAttribute("class") === "off")).toBe(true);
    on.set(true);
    expect(host.firstElementChild).toBe(swatch);
    expect((Array.from(host.children) as HTMLElement[]).map((p) => p.getAttribute("class"))).toEqual(["on", "on", "on", "on", "on", "on"]);
    expect(swatch.getAttribute("aria-label")).not.toBe(before);
    expect(swatch.style.backgroundColor).toBe("rgb(255, 0, 0)");
  });
});

describe("live props: CheckboxGroup / ToastContent", () => {
  it("class (and ToastContent children) update in place", () => {
    const on = signal(false);
    const root = mount(() => (
      <div>
        <CheckboxGroup aria-label="g" class={on() ? "on" : "off"}>
          g
        </CheckboxGroup>
        <ToastContent class={on() ? "on" : "off"}>{on() ? "B" : "A"}</ToastContent>
      </div>
    ));
    const [group, content] = Array.from((root.firstElementChild as HTMLElement).children) as HTMLElement[];
    expect([group!.className, content!.className, content!.textContent]).toEqual(["off", "off", "A"]);
    on.set(true);
    expect((root.firstElementChild as HTMLElement).firstElementChild).toBe(group);
    expect([group!.className, content!.className, content!.textContent]).toEqual(["on", "on", "B"]);
  });
});

describe("live props: collections (class / style / children)", () => {
  // [name, ui, class count]: classes update and every element is kept (no row re-render: `buildCollection` keeps
  // live node props unread).
  const cases: [string, (c: () => string) => unknown, number][] = [
    [
      "GridList",
      (c) => (
        <GridList aria-label="g" class={c()}>
          <GridListItem id="a" class={c()}>
            A
          </GridListItem>
        </GridList>
      ),
      2,
    ],
    [
      "Menu",
      (c) => (
        <Menu aria-label="m" class={c()}>
          <MenuItem id="a" class={c()}>
            A
          </MenuItem>
        </Menu>
      ),
      2,
    ],
    [
      "TagGroup",
      (c) => (
        <TagGroup class={c()}>
          <Label>T</Label>
          <TagList class={c()}>
            <Tag id="a" class={c()}>
              A
            </Tag>
          </TagList>
        </TagGroup>
      ),
      3,
    ],
    [
      "Tree",
      (c) => (
        <Tree aria-label="t" class={c()}>
          <TreeItem id="a" textValue="A" class={c()}>
            <TreeItemContent>A</TreeItemContent>
          </TreeItem>
        </Tree>
      ),
      2,
    ],
    [
      "Table",
      (c) => (
        <Table aria-label="t" class={c()}>
          <TableHeader class={c()}>
            <Column isRowHeader class={c()}>
              N
            </Column>
          </TableHeader>
          <TableBody class={c()}>
            <Row id="a" class={c()}>
              <Cell class={c()}>A</Cell>
            </Row>
          </TableBody>
        </Table>
      ),
      6,
    ],
    [
      "ComboBox",
      (c) => (
        <ComboBox aria-label="c" class={c()}>
          <Input />
        </ComboBox>
      ),
      1,
    ],
    [
      "ListBox",
      (c) => (
        <ListBox aria-label="l" class={c()}>
          <ListBoxItem id="a" class={c()}>
            A
          </ListBoxItem>
        </ListBox>
      ),
      2,
    ],
  ];
  for (const [name, ui, count] of cases)
    it(name + ": classes update in place", () => {
      const c = signal("x1");
      const root = mount(() => ui(c));
      const before = Array.from(root.querySelectorAll(".x1"));
      expect(before.length).toBe(count);
      c.set("x2");
      expect(root.querySelectorAll(".x1").length).toBe(0);
      const after = Array.from(root.querySelectorAll(".x2"));
      expect(after.length).toBe(count);
      expect(before.map((e, i) => (after[i] === e ? "kept" : e.tagName + "." + e.getAttribute("role")))).toEqual(before.map(() => "kept"));
    });
});

// Live by default (LIVE-SWEEP 2026-10-11): every attribute-like prop of the field / button parts follows its
// expression in place; inputs keep their node, value and focus.
describe("live props: live by default (LIVE-SWEEP)", () => {
  it("TextField input attributes (inputMode / autoComplete / enterKeyHint / spellCheck / maxLength / form / aria-haspopup / excludeFromTabOrder)", () => {
    const on = signal(false);
    const root = mount(() => (
      <TextField
        aria-label="Name"
        defaultValue="abc"
        inputMode={on() ? "email" : "text"}
        autoComplete={on() ? "email" : "off"}
        autoCapitalize={on() ? "none" : "words"}
        autoCorrect={on() ? "off" : "on"}
        enterKeyHint={on() ? "send" : "next"}
        spellCheck={on() ? "false" : "true"}
        maxLength={on() ? 5 : 10}
        form={on() ? "f2" : "f1"}
        aria-haspopup={on() ? "listbox" : undefined}
        excludeFromTabOrder={on()}
      >
        <Input />
      </TextField>
    ));
    const input = root.querySelector("input")!;
    input.focus();
    expect(input).toHaveAttribute("inputmode", "text");
    expect(input).toHaveAttribute("autocomplete", "off");
    expect(input).toHaveAttribute("enterkeyhint", "next");
    expect(input).toHaveAttribute("maxlength", "10");
    expect(input).not.toHaveAttribute("aria-haspopup");
    expect(input).not.toHaveAttribute("tabindex");
    on.set(true);
    expect(root.querySelector("input")).toBe(input);
    expect(input.value).toBe("abc");
    expect(document.activeElement).toBe(input);
    expect(input).toHaveAttribute("inputmode", "email");
    expect(input).toHaveAttribute("autocomplete", "email");
    expect(input).toHaveAttribute("autocapitalize", "none");
    expect(input).toHaveAttribute("autocorrect", "off");
    expect(input).toHaveAttribute("enterkeyhint", "send");
    expect(input).toHaveAttribute("spellcheck", "false");
    expect(input).toHaveAttribute("maxlength", "5");
    expect(input).toHaveAttribute("form", "f2");
    expect(input).toHaveAttribute("aria-haspopup", "listbox");
    expect(input).toHaveAttribute("tabindex", "-1");
    on.set(false);
    expect(input).toHaveAttribute("inputmode", "text");
    expect(input).not.toHaveAttribute("aria-haspopup");
    expect(input).not.toHaveAttribute("tabindex");
  });

  it("SearchField type / maxLength / inputMode / aria-describedby (Input placeholder)", () => {
    const on = signal(false);
    const root = mount(() => (
      <SearchField
        aria-label="Search"
        defaultValue="q"
        type={on() ? "text" : "search"}
        maxLength={on() ? 3 : 8}
        inputMode={on() ? "url" : "search"}
        aria-describedby={on() ? "hint" : undefined}
      >
        <Input placeholder={on() ? "P2" : "P1"} />
      </SearchField>
    ));
    const input = root.querySelector("input")!;
    input.focus();
    expect(input.type).toBe("search");
    expect(input).toHaveAttribute("placeholder", "P1");
    expect(input.getAttribute("aria-describedby") ?? "").not.toContain("hint");
    on.set(true);
    expect(root.querySelector("input")).toBe(input);
    expect(input.value).toBe("q");
    expect(document.activeElement).toBe(input);
    expect(input.type).toBe("text");
    expect(input).toHaveAttribute("placeholder", "P2");
    expect(input).toHaveAttribute("maxlength", "3");
    expect(input).toHaveAttribute("inputmode", "url");
    expect(input.getAttribute("aria-describedby")?.split(" ")).toContain("hint");
  });

  it("NumberField step / maxValue / aria-describedby (Input placeholder)", () => {
    const on = signal(false);
    const root = mount(() => (
      <NumberField aria-label="n" defaultValue={1} step={on() ? 5 : 1} maxValue={on() ? 6 : 100} aria-describedby={on() ? "hint" : undefined}>
        <Button slot="decrement">-</Button>
        <Input placeholder={on() ? "P2" : "P1"} />
        <Button slot="increment">+</Button>
      </NumberField>
    ));
    const input = root.querySelector("input")!;
    const increment = root.querySelectorAll("button")[1] as HTMLButtonElement;
    expect(input).toHaveAttribute("placeholder", "P1");
    on.set(true);
    expect(root.querySelector("input")).toBe(input);
    expect(input).toHaveAttribute("placeholder", "P2");
    expect(input.getAttribute("aria-describedby")?.split(" ")).toContain("hint");
    input.focus();
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }));
    // step 5 from 1 snaps to 5 (RA snapValueToStep); maxValue 6 then disables the increment button.
    expect(input.value).toBe("5");
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }));
    expect(input.value).toBe("5");
    expect(increment).toBeDisabled();
    expect(document.activeElement).toBe(input);
  });

  it("Button type / formMethod follow the expression in place", () => {
    const on = signal(false);
    const root = mount(() => (
      <Button type={on() ? "submit" : "button"} formMethod={on() ? "post" : undefined}>
        Go
      </Button>
    ));
    const button = root.querySelector("button")!;
    expect(button.type).toBe("button");
    expect(button).not.toHaveAttribute("formmethod");
    on.set(true);
    expect(root.querySelector("button")).toBe(button);
    expect(button.type).toBe("submit");
    expect(button).toHaveAttribute("formmethod", "post");
    on.set(false);
    expect(button.type).toBe("button");
  });

  it("Select placeholder / isRequired follow the expression in place", () => {
    const on = signal(false);
    const root = mount(() => (
      <Select placeholder={on() ? "Pick one" : "Choose"} isRequired={on()}>
        <Label>Animal</Label>
        <Button>
          <SelectValue />
        </Button>
        <Popover>
          <ListBox>
            <ListBoxItem id="cat">Cat</ListBoxItem>
          </ListBox>
        </Popover>
      </Select>
    ));
    const select = root.firstElementChild as HTMLElement;
    const button = root.querySelector("button")!;
    expect(button).toHaveTextContent("Choose");
    expect(select).not.toHaveAttribute("data-required");
    expect(root.querySelector("select")).not.toHaveAttribute("required");
    on.set(true);
    expect(root.querySelector("button")).toBe(button);
    expect(button).toHaveTextContent("Pick one");
    expect(select).toHaveAttribute("data-required", "true");
    expect(root.querySelector("select")).toHaveAttribute("required");
    on.set(false);
    expect(button).toHaveTextContent("Choose");
    expect(select).not.toHaveAttribute("data-required");
  });
});

// Live by default, round 2 (LIVE-SWEEP 2026-10-11).
describe("live props: live by default round 2 (LIVE-SWEEP)", () => {
  it("Slider minValue / maxValue / step / orientation / formatOptions follow the expression in place", () => {
    const on = signal(false);
    const seen: number[] = [];
    const root = mount(() => (
      <Slider
        defaultValue={50}
        minValue={on() ? 10 : 0}
        maxValue={on() ? 40 : 100}
        step={on() ? 5 : 1}
        orientation={on() ? "vertical" : "horizontal"}
        formatOptions={on() ? { style: "percent" } : undefined}
        onChange={(v: number) => seen.push(v)}
      >
        <SliderTrack>
          <SliderThumb />
        </SliderTrack>
      </Slider>
    ));
    const group = root.firstElementChild as HTMLElement;
    const track = root.querySelector(".rv-SliderTrack") as HTMLElement;
    const input = root.querySelector("input")!;
    expect(input).toHaveAttribute("min", "0");
    expect(input).toHaveAttribute("max", "100");
    expect(input).toHaveAttribute("step", "1");
    expect(input).toHaveAttribute("aria-orientation", "horizontal");
    expect(group).toHaveAttribute("data-orientation", "horizontal");
    expect(input.value).toBe("50");
    on.set(true);
    expect(root.querySelector("input")).toBe(input);
    expect(input).toHaveAttribute("min", "10");
    expect(input).toHaveAttribute("max", "40");
    expect(input).toHaveAttribute("step", "5");
    expect(input).toHaveAttribute("aria-orientation", "vertical");
    expect(group).toHaveAttribute("data-orientation", "vertical");
    expect(track).toHaveAttribute("data-orientation", "vertical");
    // The value is restricted to the live range (50 → 40) and formatted with the live options.
    expect(input.value).toBe("40");
    expect(input.getAttribute("aria-valuetext")).toMatch(/%/);
    input.focus();
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowLeft", bubbles: true }));
    expect(seen.at(-1)).toBe(35);
    on.set(false);
    expect(input).toHaveAttribute("max", "100");
    expect(group).toHaveAttribute("data-orientation", "horizontal");
  });

  it("Tabs orientation / keyboardActivation / disabledKeys follow the expression in place", () => {
    const on = signal(false);
    const changes: unknown[] = [];
    const root = mount(() => (
      <Tabs
        orientation={on() ? "vertical" : "horizontal"}
        keyboardActivation={on() ? "manual" : "automatic"}
        disabledKeys={on() ? ["c"] : []}
        onSelectionChange={(key) => changes.push(key)}
      >
        <TabList aria-label="tabs">
          <Tab id="a">A</Tab>
          <Tab id="b">B</Tab>
          <Tab id="c">C</Tab>
        </TabList>
        <TabPanel id="a">Panel A</TabPanel>
        <TabPanel id="b">Panel B</TabPanel>
        <TabPanel id="c">Panel C</TabPanel>
      </Tabs>
    ));
    const tabsRoot = root.firstElementChild as HTMLElement;
    const list = root.querySelector('[role="tablist"]') as HTMLElement;
    const tabs = root.querySelectorAll<HTMLElement>('[role="tab"]');
    const [a, b, c] = [tabs[0]!, tabs[1]!, tabs[2]!];
    expect(tabsRoot).toHaveAttribute("data-orientation", "horizontal");
    expect(list).toHaveAttribute("aria-orientation", "horizontal");
    expect(c).not.toHaveAttribute("aria-disabled");
    // automatic: an arrow key selects the focused tab.
    a.focus();
    a.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(b).toHaveAttribute("aria-selected", "true");
    on.set(true);
    expect(root.querySelector('[role="tab"]')).toBe(a);
    expect(tabsRoot).toHaveAttribute("data-orientation", "vertical");
    expect(list).toHaveAttribute("aria-orientation", "vertical");
    expect(list).toHaveAttribute("data-orientation", "vertical");
    expect(c).toHaveAttribute("aria-disabled", "true");
    // manual + vertical: ArrowDown moves focus only (c is disabled: skipped to a).
    b.focus();
    b.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(document.activeElement).toBe(a);
    expect(b).toHaveAttribute("aria-selected", "true");
    expect(a).toHaveAttribute("aria-selected", "false");
    on.set(false);
    expect(c).not.toHaveAttribute("aria-disabled");
    expect(list).toHaveAttribute("aria-orientation", "horizontal");
  });

  it("RadioGroup orientation / aria-describedby follow the expression in place", () => {
    const on = signal(false);
    const root = mount(() => (
      <RadioGroup aria-label="g" orientation={on() ? "horizontal" : "vertical"} aria-describedby={on() ? "hint" : undefined}>
        <Radio value="a">A</Radio>
        <Radio value="b">B</Radio>
      </RadioGroup>
    ));
    const group = root.querySelector('[role="radiogroup"]') as HTMLElement;
    expect(group).toHaveAttribute("aria-orientation", "vertical");
    expect(group).toHaveAttribute("data-orientation", "vertical");
    expect(group.getAttribute("aria-describedby") ?? "").not.toContain("hint");
    on.set(true);
    expect(root.querySelector('[role="radiogroup"]')).toBe(group);
    expect(group).toHaveAttribute("aria-orientation", "horizontal");
    expect(group).toHaveAttribute("data-orientation", "horizontal");
    expect(group.getAttribute("aria-describedby")).toContain("hint");
  });

  it("Meter / ProgressBar formatOptions follow the expression in place", () => {
    const on = signal(false);
    const root = mount(() => (
      <div>
        <Meter aria-label="m" value={50} formatOptions={on() ? { style: "decimal" } : undefined} />
        <ProgressBar aria-label="p" value={25} formatOptions={on() ? { style: "decimal" } : undefined} />
      </div>
    ));
    const meter = root.querySelector('[role="meter"]') as HTMLElement;
    const bar = root.querySelector('[role="progressbar"]') as HTMLElement;
    expect(meter.getAttribute("aria-valuetext")).toMatch(/%/);
    expect(bar.getAttribute("aria-valuetext")).toMatch(/%/);
    on.set(true);
    expect(root.querySelector('[role="meter"]')).toBe(meter);
    expect(meter).toHaveAttribute("aria-valuetext", "50");
    expect(bar).toHaveAttribute("aria-valuetext", "25");
  });

  it("ToggleButtonGroup disallowEmptySelection is read at press time", () => {
    const strict = signal(false);
    const root = mount(() => (
      <ToggleButtonGroup aria-label="g" defaultSelectedKeys={["a"]} disallowEmptySelection={strict()}>
        <ToggleButton id="a">A</ToggleButton>
        <ToggleButton id="b">B</ToggleButton>
      </ToggleButtonGroup>
    ));
    const a = root.querySelectorAll("button")[0]!;
    strict.set(true);
    a.click();
    expect(a).toHaveAttribute("aria-checked", "true");
    strict.set(false);
    a.click();
    expect(a).toHaveAttribute("aria-checked", "false");
  });

  it("DisclosureGroup isDisabled / allowsMultipleExpanded follow the expression in place", async () => {
    const off = signal(false);
    const multi = signal(true);
    const root = mount(() => (
      <DisclosureGroup isDisabled={off()} allowsMultipleExpanded={multi()} defaultExpandedKeys={["a", "b"]}>
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
    const group = root.firstElementChild as HTMLElement;
    const [a, b] = Array.from(root.querySelectorAll("button"));
    expect(a).toHaveAttribute("aria-expanded", "true");
    expect(b).toHaveAttribute("aria-expanded", "true");
    expect(group).not.toHaveAttribute("data-disabled");
    off.set(true);
    expect(group).toHaveAttribute("data-disabled", "true");
    expect(a).toBeDisabled();
    off.set(false);
    expect(a).not.toBeDisabled();
    // Turning allowsMultipleExpanded off keeps one expanded item (upstream effect).
    multi.set(false);
    // The clamp is a client effect: it runs, and its write reaches the DOM, a task later.
    await new Promise((resolve) => setTimeout(resolve, 0));
    flush();
    expect([a, b].filter((x) => x!.getAttribute("aria-expanded") === "true")).toHaveLength(1);
  });

  it("TooltipTrigger delay / closeDelay and the hover trigger delays are read at event time", () => {
    const delay = signal(1500);
    const closeDelay = signal(500);
    const state = createTooltipTriggerState({ delay: () => delay(), closeDelay: () => closeDelay() });
    expect(tooltipDelay(state)).toBe(1500);
    expect(tooltipCloseDelay(state)).toBe(500);
    delay.set(0);
    closeDelay.set(0);
    expect(tooltipDelay(state)).toBe(0);
    expect(tooltipCloseDelay(state)).toBe(0);
    // delay 0: opens without the warmup timer; closeDelay 0: closes at once.
    openTooltip(state);
    expect(state.isOpen()).toBe(true);
    closeTooltip(state);
    expect(state.isOpen()).toBe(false);
    const hoverDelay = signal(300);
    const overlay = createOverlayTriggerState();
    hoverTriggerOpen({ delay: () => hoverDelay() }, overlay);
    expect(overlay.isOpen()).toBe(false);
    hoverDelay.set(0);
    const other = createOverlayTriggerState();
    hoverTriggerOpen({ delay: () => hoverDelay() }, other);
    expect(other.isOpen()).toBe(true);
  });

  it("GridListItem / MenuItem / TreeItem / Row isDisabled follow the expression in place", () => {
    const off = signal(false);
    const actions: unknown[] = [];
    const root = mount(() => (
      <div>
        <GridList aria-label="g" selectionMode="multiple">
          <GridListItem id="a" isDisabled={off()}>
            A
          </GridListItem>
          <GridListItem id="b">B</GridListItem>
        </GridList>
        <Menu aria-label="m" onAction={(key) => actions.push(key)}>
          <MenuItem id="a" isDisabled={off()}>
            A
          </MenuItem>
          <MenuItem id="b">B</MenuItem>
        </Menu>
        <Tree aria-label="t">
          <TreeItem id="a" textValue="A" isDisabled={off()}>
            <TreeItemContent>A</TreeItemContent>
          </TreeItem>
        </Tree>
        <Table aria-label="tb" selectionMode="multiple">
          <TableHeader>
            <Column isRowHeader>N</Column>
          </TableHeader>
          <TableBody>
            <Row id="a" isDisabled={off()}>
              <Cell>A</Cell>
            </Row>
          </TableBody>
        </Table>
      </div>
    ));
    const gridRow = root.querySelector('[role="grid"] [role="row"]') as HTMLElement;
    const menuItem = root.querySelector('[role="menuitem"]') as HTMLElement;
    const treeRow = root.querySelector('[role="treegrid"] [role="row"]') as HTMLElement;
    const tableRow = root.querySelectorAll('[role="grid"]')[1]!.querySelectorAll('[role="row"]')[1] as HTMLElement;
    const rows = [gridRow, menuItem, treeRow, tableRow];
    expect(rows.map((r) => r.getAttribute("aria-disabled"))).toEqual([null, null, null, null]);
    off.set(true);
    expect(root.querySelector('[role="menuitem"]')).toBe(menuItem);
    expect(rows.map((r) => r.getAttribute("aria-disabled"))).toEqual(["true", "true", "true", "true"]);
    expect(rows.map((r) => r.getAttribute("data-disabled"))).toEqual(["true", "true", "true", "true"]);
    menuItem.click();
    expect(actions).toEqual([]);
    off.set(false);
    expect(rows.map((r) => r.getAttribute("aria-disabled"))).toEqual([null, null, null, null]);
    menuItem.click();
    expect(actions).toEqual(["a"]);
  });
});
