// DOM-target suite: `Checkbox`, `CheckboxGroup`, `Radio`, `RadioGroup`, `Switch`, `SwitchGroup` (upstream checkbox / checkbox-group /
// radio / radio-group / switch / switch-group tests ported). A click = the native input's `click()` (happy-dom toggles `checked` and
// fires `change`; upstream user-event click). Keyboard (Space, arrows), focus-visible via Tab and hover run in Chromium
// (`tests-components/toggles.test.ts`).
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

installOverlayDom();

const { render, flush } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { Checkbox, CheckboxRoot, CheckboxContent, CheckboxControl, CheckboxIndicator, checkboxVariants } = await import("../src/components/checkbox/index.ts");
const { CheckboxGroup, checkboxGroupVariants } = await import("../src/components/checkbox-group/index.ts");
const { Radio, RadioRoot, radioVariants } = await import("../src/components/radio/index.ts");
const { RadioGroup, RadioGroupRoot, radioGroupVariants } = await import("../src/components/radio-group/index.ts");
const { Switch, SwitchRoot, switchVariants } = await import("../src/components/switch/index.ts");
const { SwitchGroup, SwitchGroupRoot, switchGroupVariants } = await import("../src/components/switch-group/index.ts");
const { Label } = await import("../src/components/label/index.ts");
const { Description } = await import("../src/components/description/index.ts");
const { FieldError } = await import("../src/components/field-error/index.ts");

const q = (root: ParentNode, sel: string) => root.querySelector(sel) as HTMLElement;
const qa = (root: ParentNode, sel: string) => [...root.querySelectorAll(sel)] as HTMLElement[];
const inputs = (root: ParentNode) => qa(root, "input") as HTMLInputElement[];
const click = async (el: HTMLInputElement) => {
  el.click();
  await flush();
};
/** Accessible name of an input inside a `<label>`: the label's text. */
const nameOf = (el: HTMLElement) => (el.closest("label")?.textContent ?? "").trim();

/* ------------------------------------------------------------------ index */

test("index: compound parts, named exports, variants", () => {
  assert.equal(Checkbox, CheckboxRoot);
  assert.equal(Checkbox.Root, CheckboxRoot);
  assert.equal(Checkbox.Content, CheckboxContent);
  assert.equal(Checkbox.Control, CheckboxControl);
  assert.equal(Checkbox.Indicator, CheckboxIndicator);
  assert.equal(Radio, RadioRoot);
  for (const k of ["Root", "Content", "Control", "Indicator"] as const) assert.equal(typeof Radio[k], "function");
  assert.equal(RadioGroup, RadioGroupRoot);
  assert.equal(Switch, SwitchRoot);
  for (const k of ["Root", "Content", "Control", "Thumb", "Icon"] as const) assert.equal(typeof Switch[k], "function");
  assert.equal(SwitchGroup, SwitchGroupRoot);
  for (const v of [checkboxVariants, checkboxGroupVariants, radioVariants, radioGroupVariants, switchVariants, switchGroupVariants])
    assert.equal(typeof v, "function");
});

/* ------------------------------------------------------------------ Checkbox */

const renderCheckbox = (props: Record<string, unknown> = {}) =>
  render(() => (
    <Checkbox {...props}>
      <Checkbox.Content>
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
        <Label>Accept terms</Label>
      </Checkbox.Content>
    </Checkbox>
  ));

test("checkbox upstream: renders with role and accessible name", () => {
  const r = renderCheckbox();
  const [input] = inputs(r.container);
  assert.equal(input.type, "checkbox");
  assert.equal(nameOf(input), "Accept terms");
  r.unmount();
});

test("checkbox upstream: exposes BEM block and composed data-slots", () => {
  const r = renderCheckbox();
  const slots = checkboxVariants({});
  assert.equal(q(r.container, '[data-slot="checkbox"]').className, slots.base());
  assert.equal(q(r.container, '[data-slot="checkbox-content"]').className, slots.content());
  assert.equal(q(r.container, '[data-slot="checkbox-control"]').className, slots.control());
  assert.equal(q(r.container, '[data-slot="checkbox-indicator"]').className, slots.indicator());
  assert.equal(q(r.container, '[data-slot="checkbox-indicator"]').getAttribute("aria-hidden"), "true");
  r.unmount();
});

