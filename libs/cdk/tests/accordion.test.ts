// Ported from angular/components src/cdk/accordion/accordion.spec.ts (CdkAccordion), MIT, © Google LLC.
// Changes: the Angular accordion merged into the RAC Disclosure (user decision 2026-10-06): the
// CdkAccordion is a disclosure group state (`createDisclosureGroupState`, `multi` = `allowsMultipleExpanded`,
// a Signal here), items are registered keys (`registerDisclosure`, disabled flag), expanding an item =
// `toggleKey` / `setExpandedKeys`. Item-level cases (accordion-item.spec.ts: toggle, opened / closed /
// destroyed events, disabled items, nested accordions) need the component: `disclosure.browser.test.tsx`.
// Dropped: "ids: cdk-accordion-<n>" (RAC ids: the disclosure `id` prop / generated id).
import { describe, it, beforeEach } from "vitest";
import assert from "node:assert/strict";
import { signal, untrack, type Signal } from "@rivetjs/reactivity";
import {
  closeAll,
  createDisclosureGroupState,
  isKeyExpanded,
  openAll,
  registerDisclosure,
  setExpandedKeys,
  toggleKey,
  unregisterDisclosure,
  type DisclosureGroupState,
} from "@rivetjs/cdk/accordion";

const expanded = (state: DisclosureGroupState) => (key: string) => untrack(() => isKeyExpanded(state, key));
const open = (state: DisclosureGroupState, key: string) => {
  if (!untrack(() => isKeyExpanded(state, key))) toggleKey(state, key);
};

describe("CdkAccordion (DisclosureGroup state)", () => {
  let multi: Signal<boolean>;
  let accordion: DisclosureGroupState;
  const items = ["first", "second"];
  // SetOfItems: an accordion with two items.
  beforeEach(() => {
    multi = signal(false);
    accordion = createDisclosureGroupState({ allowsMultipleExpanded: multi });
    for (const key of items) registerDisclosure(accordion, key);
  });

  it("should ensure only one item is expanded at a time", () => {
    open(accordion, "first");
    assert.deepEqual(items.map(expanded(accordion)), [true, false]);
    open(accordion, "second");
    assert.deepEqual(items.map(expanded(accordion)), [false, true]);
  });

  it("should allow multiple items to be expanded simultaneously", () => {
    multi.set(true);
    open(accordion, "first");
    open(accordion, "second");
    assert.deepEqual(items.map(expanded(accordion)), [true, true]);
  });

  it("should be able to expand and collapse all items in multiple mode", () => {
    multi.set(true);
    openAll(accordion);
    assert.equal(items.every(expanded(accordion)), true);
    closeAll(accordion);
    assert.equal(items.some(expanded(accordion)), false);
  });

  it("should not be able to expand all items if multiple mode is off", () => {
    openAll(accordion);
    assert.equal(items.some(expanded(accordion)), false);
  });

  it("should be able to use closeAll even if multiple mode is disabled", () => {
    open(accordion, "first");
    closeAll(accordion);
    assert.equal(expanded(accordion)("first"), false);
  });

  // Rivet additions (Angular item behaviour: a disabled item ignores openAll / closeAll).
  it("openAll / closeAll skip disabled items", () => {
    multi.set(true);
    registerDisclosure(accordion, "third", true);
    openAll(accordion);
    assert.deepEqual(["first", "second", "third"].map(expanded(accordion)), [true, true, false]);
    setExpandedKeys(accordion, new Set(["first", "third"]));
    closeAll(accordion);
    assert.deepEqual(["first", "second", "third"].map(expanded(accordion)), [false, false, true]);
  });

  it("multi accepts a two-way signal", () => {
    multi.set(true);
    open(accordion, "first");
    open(accordion, "second");
    assert.deepEqual(items.map(expanded(accordion)), [true, true]);
    multi.set(false);
    toggleKey(accordion, "first");
    toggleKey(accordion, "first");
    assert.deepEqual(items.map(expanded(accordion)), [true, false]);
  });

  it("unregisterDisclosure removes the item (CdkAccordionItem destroyed)", () => {
    multi.set(true);
    unregisterDisclosure(accordion, "first");
    openAll(accordion);
    assert.deepEqual(items.map(expanded(accordion)), [false, true]);
  });
});
