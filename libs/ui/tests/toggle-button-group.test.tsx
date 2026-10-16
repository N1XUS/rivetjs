// DOM-target suite: `ToggleButtonGroup` (upstream toggle-button-group tests ported): data-slot + BEM block, Separator, orientation /
// full-width / detached modifiers, selectionMode multiple (toolbar, aria-pressed, onSelectionChange Sets) + defaultSelectedKeys,
// selectionMode single (radiogroup, aria-checked) + disallowEmptySelection, group disabled on every button, inherited size; Rivet:
// two-way `selectedKeys` signal, context read by a custom part, live group `size` / `orientation` restyle in place, live group
// `isDisabled` / `orientation` reach cdk state / ARIA / every ToggleButton in place.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal, useContext } = await import("@rivetjs/reactivity");
const { ToggleButton } = await import("../src/components/toggle-button/index.ts");
const { ToggleButtonGroup, ToggleButtonGroupRoot, ToggleButtonGroupSeparator, ToggleButtonGroupContext, TOGGLE_BUTTON_GROUP_CHILD, toggleButtonGroupVariants } =
  await import("../src/components/toggle-button-group/index.ts");

const flush = () => new Promise((r) => setTimeout(r, 0));
const byText = (root: ParentNode, text: string) => Array.from(root.querySelectorAll("button")).find((b) => b.textContent === text) as HTMLButtonElement;
const keys = (s: Set<unknown>) => [...s].sort();

test("toggle-button-group: data-slot + BEM block, compound statics", () => {
  const r = render(() => (
    <ToggleButtonGroup data-testid="group" selectionMode="multiple">
      <ToggleButton id="bold">Bold</ToggleButton>
    </ToggleButtonGroup>
  ));
  const group = r.container.querySelector("[data-testid=group]")!;
  assert.equal(group.getAttribute("data-slot"), "toggle-button-group");
  assert.equal(group.className, toggleButtonGroupVariants().base());
  assert.equal(ToggleButtonGroup, ToggleButtonGroupRoot);
  assert.equal(ToggleButtonGroup.Separator, ToggleButtonGroupSeparator);
  assert.equal(TOGGLE_BUTTON_GROUP_CHILD, "__toggle_button_group_child");
  r.unmount();
});

test("toggle-button-group: Separator with data-slot + aria-hidden inside a ToggleButton", () => {
  const r = render(() => (
    <ToggleButtonGroup selectionMode="multiple">
      <ToggleButton id="bold">Bold</ToggleButton>
      <ToggleButton id="italic">
        <ToggleButtonGroup.Separator />
        Italic
      </ToggleButton>
    </ToggleButtonGroup>
  ));
  const sep = r.container.querySelector('[data-slot="toggle-button-group-separator"]')!;
  assert.equal(sep.getAttribute("aria-hidden"), "true");
  assert.equal(sep.className, "toggle-button-group__separator");
  r.unmount();
});

test("toggle-button-group: orientation, full-width and detached BEM modifiers", () => {
  const r = render(() => (
    <>
      <ToggleButtonGroup fullWidth data-testid="g1" orientation="vertical" selectionMode="multiple">
        <ToggleButton id="bold">Bold</ToggleButton>
      </ToggleButtonGroup>
      <ToggleButtonGroup isDetached data-testid="g2" selectionMode="multiple">
        <ToggleButton id="bold">Bold</ToggleButton>
      </ToggleButtonGroup>
    </>
  ));
  const g1 = r.container.querySelector("[data-testid=g1]")!;
  assert.match(g1.className, /toggle-button-group--vertical/);
  assert.match(g1.className, /toggle-button-group--full-width/);
  assert.equal(g1.getAttribute("data-orientation"), "vertical");
  assert.match(r.container.querySelector("[data-testid=g2]")!.className, /toggle-button-group--detached/);
  r.unmount();
});