test("checkbox upstream: renders a nested Label as a span so the content label has no descendant label", () => {
  const r = renderCheckbox();
  const content = q(r.container, '[data-slot="checkbox-content"]');
  const label = qa(r.container, "*").find((el) => el.textContent === "Accept terms" && el.children.length === 0)!;
  assert.equal(label.tagName, "SPAN");
  assert.equal(content.tagName, "LABEL");
  assert.equal(content.querySelector("label"), null);
  r.unmount();
});

test("checkbox upstream: supports data attribute passthrough on the field", () => {
  const r = render(() => (
    <Checkbox data-testid="terms">
      <Checkbox.Content>
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
        Accept terms
      </Checkbox.Content>
    </Checkbox>
  ));
  assert.equal(q(r.container, '[data-testid="terms"]').getAttribute("data-slot"), "checkbox");
  r.unmount();
});

test("checkbox upstream: calls onChange when selection is toggled", async () => {
  const calls: boolean[] = [];
  const r = renderCheckbox({ onChange: (v: boolean) => calls.push(v) });
  const [input] = inputs(r.container);
  await click(input);
  assert.equal(input.checked, true);
  assert.deepEqual(calls, [true]);
  await click(input);
  assert.equal(input.checked, false);
  assert.deepEqual(calls, [true, false]);
  r.unmount();
});

test("checkbox upstream: supports controlled isSelected (two-way Signal / live boolean)", async () => {
  const calls: boolean[] = [];
  const selected = signal(false);
  const r = render(() => (
    <Checkbox isSelected={selected()} onChange={(v: boolean) => calls.push(v)}>
      <Checkbox.Content>
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
        <Label>Accept terms</Label>
      </Checkbox.Content>
    </Checkbox>
  ));
  const [input] = inputs(r.container);
  assert.equal(input.checked, false);
  await click(input);
  assert.deepEqual(calls, [true]);
  assert.equal(input.checked, false, "controlled: owner did not update");
  selected.set(true);
  await flush();
  assert.equal(input.checked, true);
  assert.equal(q(r.container, '[data-slot="checkbox"]').getAttribute("data-selected"), "true");
  r.unmount();

  const two = signal(false);
  const r2 = renderCheckbox({ isSelected: two });
  await click(inputs(r2.container)[0]);
  assert.equal(two(), true);
  r2.unmount();
});

test("checkbox upstream: exposes data-selected when selected", async () => {
  const r = renderCheckbox();
  await click(inputs(r.container)[0]);
  assert.equal(q(r.container, '[data-slot="checkbox"]').getAttribute("data-selected"), "true");
  r.unmount();
});

test("checkbox upstream: supports indeterminate state (+ default dash indicator)", () => {
  const r = renderCheckbox({ isIndeterminate: true });
  const [input] = inputs(r.container);
  assert.equal(input.indeterminate, true);
  assert.equal(q(r.container, '[data-slot="checkbox"]').getAttribute("data-indeterminate"), "true");
  assert.ok(q(r.container, '[data-slot="checkbox-default-indicator--indeterminate"]'));
  assert.equal(q(r.container, '[data-slot="checkbox-default-indicator--checkmark"]'), null);
  r.unmount();
});

test("checkbox upstream: supports disabled state and blocks interaction", async () => {
  const calls: boolean[] = [];
  const r = renderCheckbox({ isDisabled: true, onChange: (v: boolean) => calls.push(v) });
  const [input] = inputs(r.container);
  assert.equal(input.disabled, true);
  assert.equal(q(r.container, '[data-slot="checkbox"]').getAttribute("data-disabled"), "true");
  await click(input);
  assert.deepEqual(calls, []);
  assert.equal(input.checked, false);
  r.unmount();
});

