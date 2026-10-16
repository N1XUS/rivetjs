// DOM-target suite: `ButtonGroup` (upstream button-group tests ported): role=group + data-slot, orientation BEM modifiers,
// Separator (aria-hidden, data-slot, slot class), inherited size / variant / isDisabled, child props win, pressing grouped buttons;
// Rivet: nested (non-direct) Buttons inherit too (no `cloneElement`; Known diffs) unless `BUTTON_GROUP_CHILD: false`, orientation
// from the cdk `ToggleButtonGroupContext`, live group `isDisabled` / `size` / `variant` / `orientation` update every Button in place.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();

const { render } = await import("@rivetjs/runtime/testing");
const { Provider } = await import("@rivetjs/runtime/dom");
const { signal, useContext } = await import("@rivetjs/reactivity");
const { ToggleButtonGroupContext } = await import("@rivetjs/cdk/toggle-button-group");
const { Button } = await import("../src/components/button/index.ts");
const { ButtonGroup, ButtonGroupRoot, ButtonGroupSeparator, ButtonGroupContext, BUTTON_GROUP_CHILD, buttonGroupVariants } =
  await import("../src/components/button-group/index.ts");

const flush = () => new Promise((r) => setTimeout(r, 0));

test("button-group: role=group, data-slot, BEM block, compound statics", () => {
  const r = render(() => (
    <ButtonGroup>
      <Button>One</Button>
      <Button>Two</Button>
    </ButtonGroup>
  ));
  const group = r.container.firstElementChild!;
  assert.equal(group.getAttribute("role"), "group");
  assert.equal(group.getAttribute("data-slot"), "button-group");
  assert.equal(group.className, buttonGroupVariants().base());
  assert.match(group.className, /button-group/);
  assert.equal(group.querySelectorAll("button").length, 2);
  assert.equal(ButtonGroup, ButtonGroupRoot);
  assert.equal(ButtonGroup.Separator, ButtonGroupSeparator);
  assert.equal(typeof BUTTON_GROUP_CHILD, "string");
  r.unmount();
});

test("button-group: orientation BEM modifiers (default horizontal; vertical)", () => {
  const h = render(() => (
    <ButtonGroup>
      <Button>One</Button>
    </ButtonGroup>
  ));
  assert.match(h.container.firstElementChild!.className, /button-group--horizontal/);
  h.unmount();
  const v = render(() => (
    <ButtonGroup orientation="vertical" fullWidth class="x">
      <Button>One</Button>
    </ButtonGroup>
  ));
  const cls = v.container.firstElementChild!.className;
  assert.match(cls, /button-group--vertical/);
  assert.match(cls, /button-group--full-width/);
  assert.match(cls, / x$/);
  v.unmount();
});

test("button-group: orientation falls back to the cdk ToggleButtonGroupContext", () => {
  const r = render(() => (
    <Provider token={ToggleButtonGroupContext} value={{ orientation: "vertical" }}>
      {() => (
        <ButtonGroup>
          <Button>One</Button>
        </ButtonGroup>
      )}
    </Provider>
  ));
  assert.match(r.container.querySelector("[data-slot=button-group]")!.className, /button-group--vertical/);
  r.unmount();
});

test("button-group: Separator with data-slot + aria-hidden + slot class; outside a group only the caller's class", () => {
  const r = render(() => (
    <>
      <ButtonGroup>
        <Button>One</Button>
        <ButtonGroup.Separator class="mx-1" />
        <Button>Two</Button>
      </ButtonGroup>
      <ButtonGroupSeparator id="outside" class="solo" />
    </>
  ));
  const sep = r.container.querySelector('[data-slot="button-group-separator"]')!;
  assert.equal(sep.tagName, "SPAN");
  assert.equal(sep.getAttribute("aria-hidden"), "true");
  assert.equal(sep.className, "button-group__separator mx-1");
  assert.equal(r.container.querySelector("#outside")!.className, "solo");
  r.unmount();
});