test("toggle-button-group: selectionMode=multiple → toolbar, pressable buttons, onSelectionChange Sets", async () => {
  const changes: unknown[][] = [];
  const r = render(() => (
    <ToggleButtonGroup selectionMode="multiple" onSelectionChange={(s: Set<unknown>) => changes.push(keys(s))}>
      <ToggleButton id="bold">Bold</ToggleButton>
      <ToggleButton id="italic">Italic</ToggleButton>
    </ToggleButtonGroup>
  ));
  const group = r.container.firstElementChild!;
  assert.equal(group.getAttribute("role"), "toolbar");
  const bold = byText(group, "Bold");
  assert.equal(bold.getAttribute("aria-pressed"), "false");
  bold.click();
  await flush();
  assert.equal(bold.getAttribute("aria-pressed"), "true");
  byText(group, "Italic").click();
  await flush();
  assert.deepEqual(changes, [["bold"], ["bold", "italic"]]);
  r.unmount();
});

test("toggle-button-group: defaultSelectedKeys", () => {
  const r = render(() => (
    <ToggleButtonGroup defaultSelectedKeys={["bold"]} selectionMode="multiple">
      <ToggleButton id="bold">Bold</ToggleButton>
      <ToggleButton id="italic">Italic</ToggleButton>
    </ToggleButtonGroup>
  ));
  assert.equal(byText(r.container, "Bold").getAttribute("aria-pressed"), "true");
  assert.equal(byText(r.container, "Italic").getAttribute("aria-pressed"), "false");
  r.unmount();
});

test("toggle-button-group: selectionMode=single → radiogroup with radio buttons", async () => {
  const changes: unknown[][] = [];
  const r = render(() => (
    <ToggleButtonGroup selectionMode="single" onSelectionChange={(s: Set<unknown>) => changes.push(keys(s))}>
      <ToggleButton id="left">Left</ToggleButton>
      <ToggleButton id="center">Center</ToggleButton>
    </ToggleButtonGroup>
  ));
  const group = r.container.firstElementChild!;
  assert.equal(group.getAttribute("role"), "radiogroup");
  const left = byText(group, "Left");
  const center = byText(group, "Center");
  assert.equal(left.getAttribute("role"), "radio");
  assert.equal(left.getAttribute("aria-checked"), "false");
  left.click();
  await flush();
  assert.equal(left.getAttribute("aria-checked"), "true");
  center.click();
  await flush();
  assert.equal(center.getAttribute("aria-checked"), "true");
  assert.equal(left.getAttribute("aria-checked"), "false");
  assert.deepEqual(changes, [["left"], ["center"]]);
  r.unmount();
});

test("toggle-button-group: disallowEmptySelection keeps the selected radio", async () => {
  const r = render(() => (
    <ToggleButtonGroup disallowEmptySelection defaultSelectedKeys={["left"]} selectionMode="single">
      <ToggleButton id="left">Left</ToggleButton>
      <ToggleButton id="center">Center</ToggleButton>
    </ToggleButtonGroup>
  ));
  const left = byText(r.container, "Left");
  left.click();
  await flush();
  assert.equal(left.getAttribute("aria-checked"), "true");
  r.unmount();
});

test("toggle-button-group: group disabled state on every button", () => {
  const r = render(() => (
    <ToggleButtonGroup isDisabled selectionMode="multiple">
      <ToggleButton id="bold">Bold</ToggleButton>
      <ToggleButton id="italic">Italic</ToggleButton>
    </ToggleButtonGroup>
  ));
  for (const b of r.container.querySelectorAll("button")) assert.equal(b.hasAttribute("disabled"), true);
  r.unmount();
});

test("toggle-button-group: inherited size on child ToggleButtons", () => {
  const r = render(() => (
    <ToggleButtonGroup selectionMode="multiple" size="lg">
      <ToggleButton id="bold">Bold</ToggleButton>
    </ToggleButtonGroup>
  ));
  assert.match(byText(r.container, "Bold").className, /toggle-button--lg/);
  r.unmount();
});

