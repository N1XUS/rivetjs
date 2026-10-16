// DOM-target suite: `ColorField` + `ColorInputGroup` parts (upstream tests/components/color-field/color-field.test.tsx ported to happy-dom):
// accessible name via Label + hex value, data-slots + BEM block, Group variant modifier, fullWidth, typing a hex value commits on blur,
// controlled value (Rivet: a Signal — two-way — instead of a re-render), single-channel editing (hue), isRequired + FieldError,
// Description, isDisabled, Prefix / Suffix. Rivet: index exports, parts outside a field (ColorInputGroup standalone), live `fullWidth`,
// class merges. Typing = setting the input value + an `input` event, commit = blur (what user-event ends up dispatching). Skipped:
// "focus-visible via keyboard" (`user.tab()` needs real focus navigation).
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { parseColor } = await import("@rivetjs/cdk/color");
const { ColorField, ColorFieldRoot, colorFieldVariants } = await import("../src/components/color-field/index.ts");
const { ColorInputGroup, ColorInputGroupRoot, colorInputGroupVariants } = await import("../src/components/color-input-group/index.ts");
const { Label } = await import("../src/components/label/index.ts");
const { Description } = await import("../src/components/description/index.ts");
const { FieldError } = await import("../src/components/field-error/index.ts");
type Color = import("@rivetjs/cdk/color").Color;

const flush = () => new Promise((r) => setTimeout(r, 20));
const slot = (name: string) => document.querySelector<HTMLElement>(`[data-slot="${name}"]`);
const textbox = () => document.querySelector<HTMLInputElement>("input")!;

const Fixture = (props: Record<string, unknown>) => (
  <ColorField name="color" {...props}>
    <Label>Color</Label>
    <ColorField.Group>
      <ColorField.Input />
    </ColorField.Group>
  </ColorField>
);

async function typeAndBlur(input: HTMLInputElement, text: string) {
  input.focus();
  input.value = text;
  input.dispatchEvent(new InputEvent("input", { data: text, inputType: "insertText", bubbles: true }));
  await flush();
  input.blur();
  await flush();
}

test("color-field: index exports", () => {
  assert.equal(ColorField, ColorFieldRoot);
  assert.equal(ColorField.Root, ColorFieldRoot);
  assert.equal(ColorField.Group, ColorInputGroupRoot);
  assert.equal(ColorInputGroup, ColorInputGroupRoot);
  assert.equal(ColorField.Input, ColorInputGroup.Input);
  assert.equal(ColorField.Prefix, ColorInputGroup.Prefix);
  assert.equal(ColorField.Suffix, ColorInputGroup.Suffix);
  assert.equal(colorFieldVariants(), "color-field");
  assert.equal(colorInputGroupVariants().base(), "color-input-group color-input-group--primary");
});

test("color-field: exposes accessible name via Label", () => {
  const { unmount } = render(() => <Fixture defaultValue={parseColor("#0485F7")} />);
  const label = document.querySelector("label")!;
  assert.equal(label.textContent, "Color");
  assert.ok((textbox().getAttribute("aria-labelledby") ?? "").split(" ").includes(label.id) || label.htmlFor === textbox().id);
  assert.equal(textbox().value, "#0485F7");
  unmount();
});

test("color-field: exposes data-slots and BEM block", () => {
  const { unmount } = render(() => <Fixture />);
  assert.match(slot("color-field")!.className, /\bcolor-field\b/);
  assert.match(slot("color-input-group")!.className, /\bcolor-input-group\b/);
  assert.match(slot("color-input-group-input")!.className, /color-input-group__input/);
  unmount();
});

test("color-field: exposes variant BEM modifier on Group", () => {
  const { unmount } = render(() => (
    <ColorField name="color">
      <Label>Color</Label>
      <ColorField.Group variant="secondary">
        <ColorField.Input />
      </ColorField.Group>
    </ColorField>
  ));
  assert.match(slot("color-input-group")!.className, /color-input-group--secondary/);
  unmount();
});

test("color-field: supports fullWidth prop as a BEM modifier", () => {
  const { unmount } = render(() => <Fixture fullWidth />);
  assert.match(slot("color-field")!.className, /color-field--full-width/);
  unmount();
});

test("color-field: live fullWidth toggles the modifier", async () => {
  const full = signal(false);
  const { unmount } = render(() => <Fixture fullWidth={full()} />);
  assert.doesNotMatch(slot("color-field")!.className, /full-width/);
  full.set(true);
  await flush();
  assert.match(slot("color-field")!.className, /color-field--full-width/);
  unmount();
});