test("checkbox: default checkmark draws on selection (stroke-dashoffset 72 → 48)", async () => {
  const r = renderCheckbox();
  const mark = () => q(r.container, '[data-slot="checkbox-default-indicator--checkmark"]');
  assert.ok(mark());
  assert.equal(mark().getAttribute("stroke-dasharray"), "24");
  assert.equal(mark().getAttribute("stroke-dashoffset"), "72");
  await click(inputs(r.container)[0]);
  assert.equal(mark().getAttribute("stroke-dashoffset"), "48");
  r.unmount();
});

test("checkbox: function children get the state; custom indicator children replace the default", async () => {
  const r = render(() => (
    <Checkbox>
      {(state: { isSelected: () => boolean }) => (
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator>{(s: { isSelected: () => boolean }) => <b id="ind">{s.isSelected() ? "on" : "off"}</b>}</Checkbox.Indicator>
          </Checkbox.Control>
          <span id="root-state">{state.isSelected() ? "yes" : "no"}</span>
        </Checkbox.Content>
      )}
    </Checkbox>
  ));
  assert.equal(q(r.container, "#ind").textContent, "off");
  assert.equal(q(r.container, "#root-state").textContent, "no");
  await click(inputs(r.container)[0]);
  assert.equal(q(r.container, "#ind").textContent, "on");
  assert.equal(q(r.container, "#root-state").textContent, "yes");
  assert.equal(q(r.container, '[data-slot="checkbox-default-indicator--checkmark"]'), null);
  r.unmount();
});

test("checkbox: variant + class per part; live variant updates in place", async () => {
  const variant = signal<"primary" | "secondary">("secondary");
  const r = render(() => (
    <Checkbox class="my-cb" variant={variant()}>
      <Checkbox.Content class="my-content">
        <Checkbox.Control class="my-control">
          <Checkbox.Indicator class="my-ind" />
        </Checkbox.Control>
        Terms
      </Checkbox.Content>
    </Checkbox>
  ));
  const root = q(r.container, '[data-slot="checkbox"]');
  assert.equal(root.className, checkboxVariants({ variant: "secondary" }).base({ className: "my-cb" }));
  assert.match(q(r.container, '[data-slot="checkbox-content"]').className, /\bcheckbox__content\b.*\bmy-content\b/);
  assert.match(q(r.container, '[data-slot="checkbox-control"]').className, /\bcheckbox__control\b.*\bmy-control\b/);
  assert.match(q(r.container, '[data-slot="checkbox-indicator"]').className, /\bcheckbox__indicator\b.*\bmy-ind\b/);
  variant.set("primary");
  await flush();
  assert.equal(q(r.container, '[data-slot="checkbox"]'), root, "root kept");
  assert.equal(root.className, checkboxVariants({ variant: "primary" }).base({ className: "my-cb" }));
  r.unmount();
});

test("checkbox: parts outside a Checkbox render without slot classes", () => {
  const r = render(() => (
    <div>
      <Checkbox.Control class="c" />
      <Checkbox.Indicator class="i">x</Checkbox.Indicator>
    </div>
  ));
  assert.equal(q(r.container, '[data-slot="checkbox-control"]').className, "c");
  assert.equal(q(r.container, '[data-slot="checkbox-indicator"]').className, "i");
  r.unmount();
});

/* ------------------------------------------------------------------ CheckboxGroup */

const renderInterests = (props: Record<string, unknown> = {}) =>
  render(() => (
    <CheckboxGroup data-testid="interests" name="interests" {...props}>
      <Label>Select your interests</Label>
      <Description>Choose all that apply</Description>
      <Checkbox value="coding">
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          Coding
        </Checkbox.Content>
      </Checkbox>
      <Checkbox value="design">
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          Design
        </Checkbox.Content>
      </Checkbox>
      {props.isInvalid ? <FieldError>Pick at least one</FieldError> : null}
    </CheckboxGroup>
  ));

