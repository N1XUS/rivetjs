// DOM-target suite: `RadioButtonGroup` (Rivet addition; feature set inspired by HeroUI Pro's public docs, independent
// implementation) on happy-dom: compound statics + variants, clicking a card selects it (two-way value signal + onChange), a
// signal write moves the selection, function children follow the item state, disabled item ignores clicks, live layout.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const mod = await import("../src/components/radio-button-group/index.ts");
const { RadioButtonGroup, RadioButtonGroupRoot, RadioButtonGroupItem, RadioButtonGroupIndicator, RadioButtonGroupItemContent, RadioButtonGroupItemIcon } = mod;
const variants = mod.radioButtonGroupVariants;

const flush = () => new Promise((r) => setTimeout(r, 0));
const cards = (root: ParentNode) => Array.from(root.querySelectorAll<HTMLLabelElement>("[data-slot=radio-button-group-item]"));
const inputs = (root: ParentNode) => Array.from(root.querySelectorAll<HTMLInputElement>("input"));

test("radio-button-group: compound statics + variants", () => {
  assert.equal(RadioButtonGroup, RadioButtonGroupRoot);
  assert.equal(RadioButtonGroup.Root, RadioButtonGroupRoot);
  assert.equal(RadioButtonGroup.Item, RadioButtonGroupItem);
  assert.equal(RadioButtonGroup.Indicator, RadioButtonGroupIndicator);
  assert.equal(RadioButtonGroup.ItemContent, RadioButtonGroupItemContent);
  assert.equal(RadioButtonGroup.ItemIcon, RadioButtonGroupItemIcon);
  assert.equal(variants().base(), "radio-button-group radio-button-group--flex");
  assert.equal(variants({ layout: "grid" }).base(), "radio-button-group radio-button-group--grid");
});

test("radio-button-group: click selects (signal + onChange), signal write moves the selection, function children", async () => {
  const value = signal<string | null>("a");
  const calls: unknown[] = [];
  const r = render(() => (
    <RadioButtonGroup aria-label="Pick" value={value} onChange={(v: unknown) => calls.push(v)}>
      <RadioButtonGroup.Item value="a">A</RadioButtonGroup.Item>
      <RadioButtonGroup.Item value="b">{({ isSelected }) => <span>{isSelected() ? "B on" : "B off"}</span>}</RadioButtonGroup.Item>
      <RadioButtonGroup.Item value="c" isDisabled>
        C
      </RadioButtonGroup.Item>
    </RadioButtonGroup>
  ));
  const [, b, c] = cards(r.container);
  assert.equal(inputs(r.container)[0]!.checked, true);
  assert.equal(b!.textContent, "B off");
  inputs(r.container)[1]!.click();
  await flush();
  assert.equal(value(), "b");
  assert.deepEqual(calls, ["b"]);
  assert.equal(b!.getAttribute("data-selected"), "true");
  assert.equal(b!.textContent, "B on");
  value.set("a");
  await flush();
  assert.equal(b!.getAttribute("data-selected"), null);
  assert.equal(inputs(r.container)[0]!.checked, true);
  assert.equal(c!.getAttribute("data-disabled"), "true");
  assert.equal(inputs(r.container)[2]!.disabled, true);
  r.unmount();
});

test("radio-button-group: live layout restyles in place", async () => {
  const layout = signal<"flex" | "grid">("flex");
  const r = render(() => (
    <RadioButtonGroup aria-label="L" layout={layout()}>
      <RadioButtonGroup.Item value="a">A</RadioButtonGroup.Item>
    </RadioButtonGroup>
  ));
  const root = r.container.querySelector("[data-slot=radio-button-group]")!;
  assert.match(root.className, /--flex/);
  layout.set("grid");
  await flush();
  assert.match(root.className, /--grid/);
  r.unmount();
});