test("color-field: supports typing a hex value and commits it on blur", async () => {
  const calls: (Color | null)[] = [];
  const { unmount } = render(() => <Fixture onChange={(c: Color | null) => calls.push(c)} />);
  await typeAndBlur(textbox(), "#22c55e");
  assert.ok(calls.length > 0);
  assert.equal(calls.at(-1)!.toString("hex").toLowerCase(), "#22c55e");
  unmount();
});

test("color-field: supports controlled value (Signal)", async () => {
  const value = signal<string | Color | null>(parseColor("#0485F7"));
  const { unmount } = render(() => <Fixture value={value} />);
  assert.equal(textbox().value, "#0485F7");
  value.set(parseColor("#EF4444"));
  await flush();
  assert.equal(textbox().value, "#EF4444");
  unmount();
});

test("color-field: supports channel editing for a single HSL channel", async () => {
  const calls: (Color | null)[] = [];
  const { unmount } = render(() => (
    <ColorField channel="hue" colorSpace="hsl" name="hue" value={parseColor("hsl(200, 50%, 50%)")} onChange={(c: Color | null) => calls.push(c)}>
      <Label>Hue</Label>
      <ColorField.Group>
        <ColorField.Input />
      </ColorField.Group>
    </ColorField>
  ));
  assert.equal(textbox().value, "200°");
  await typeAndBlur(textbox(), "90");
  assert.ok(calls.length > 0);
  assert.equal(calls.at(-1)!.getChannelValue("hue"), 90);
  unmount();
});

test("color-field: supports isRequired and shows FieldError when isInvalid", () => {
  const { unmount } = render(() => (
    <ColorField isInvalid isRequired name="color">
      <Label>Color</Label>
      <ColorField.Group>
        <ColorField.Input />
      </ColorField.Group>
      <FieldError>Please enter a valid hex color</FieldError>
    </ColorField>
  ));
  assert.equal(slot("color-field")!.getAttribute("data-required"), "true");
  assert.match(document.body.textContent ?? "", /Please enter a valid hex color/);
  unmount();
});

test("color-field: exposes accessible description via Description", () => {
  const { unmount } = render(() => (
    <ColorField name="color">
      <Label>Color</Label>
      <ColorField.Group>
        <ColorField.Input />
      </ColorField.Group>
      <Description>Enter your brand's primary color</Description>
    </ColorField>
  ));
  assert.ok(slot("description"));
  assert.match(document.body.textContent ?? "", /Enter your brand's primary color/);
  unmount();
});

test("color-field: supports disabled state and blocks typing", async () => {
  const calls: unknown[] = [];
  const { unmount } = render(() => <Fixture defaultValue={parseColor("#0485F7")} isDisabled onChange={(c: unknown) => calls.push(c)} />);
  assert.equal(textbox().disabled, true);
  unmount();
  assert.equal(calls.length, 0);
});

test("color-field: supports prefix and suffix composition data-slots", () => {
  const { unmount } = render(() => (
    <ColorField name="color">
      <Label>Color</Label>
      <ColorField.Group>
        <ColorField.Prefix>
          <span>prefix</span>
        </ColorField.Prefix>
        <ColorField.Input />
        <ColorField.Suffix>
          <span>suffix</span>
        </ColorField.Suffix>
      </ColorField.Group>
    </ColorField>
  ));
  assert.match(slot("color-input-group-prefix")!.className, /color-input-group__prefix/);
  assert.match(slot("color-input-group-suffix")!.className, /color-input-group__suffix/);
  unmount();
});

test("color-field: class merges onto every part", () => {
  const { unmount } = render(() => (
    <ColorField name="color" aria-label="Color" class="w-64">
      <ColorField.Group class="g">
        <ColorField.Input class="i" />
      </ColorField.Group>
    </ColorField>
  ));
  assert.match(slot("color-field")!.className, /\bw-64\b/);
  assert.match(slot("color-input-group")!.className, /\bg\b/);
  assert.match(slot("color-input-group-input")!.className, /\bi\b/);
  unmount();
});

test("color-input-group: parts outside a group render without slot classes", () => {
  const { unmount } = render(() => (
    <ColorInputGroup.Prefix>
      <span>p</span>
    </ColorInputGroup.Prefix>
  ));
  assert.equal(slot("color-input-group-prefix")!.className, "");
  unmount();
});