test("checkbox-group upstream: exposes group role, BEM, and data-slot", () => {
  const r = renderInterests();
  const group = q(r.container, '[role="group"]');
  assert.equal(group.getAttribute("data-slot"), "checkbox-group");
  assert.equal(group.className, checkboxGroupVariants({}));
  const labelId = group.getAttribute("aria-labelledby")!;
  assert.equal(r.container.querySelector(`[id="${labelId}"]`)!.textContent, "Select your interests");
  assert.deepEqual(inputs(r.container).map(nameOf), ["Coding", "Design"]);
  assert.ok(qa(r.container, '[data-slot="description"]').some((d) => d.textContent === "Choose all that apply"));
  r.unmount();
});

test("checkbox-group upstream: keeps item Label ids from colliding with the group Label id", () => {
  const r = render(() => (
    <CheckboxGroup name="interests">
      <Label>Select your interests</Label>
      <Checkbox value="coding">
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          <Label>Coding</Label>
        </Checkbox.Content>
      </Checkbox>
      <Checkbox value="design">
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          <Label>Design</Label>
        </Checkbox.Content>
      </Checkbox>
    </CheckboxGroup>
  ));
  const labels = qa(r.container, '[data-slot="label"]');
  const groupLabelId = labels.find((l) => l.textContent === "Select your interests")!.id;
  assert.ok(groupLabelId);
  for (const t of ["Coding", "Design"]) assert.notEqual(labels.find((l) => l.textContent === t)!.id, groupLabelId);
  assert.equal(q(r.container, '[role="group"]').getAttribute("aria-labelledby"), groupLabelId);
  r.unmount();
});

test("checkbox-group upstream: exposes variant BEM modifier (+ items inherit it)", () => {
  const r = renderInterests({ variant: "secondary" });
  assert.match(q(r.container, '[data-testid="interests"]').className, /\bcheckbox-group--secondary\b/);
  for (const cb of qa(r.container, '[data-slot="checkbox"]')) assert.equal(cb.className, checkboxVariants({ variant: "secondary" }).base());
  r.unmount();
});

test("checkbox-group upstream: calls onChange when selection is toggled", async () => {
  const calls: string[][] = [];
  const r = renderInterests({ onChange: (v: string[]) => calls.push(v) });
  const [coding, design] = inputs(r.container);
  assert.equal(inputs(r.container).length, 2);
  await click(coding);
  assert.deepEqual(calls.at(-1), ["coding"]);
  assert.equal(inputs(r.container).filter((i) => i.checked).length, 1);
  await click(design);
  assert.deepEqual(calls.at(-1), ["coding", "design"]);
  assert.equal(inputs(r.container).filter((i) => i.checked).length, 2);
  assert.deepEqual(
    inputs(r.container).map((i) => i.name),
    ["interests", "interests"],
  );
  r.unmount();
});

test("checkbox-group upstream: supports group disabled state", async () => {
  const calls: string[][] = [];
  const r = renderInterests({ isDisabled: true, onChange: (v: string[]) => calls.push(v) });
  assert.equal(q(r.container, '[data-testid="interests"]').getAttribute("data-disabled"), "true");
  const [coding] = inputs(r.container);
  assert.equal(coding.disabled, true);
  await click(coding);
  assert.deepEqual(calls, []);
  r.unmount();
});

test("checkbox-group upstream: renders FieldError when invalid", async () => {
  const r = renderInterests({ isInvalid: true });
  await flush();
  assert.equal(q(r.container, '[data-slot="field-error"]').textContent, "Pick at least one");
  assert.equal(q(r.container, '[data-testid="interests"]').getAttribute("data-invalid"), "true");
  r.unmount();
});