test("toggle-button-group (Rivet): two-way selectedKeys signal (external set → aria, press → signal)", async () => {
  const selected = signal<Set<string>>(new Set(["b"]));
  const r = render(() => (
    <ToggleButtonGroup selectionMode="multiple" selectedKeys={selected as never}>
      <ToggleButton id="a">A</ToggleButton>
      <ToggleButton id="b">B</ToggleButton>
    </ToggleButtonGroup>
  ));
  const a = byText(r.container, "A");
  const b = byText(r.container, "B");
  assert.equal(b.getAttribute("aria-pressed"), "true");
  selected.set(new Set(["a"]));
  await flush();
  assert.equal(a.getAttribute("aria-pressed"), "true");
  assert.equal(b.getAttribute("aria-pressed"), "false");
  b.click();
  await flush();
  assert.deepEqual(keys(selected()), ["a", "b"]);
  r.unmount();
});

test("toggle-button-group (Rivet): context read by a custom part; live size / orientation restyle in place", () => {
  const size = signal<"sm" | "lg">("sm");
  const orientation = signal<"horizontal" | "vertical">("horizontal");
  const Probe = () => {
    const ctx = useContext(ToggleButtonGroupContext);
    return <output id="probe">{() => `${ctx.size}|${ctx.isDisabled}|${ctx.orientation}`}</output>;
  };
  const r = render(() => (
    <ToggleButtonGroup selectionMode="multiple" size={size()} orientation={orientation()} isDetached>
      <ToggleButton id="a">A</ToggleButton>
      <Probe />
    </ToggleButtonGroup>
  ));
  const group = r.container.firstElementChild!;
  const a = byText(group, "A");
  assert.equal(r.container.querySelector("#probe")!.textContent, "sm|undefined|horizontal");
  size.set("lg");
  assert.match(a.className, /toggle-button--lg/);
  orientation.set("vertical");
  assert.match(group.className, /toggle-button-group--vertical/);
  assert.match(group.className, /toggle-button-group--detached/);
  assert.equal(r.container.querySelector("#probe")!.textContent, "lg|undefined|vertical");
  size.set("sm");
  assert.match(a.className, /toggle-button--sm/);
  assert.equal(r.container.firstElementChild, group);
  assert.equal(byText(group, "A"), a);
  r.unmount();
});

test("toggle-button-group (Rivet): live isDisabled / orientation reach cdk state, ARIA and every ToggleButton in place", async () => {
  const disabled = signal(false);
  const orientation = signal<"horizontal" | "vertical">("horizontal");
  const changes: string[][] = [];
  const r = render(() => (
    <ToggleButtonGroup
      selectionMode="multiple"
      isDisabled={disabled()}
      orientation={orientation()}
      onSelectionChange={(s: Set<unknown>) => changes.push(keys(s) as string[])}
    >
      <ToggleButton id="a">A</ToggleButton>
      <ToggleButton id="b">B</ToggleButton>
    </ToggleButtonGroup>
  ));
  const group = r.container.firstElementChild!;
  const a = byText(group, "A");
  const b = byText(group, "B");
  for (const round of [1, 2, 3]) {
    const want = round % 2 === 1;
    disabled.set(want);
    assert.equal(group.getAttribute("data-disabled"), want ? "true" : null, `group data-disabled round ${round}`);
    assert.equal(group.getAttribute("aria-disabled"), want ? "true" : null, `group aria-disabled round ${round}`);
    for (const button of [a, b]) {
      assert.equal(button.hasAttribute("disabled"), want, `${button.textContent} disabled round ${round}`);
      assert.equal(button.getAttribute("data-disabled"), want ? "true" : null);
    }
  }
  orientation.set("vertical");
  assert.equal(group.getAttribute("data-orientation"), "vertical");
  assert.equal(group.getAttribute("aria-orientation"), "vertical");
  assert.match(group.className, /toggle-button-group--vertical/);
  b.click(); // still disabled (round 3): the press handler reads the group state's live `isDisabled`
  await flush();
  assert.deepEqual(changes, []);
  disabled.set(false);
  b.click();
  await flush();
  assert.deepEqual(changes, [["b"]]);
  assert.equal(r.container.firstElementChild, group);
  assert.equal(byText(group, "A"), a);
  r.unmount();
});
