// DOM-target suite: `CheckboxButtonGroup` (Rivet addition; feature set inspired by HeroUI Pro's public docs, independent
// implementation) on happy-dom: compound statics + variants, clicking cards toggles them (two-way string[] signal + onChange),
// a signal write updates the selection, function children follow the item state, disabled item ignores clicks, live layout.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const mod = await import("../src/components/checkbox-button-group/index.ts");
const {
  CheckboxButtonGroup,
  CheckboxButtonGroupRoot,
  CheckboxButtonGroupItem,
  CheckboxButtonGroupIndicator,
  CheckboxButtonGroupItemContent,
  CheckboxButtonGroupItemIcon,
} = mod;
const variants = mod.checkboxButtonGroupVariants;

const flush = () => new Promise((r) => setTimeout(r, 0));
const cards = (root: ParentNode) => Array.from(root.querySelectorAll<HTMLLabelElement>("[data-slot=checkbox-button-group-item]"));
const inputs = (root: ParentNode) => Array.from(root.querySelectorAll<HTMLInputElement>("input"));

test("checkbox-button-group: compound statics + variants", () => {
  assert.equal(CheckboxButtonGroup, CheckboxButtonGroupRoot);
  assert.equal(CheckboxButtonGroup.Root, CheckboxButtonGroupRoot);
  assert.equal(CheckboxButtonGroup.Item, CheckboxButtonGroupItem);
  assert.equal(CheckboxButtonGroup.Indicator, CheckboxButtonGroupIndicator);
  assert.equal(CheckboxButtonGroup.ItemContent, CheckboxButtonGroupItemContent);
  assert.equal(CheckboxButtonGroup.ItemIcon, CheckboxButtonGroupItemIcon);
  assert.equal(variants().base(), "checkbox-button-group checkbox-button-group--flex");
  assert.equal(variants({ layout: "grid" }).base(), "checkbox-button-group checkbox-button-group--grid");
});

test("checkbox-button-group: clicks toggle (signal + onChange), signal write updates, function children", async () => {
  const value = signal<string[]>(["a"]);
  const calls: unknown[] = [];
  const r = render(() => (
    <CheckboxButtonGroup aria-label="Pick" value={value} onChange={(v: unknown) => calls.push(v)}>
      <CheckboxButtonGroup.Item value="a">A</CheckboxButtonGroup.Item>
      <CheckboxButtonGroup.Item value="b">{({ isSelected }) => <span>{isSelected() ? "B on" : "B off"}</span>}</CheckboxButtonGroup.Item>
      <CheckboxButtonGroup.Item value="c" isDisabled>
        C
      </CheckboxButtonGroup.Item>
    </CheckboxButtonGroup>
  ));
  const [a, b, c] = cards(r.container);
  assert.equal(inputs(r.container)[0]!.checked, true);
  assert.equal(b!.textContent, "B off");
  inputs(r.container)[1]!.click();
  await flush();
  assert.deepEqual(value(), ["a", "b"]);
  assert.deepEqual(calls, [["a", "b"]]);
  assert.equal(b!.getAttribute("data-selected"), "true");
  assert.equal(b!.textContent, "B on");
  inputs(r.container)[0]!.click();
  await flush();
  assert.deepEqual(value(), ["b"]);
  assert.equal(a!.getAttribute("data-selected"), null);
  value.set(["a"]);
  await flush();
  assert.equal(b!.getAttribute("data-selected"), null);
  assert.equal(inputs(r.container)[0]!.checked, true);
  assert.equal(c!.getAttribute("data-disabled"), "true");
  assert.equal(inputs(r.container)[2]!.disabled, true);
  r.unmount();
});

test("checkbox-button-group: live layout restyles in place", async () => {
  const layout = signal<"flex" | "grid">("flex");
  const r = render(() => (
    <CheckboxButtonGroup aria-label="L" layout={layout()}>
      <CheckboxButtonGroup.Item value="a">A</CheckboxButtonGroup.Item>
    </CheckboxButtonGroup>
  ));
  const root = r.container.querySelector("[data-slot=checkbox-button-group]")!;
  assert.match(root.className, /--flex/);
  layout.set("grid");
  await flush();
  assert.match(root.className, /--grid/);
  r.unmount();
});