test("checkbox-group: two-way value Signal + live variant reaches the items in place", async () => {
  const value = signal<string[]>(["design"]);
  const variant = signal<"primary" | "secondary">("primary");
  const r = renderInterests({
    value,
    get variant() {
      return variant();
    },
  });
  const [coding, design] = inputs(r.container);
  assert.equal(design.checked, true);
  await click(coding);
  assert.deepEqual(value(), ["design", "coding"]);
  const first = q(r.container, '[data-slot="checkbox"]');
  variant.set("secondary");
  await flush();
  assert.equal(q(r.container, '[data-slot="checkbox"]'), first, "item kept");
  assert.equal(first.className, checkboxVariants({ variant: "secondary" }).base());
  assert.match(q(r.container, '[data-testid="interests"]').className, /\bcheckbox-group--secondary\b/);
  r.unmount();
});

/* ------------------------------------------------------------------ Radio + RadioGroup */

const renderPlan = (props: Record<string, unknown> = {}, disabledValue?: string) =>
  render(() => (
    <RadioGroup data-testid="plan" name="plan" {...props}>
      <Label>Plan</Label>
      <Description>Choose one plan</Description>
      <Radio isDisabled={disabledValue === "a"} value="a">
        <Radio.Content>
          <Radio.Control>
            <Radio.Indicator />
          </Radio.Control>
          Basic
        </Radio.Content>
      </Radio>
      <Radio isDisabled={disabledValue === "b"} value="b">
        <Radio.Content>
          <Radio.Control>
            <Radio.Indicator />
          </Radio.Control>
          Premium
        </Radio.Content>
      </Radio>
      {props.isInvalid ? <FieldError>Select a plan</FieldError> : null}
    </RadioGroup>
  ));

test("radio upstream: renders radiogroup and radio roles with accessible names", () => {
  const r = renderPlan({ defaultValue: "a" });
  const group = q(r.container, '[role="radiogroup"]');
  assert.equal(r.container.querySelector(`[id="${group.getAttribute("aria-labelledby")}"]`)!.textContent, "Plan");
  const [basic, premium] = inputs(r.container);
  assert.equal(basic.type, "radio");
  assert.deepEqual([nameOf(basic), nameOf(premium)], ["Basic", "Premium"]);
  assert.equal(basic.checked, true);
  assert.equal(premium.checked, false);
  r.unmount();
});

test("radio upstream: exposes BEM block and composed data-slots", () => {
  const r = renderPlan({ defaultValue: "a" });
  const slots = radioVariants();
  assert.equal(q(r.container, '[data-slot="radio"]').className, slots.base());
  assert.equal(q(r.container, '[data-slot="radio-content"]').className, slots.content());
  assert.equal(q(r.container, '[data-slot="radio-control"]').className, slots.control());
  assert.equal(q(r.container, '[data-slot="radio-indicator"]').className, slots.indicator());
  r.unmount();
});

test("radio upstream: calls onChange when a radio is selected (+ data-selected)", async () => {
  const calls: string[] = [];
  const r = renderPlan({ defaultValue: "a", onChange: (v: string) => calls.push(v) });
  const [basic, premium] = inputs(r.container);
  await click(premium);
  assert.equal(premium.checked, true);
  assert.equal(basic.checked, false);
  assert.deepEqual(calls, ["b"]);
  assert.equal(premium.closest('[data-slot="radio"]')!.getAttribute("data-selected"), "true");
  assert.equal(basic.closest('[data-slot="radio"]')!.hasAttribute("data-selected"), false);
  r.unmount();
});

test("radio upstream: supports disabled radio without selecting", async () => {
  const calls: string[] = [];
  const r = renderPlan({ defaultValue: "a", onChange: (v: string) => calls.push(v) }, "b");
  const [basic, premium] = inputs(r.container);
  assert.equal(premium.disabled, true);
  assert.equal(premium.closest('[data-slot="radio"]')!.getAttribute("data-disabled"), "true");
  await click(premium);
  assert.deepEqual(calls, []);
  assert.equal(basic.checked, true);
  r.unmount();
});

test("radio-group upstream: exposes radiogroup role, BEM, and data-slot", () => {
  const r = renderPlan({ defaultValue: "a" });
  const group = q(r.container, '[role="radiogroup"]');
  assert.equal(group.getAttribute("data-slot"), "radio-group");
  assert.equal(group.className, radioGroupVariants({}));
  assert.ok(qa(r.container, '[data-slot="description"]').some((d) => d.textContent === "Choose one plan"));
  r.unmount();
});

