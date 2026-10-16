// DOM-target suite: `DisclosureGroup` (upstream tests/components/disclosure-group/disclosure-group.test.tsx ported to
// happy-dom): data-slot + BEM block; a trigger per Disclosure; single expanded item by default; multiple with
// `allowsMultipleExpanded`; controlled `expandedKeys` + `onExpandedChange`; group `isDisabled` disables every trigger.
// Rivet: two-way `expandedKeys` signal, render-function children, `useDisclosureGroupNavigation` (upstream has no test:
// accessors, previous / next, multiple expansion, bounds), index exports.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const ui = await import("../src/components/disclosure-group/index.ts");
const { Disclosure } = await import("../src/components/disclosure/index.ts");
const { DisclosureGroup, useDisclosureGroupNavigation } = ui;

const flush = () => new Promise((r) => setTimeout(r, 20));

const Item = (props: { id: string; label: string }) => (
  <Disclosure aria-label={props.label} id={props.id}>
    <Disclosure.Heading>
      <Disclosure.Trigger>
        {props.label}
        <Disclosure.Indicator />
      </Disclosure.Trigger>
    </Disclosure.Heading>
    <Disclosure.Content>
      <Disclosure.Body>{props.label} content</Disclosure.Body>
    </Disclosure.Content>
  </Disclosure>
);

const renderGroup = (props: Record<string, unknown> = {}) =>
  render(() => (
    <DisclosureGroup data-testid="disclosure-group" {...props}>
      <Item id="preview" label="Preview" />
      <Item id="download" label="Download" />
    </DisclosureGroup>
  ));

const button = (root: ParentNode, name: string) =>
  [...root.querySelectorAll<HTMLButtonElement>('[data-slot="disclosure-trigger"]')].find((b) => b.textContent?.trim() === name)!;

test("exposes data-slot and BEM block", () => {
  const r = renderGroup();
  const group = r.container.querySelector('[data-testid="disclosure-group"]')!;
  assert.equal(group.getAttribute("data-slot"), "disclosure-group");
  assert.match(group.className, /disclosure-group/);
  r.unmount();
});

test("renders each Disclosure trigger", () => {
  const r = renderGroup();
  assert.ok(button(r.container, "Preview"));
  assert.ok(button(r.container, "Download"));
  r.unmount();
});

test("supports single expanded item by default", async () => {
  const r = renderGroup();
  const preview = button(r.container, "Preview");
  const download = button(r.container, "Download");
  preview.click();
  await flush();
  assert.equal(preview.getAttribute("aria-expanded"), "true");
  download.click();
  await flush();
  assert.equal(download.getAttribute("aria-expanded"), "true");
  assert.equal(preview.getAttribute("aria-expanded"), "false");
  r.unmount();
});

test("supports multiple expanded items with allowsMultipleExpanded", async () => {
  const r = renderGroup({ allowsMultipleExpanded: true });
  const preview = button(r.container, "Preview");
  const download = button(r.container, "Download");
  preview.click();
  await flush();
  download.click();
  await flush();
  assert.equal(preview.getAttribute("aria-expanded"), "true");
  assert.equal(download.getAttribute("aria-expanded"), "true");
  r.unmount();
});

test("supports controlled expandedKeys + onExpandedChange", async () => {
  const calls: Set<unknown>[] = [];
  const r = renderGroup({ expandedKeys: new Set(["preview"]), onExpandedChange: (k: Set<unknown>) => calls.push(k) });
  assert.equal(button(r.container, "Preview").getAttribute("aria-expanded"), "true");
  button(r.container, "Download").click();
  await flush();
  assert.deepEqual(calls, [new Set(["download"])]);
  r.unmount();
});

test("supports group disabled state on all items", () => {
  const r = renderGroup({ isDisabled: true });
  assert.equal(button(r.container, "Preview").disabled, true);
  assert.equal(button(r.container, "Download").disabled, true);
  r.unmount();
});

test("Rivet: a two-way expandedKeys signal follows the triggers and drives them", async () => {
  const keys = signal(new Set<string | number>(["preview"]));
  const r = renderGroup({ expandedKeys: keys });
  button(r.container, "Download").click();
  await flush();
  assert.deepEqual(keys(), new Set(["download"]));
  keys.set(new Set(["preview"]));
  await flush();
  assert.equal(button(r.container, "Preview").getAttribute("aria-expanded"), "true");
  assert.equal(button(r.container, "Download").getAttribute("aria-expanded"), "false");
  r.unmount();
});

test("Rivet: render-function children get the cdk render props", () => {
  const r = render(() => (
    <DisclosureGroup isDisabled>{({ isDisabled }: { isDisabled: boolean }) => <span id="probe">{String(isDisabled)}</span>}</DisclosureGroup>
  ));
  assert.equal(r.container.querySelector("#probe")!.textContent, "true");
  r.unmount();
});

test("Rivet: useDisclosureGroupNavigation (accessors, previous / next, bounds)", () => {
  const keys = signal(new Set<string | number>(["a"]));
  const nav = useDisclosureGroupNavigation({ expandedKeys: keys, itemIds: ["a", "b", "c"], onExpandedChange: (k) => keys.set(k) });
  assert.equal(nav.currentIndex(), 0);
  assert.equal(nav.isPrevDisabled(), true);
  assert.equal(nav.isNextDisabled(), false);
  nav.onPrevious();
  assert.deepEqual(keys(), new Set(["a"]));
  nav.onNext();
  assert.deepEqual(keys(), new Set(["b"]));
  nav.onNext();
  assert.deepEqual(keys(), new Set(["c"]));
  assert.equal(nav.isNextDisabled(), true);
  nav.onNext();
  assert.deepEqual(keys(), new Set(["c"]));
  nav.onPrevious();
  assert.deepEqual(keys(), new Set(["b"]));
  // Nothing expanded: the first item is current.
  keys.set(new Set());
  assert.equal(nav.currentIndex(), 0);
  // Multiple expansion adds the next key.
  const multi = signal(new Set<string | number>(["a"]));
  const m = useDisclosureGroupNavigation({ expandedKeys: multi, itemIds: ["a", "b"], allowsMultipleExpanded: true, onExpandedChange: (k) => multi.set(k) });
  m.onNext();
  assert.deepEqual(multi(), new Set(["a", "b"]));
  // A plain Set and an empty list.
  const calls: Set<unknown>[] = [];
  const p = useDisclosureGroupNavigation({ expandedKeys: new Set(["b"]), itemIds: ["a", "b"], onExpandedChange: (k) => calls.push(k) });
  p.onPrevious();
  assert.deepEqual(calls, [new Set(["a"])]);
  const e = useDisclosureGroupNavigation({ expandedKeys: new Set(), itemIds: [], onExpandedChange: () => {} });
  assert.equal(e.currentIndex(), -1);
});

test("Rivet: index exports the compound part, named part, variants and hook", () => {
  assert.equal(DisclosureGroup.Root, ui.DisclosureGroupRoot);
  assert.equal(typeof ui.disclosureGroupVariants, "function");
  assert.equal(typeof ui.useDisclosureGroupNavigation, "function");
});