test("button-group: inherited size / variant / isDisabled on Buttons; child props win", () => {
  const r = render(() => (
    <ButtonGroup size="sm" variant="secondary" isDisabled>
      <Button>Save</Button>
      <Button size="lg" variant="primary" isDisabled={false}>
        Override
      </Button>
    </ButtonGroup>
  ));
  const [save, override] = Array.from(r.container.querySelectorAll("button"));
  assert.match(save!.className, /button--sm/);
  assert.match(save!.className, /button--secondary/);
  assert.equal(save!.hasAttribute("disabled"), true);
  assert.match(override!.className, /button--lg/);
  assert.match(override!.className, /button--primary/);
  assert.doesNotMatch(override!.className, /button--sm/);
  assert.equal(override!.hasAttribute("disabled"), false);
  assert.equal(r.container.firstElementChild!.getAttribute("data-disabled"), "true");
  r.unmount();
});

test("button-group (Rivet): nested non-direct Buttons inherit too; BUTTON_GROUP_CHILD false opts out", () => {
  const r = render(() => (
    <ButtonGroup size="sm" variant="secondary">
      <div>
        <Button id="nested">Nested</Button>
      </div>
      <Button id="out" {...{ [BUTTON_GROUP_CHILD]: false }}>
        Out
      </Button>
    </ButtonGroup>
  ));
  assert.match(r.container.querySelector("#nested")!.className, /button--sm/);
  const out = r.container.querySelector("#out")!.className;
  assert.doesNotMatch(out, /button--sm/);
  assert.doesNotMatch(out, /button--secondary/);
  r.unmount();
});

test("button-group: pressing grouped buttons", async () => {
  let pressed = 0;
  const r = render(() => (
    <ButtonGroup>
      <Button onPress={() => pressed++}>Save</Button>
      <Button>Cancel</Button>
    </ButtonGroup>
  ));
  (r.container.querySelector("button") as HTMLButtonElement).click();
  await flush();
  assert.equal(pressed, 1);
  r.unmount();
});

test("button-group: ButtonGroupContext is provided around the children (custom part reads it, live fields follow)", () => {
  const size = signal<"sm" | "lg">("sm");
  const Probe = () => {
    const ctx = useContext(ButtonGroupContext);
    return <output id="probe">{`${ctx.size}|${ctx.variant}|${ctx.fullWidth}|${ctx.isDisabled}|${ctx.orientation}`}</output>;
  };
  const r = render(() => (
    <>
      <ButtonGroup size="lg" variant="ghost" fullWidth>
        <Probe />
      </ButtonGroup>
      <ButtonGroup size={size()}>
        <span id="live">{() => useContext(ButtonGroupContext).size}</span>
      </ButtonGroup>
    </>
  ));
  assert.equal(r.container.querySelector("#probe")!.textContent, "lg|ghost|true|undefined|horizontal");
  const live = r.container.querySelector("#live")!;
  assert.equal(live.textContent, "sm");
  size.set("lg");
  assert.equal(live.textContent, "lg");
  r.unmount();
});

test("button-group: live isDisabled / size / variant / orientation update every Button in place", () => {
  const disabled = signal(false);
  const size = signal<"sm" | "lg">("sm");
  const variant = signal<"secondary" | "ghost">("secondary");
  const orientation = signal<"horizontal" | "vertical">("horizontal");
  const r = render(() => (
    <ButtonGroup isDisabled={disabled()} size={size()} variant={variant()} orientation={orientation()}>
      <Button>a</Button>
      <ButtonGroup.Separator />
      <Button>b</Button>
    </ButtonGroup>
  ));
  const group = r.container.firstElementChild!;
  const buttons = Array.from(group.querySelectorAll("button"));
  const sep = group.querySelector("[data-slot=button-group-separator]")!;
  for (const b of buttons) assert.equal(b.hasAttribute("disabled"), false);
  for (const round of [1, 2]) {
    disabled.set(true);
    for (const b of buttons) assert.equal(b.hasAttribute("disabled"), true, `round ${round}`);
    assert.equal(group.getAttribute("data-disabled"), "true");
    disabled.set(false);
    for (const b of buttons) assert.equal(b.hasAttribute("disabled"), false);
  }
  size.set("lg");
  variant.set("ghost");
  for (const b of buttons) {
    assert.match(b.className, /button--lg/);
    assert.match(b.className, /button--ghost/);
  }
  orientation.set("vertical");
  assert.match(group.className, /button-group--vertical/);
  assert.equal(sep.className, "button-group__separator");
  assert.equal(r.container.firstElementChild, group);
  assert.deepEqual(Array.from(group.querySelectorAll("button")), buttons);
  r.unmount();
});