test("radio-group upstream: exposes variant BEM modifier", () => {
  const r = renderPlan({ variant: "secondary" });
  assert.match(q(r.container, '[data-testid="plan"]').className, /\bradio-group--secondary\b/);
  r.unmount();
});

test("radio-group upstream: keeps item Label ids from colliding with the group Label id", () => {
  const r = render(() => (
    <RadioGroup name="plan">
      <Label>Plan</Label>
      <Radio value="a">
        <Radio.Content>
          <Radio.Control>
            <Radio.Indicator />
          </Radio.Control>
          <Label>Basic</Label>
        </Radio.Content>
      </Radio>
      <Radio value="b">
        <Radio.Content>
          <Radio.Control>
            <Radio.Indicator />
          </Radio.Control>
          <Label>Premium</Label>
        </Radio.Content>
      </Radio>
    </RadioGroup>
  ));
  const labels = qa(r.container, '[data-slot="label"]');
  const groupLabelId = labels.find((l) => l.textContent === "Plan")!.id;
  assert.ok(groupLabelId);
  for (const t of ["Basic", "Premium"]) assert.notEqual(labels.find((l) => l.textContent === t)!.id, groupLabelId);
  assert.equal(q(r.container, '[role="radiogroup"]').getAttribute("aria-labelledby"), groupLabelId);
  r.unmount();
});

test("radio-group upstream: supports selection (tester: radios, selected radio, trigger)", async () => {
  const calls: string[] = [];
  const r = renderPlan({ defaultValue: "a", onChange: (v: string) => calls.push(v) });
  const radios = inputs(r.container);
  assert.equal(radios.length, 2);
  assert.equal(
    radios.find((i) => i.checked),
    radios[0],
  );
  await click(radios[1]);
  assert.deepEqual(calls, ["b"]);
  assert.equal(
    inputs(r.container).find((i) => i.checked),
    radios[1],
  );
  r.unmount();
});

test("radio-group upstream: supports group disabled state", async () => {
  const calls: string[] = [];
  const r = renderPlan({ defaultValue: "a", isDisabled: true, onChange: (v: string) => calls.push(v) });
  assert.equal(q(r.container, '[data-testid="plan"]').getAttribute("data-disabled"), "true");
  const [basic, premium] = inputs(r.container);
  assert.equal(basic.disabled, true);
  await click(premium);
  assert.deepEqual(calls, []);
  r.unmount();
});

test("radio-group upstream: renders FieldError when invalid", async () => {
  const r = renderPlan({ isInvalid: true });
  await flush();
  assert.equal(q(r.container, '[data-slot="field-error"]').textContent, "Select a plan");
  assert.equal(q(r.container, '[data-testid="plan"]').getAttribute("data-invalid"), "true");
  r.unmount();
});

test("radio-group: two-way value Signal; indicator function child gets the radio state", async () => {
  const value = signal<string | null>("b");
  const r = render(() => (
    <RadioGroup aria-label="Plan" value={value}>
      <Radio value="a">
        <Radio.Content>
          <Radio.Control>
            <Radio.Indicator>{(s: { isSelected: () => boolean }) => <i class="dot">{s.isSelected() ? "x" : ""}</i>}</Radio.Indicator>
          </Radio.Control>
          A
        </Radio.Content>
      </Radio>
      <Radio value="b">
        <Radio.Content>
          <Radio.Control>
            <Radio.Indicator />
          </Radio.Control>
          B
        </Radio.Content>
      </Radio>
    </RadioGroup>
  ));
  const [a, b] = inputs(r.container);
  assert.equal(b.checked, true);
  assert.equal(q(r.container, ".dot").textContent, "");
  await click(a);
  assert.equal(value(), "a");
  assert.equal(q(r.container, ".dot").textContent, "x");
  value.set("b");
  await flush();
  assert.equal(b.checked, true);
  assert.equal(q(r.container, ".dot").textContent, "");
  r.unmount();
});

/* ------------------------------------------------------------------ Switch + SwitchGroup */

const renderSwitch = (props: Record<string, unknown> = {}) =>
  render(() => (
    <Switch {...props}>
      <Switch.Content>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <Label>Enable notifications</Label>
      </Switch.Content>
    </Switch>
  ));

test("switch upstream: renders with role and accessible name", () => {
  const r = renderSwitch();
  const [input] = inputs(r.container);
  assert.equal(input.getAttribute("role"), "switch");
  assert.equal(nameOf(input), "Enable notifications");
  r.unmount();
});

test("switch upstream: exposes BEM block and composed data-slots", () => {
  const r = renderSwitch();
  const slots = switchVariants({});
  assert.equal(q(r.container, '[data-slot="switch"]').className, slots.base());
  assert.equal(q(r.container, '[data-slot="switch-content"]').className, slots.content());
  assert.equal(q(r.container, '[data-slot="switch-control"]').className, slots.control());
  assert.equal(q(r.container, '[data-slot="switch-thumb"]').className, slots.thumb());
  r.unmount();
});

test("switch upstream: renders a nested Label as a span so the content label has no descendant label", () => {
  const r = renderSwitch();
  const content = q(r.container, '[data-slot="switch-content"]');
  assert.equal(q(r.container, '[data-slot="label"]').tagName, "SPAN");
  assert.equal(content.tagName, "LABEL");
  assert.equal(content.querySelector("label"), null);
  r.unmount();
});

test("switch upstream: supports data attribute passthrough on the field", () => {
  const r = render(() => (
    <Switch data-testid="notifications">
      <Switch.Content>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        Enable notifications
      </Switch.Content>
    </Switch>
  ));
  assert.equal(q(r.container, '[data-testid="notifications"]').getAttribute("data-slot"), "switch");
  r.unmount();
});

test("switch upstream: calls onChange when selection is toggled (+ data-selected)", async () => {
  const calls: boolean[] = [];
  const r = renderSwitch({ onChange: (v: boolean) => calls.push(v) });
  const [input] = inputs(r.container);
  await click(input);
  assert.equal(input.checked, true);
  assert.deepEqual(calls, [true]);
  assert.equal(q(r.container, '[data-slot="switch"]').getAttribute("data-selected"), "true");
  await click(input);
  assert.equal(input.checked, false);
  assert.deepEqual(calls, [true, false]);
  r.unmount();
});

test("switch upstream: supports controlled isSelected", async () => {
  const calls: boolean[] = [];
  const selected = signal(false);
  const r = render(() => (
    <Switch isSelected={selected()} onChange={(v: boolean) => calls.push(v)}>
      <Switch.Content>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <Label>Enable notifications</Label>
      </Switch.Content>
    </Switch>
  ));
  const [input] = inputs(r.container);
  await click(input);
  assert.deepEqual(calls, [true]);
  assert.equal(input.checked, false);
  selected.set(true);
  await flush();
  assert.equal(input.checked, true);
  r.unmount();
});

test("switch upstream: supports disabled state and blocks interaction", async () => {
  const calls: boolean[] = [];
  const r = renderSwitch({ isDisabled: true, onChange: (v: boolean) => calls.push(v) });
  const [input] = inputs(r.container);
  assert.equal(input.disabled, true);
  assert.equal(q(r.container, '[data-slot="switch"]').getAttribute("data-disabled"), "true");
  await click(input);
  assert.deepEqual(calls, []);
  r.unmount();
});

test("switch: size modifier + Icon part; live size updates in place", async () => {
  const size = signal<"sm" | "md" | "lg">("sm");
  const r = render(() => (
    <Switch size={size()}>
      <Switch.Content>
        <Switch.Control>
          <Switch.Thumb>
            <Switch.Icon>
              <i id="icon" />
            </Switch.Icon>
          </Switch.Thumb>
        </Switch.Control>
        Dark mode
      </Switch.Content>
    </Switch>
  ));
  const root = q(r.container, '[data-slot="switch"]');
  assert.equal(root.className, switchVariants({ size: "sm" }).base());
  assert.equal(q(r.container, '[data-slot="switch-icon"]').className, switchVariants({ size: "sm" }).icon());
  assert.ok(q(r.container, "#icon"));
  size.set("lg");
  await flush();
  assert.equal(q(r.container, '[data-slot="switch"]'), root);
  assert.equal(root.className, switchVariants({ size: "lg" }).base());
  r.unmount();
});

const groupedSwitch = (label: string) => (
  <Switch>
    <Switch.Content>
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
      <Label>{label}</Label>
    </Switch.Content>
  </Switch>
);

test("switch-group upstream: exposes data-slot and BEM block (vertical by default)", () => {
  const r = render(() => <SwitchGroup>{groupedSwitch("Wifi")}</SwitchGroup>);
  const group = q(r.container, '[data-slot="switch-group"]');
  assert.equal(group.className, switchGroupVariants({}).base());
  assert.match(group.className, /\bswitch-group--vertical\b/);
  assert.equal(q(r.container, '[data-slot="switch-group-items"]').className, switchGroupVariants({}).items());
  r.unmount();
});

test("switch-group upstream: exposes horizontal orientation BEM", () => {
  const r = render(() => <SwitchGroup orientation="horizontal">{groupedSwitch("Wifi")}</SwitchGroup>);
  assert.match(q(r.container, '[data-slot="switch-group"]').className, /\bswitch-group--horizontal\b/);
  r.unmount();
});

test("switch-group upstream: renders children switches; independent toggles", async () => {
  const r = render(() => (
    <SwitchGroup>
      {groupedSwitch("Wifi")}
      {groupedSwitch("Bluetooth")}
    </SwitchGroup>
  ));
  const [wifi, bluetooth] = inputs(r.container);
  assert.deepEqual([nameOf(wifi), nameOf(bluetooth)], ["Wifi", "Bluetooth"]);
  for (const i of [wifi, bluetooth]) assert.equal(i.getAttribute("role"), "switch");
  await click(wifi);
  assert.equal(wifi.checked, true);
  assert.equal(bluetooth.checked, false);
  r.unmount();
});

/* ------------------------------------------------------------------ live items (T21 review) */

test("radio-group items: append / remove / reorder / edit after mount, unchanged rows keep their DOM nodes", async () => {
  type Item = { value: string; label: string };
  const items = signal<Item[]>([
    { value: "a", label: "A" },
    { value: "b", label: "B" },
  ]);
  const r = render(() => <RadioGroup aria-label="Live" items={items()} />);
  const radio = (v: string) => q(r.container, `input[value="${v}"]`).closest('[data-slot="radio"]') as HTMLElement;
  const order = () => inputs(r.container).map((i) => i.value);
  const a = radio("a");
  const b = radio("b");
  assert.deepEqual(order(), ["a", "b"]);

  items.set([...items(), { value: "c", label: "C" }]);
  await flush();
  assert.deepEqual(order(), ["a", "b", "c"]);
  assert.equal(radio("a"), a);
  assert.equal(radio("b"), b);

  items.set(items().filter((i) => i.value !== "b"));
  await flush();
  assert.deepEqual(order(), ["a", "c"]);
  assert.equal(radio("a"), a);

  const c = radio("c");
  items.set([...items()].reverse());
  await flush();
  assert.deepEqual(order(), ["c", "a"]);
  assert.equal(radio("a"), a, "reorder moves the nodes");
  assert.equal(radio("c"), c);

  items.set(items().map((i) => (i.value === "a" ? { ...i, label: "Alpha" } : i)));
  await flush();
  assert.equal(nameOf(q(r.container, 'input[value="a"]')), "Alpha");
  assert.equal(radio("a"), a, "an edit updates the row in place");
  r.unmount();
});
