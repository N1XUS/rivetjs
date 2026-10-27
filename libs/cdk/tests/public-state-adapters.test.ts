// Direct contracts for the public React Stately state adapters (Rivet signal plumbing).
import { test } from "vitest";
import assert from "node:assert/strict";
import { signal } from "@rivetjs/reactivity";
import { createSingleSelectListState, listBoxLinkBehavior, itemTabIndex } from "@rivetjs/cdk/state/list";
import { createRadioGroupState, setSelectedValue, radioTabIndex, isRadioInvalid, setLastFocusedValue } from "@rivetjs/cdk/state/radio-group";
import { createMenuTriggerState, createSubmenuTriggerState, toggleSubmenu, isSubmenuOpen } from "@rivetjs/cdk/state/menu-trigger";
import { createToggleState } from "@rivetjs/cdk/state/toggle";
import { toggleButtonAttrs, toggleButtonPress, isToggleSelected } from "@rivetjs/cdk/toggle-button/behaviour";

test("single select initial focus skips disabled items and prefers a selected enabled item", () => {
  const items = [
    { key: "a", label: "Apple", disabled: true },
    { key: "b", label: "Banana" },
    { key: "c", label: "Cherry" },
  ];
  const state = createSingleSelectListState({ items, defaultSelectedKey: "c" });
  assert.equal(state.selectedKey(), "c");
  assert.equal(state.focusedKey(), "c");
  assert.equal(itemTabIndex(state, "a"), undefined);
  assert.equal(itemTabIndex(state, "b"), -1);
  assert.equal(itemTabIndex(state, "c"), 0);
  assert.equal(createSingleSelectListState({ items }).focusedKey(), "b");
});

test("listbox links use action only with replacement selection, unless explicitly overridden", () => {
  assert.equal(listBoxLinkBehavior(), "override");
  assert.equal(listBoxLinkBehavior("replace"), "action");
  assert.equal(listBoxLinkBehavior("toggle", "action"), "override");
  assert.equal(listBoxLinkBehavior("replace", "selection"), "selection");
});

test("radio updates report changes once, respect live disabled/read-only and update tab stops", () => {
  const disabled = signal(false),
    readOnly = signal(false),
    changes: string[] = [];
  const state = createRadioGroupState({ defaultValue: "a", isDisabled: disabled, isReadOnly: readOnly, onChange: (value) => changes.push(value) });
  setSelectedValue(state, "b");
  setSelectedValue(state, "b");
  assert.deepEqual(changes, ["b"]);
  assert.equal(radioTabIndex(state, "a", false), -1);
  assert.equal(radioTabIndex(state, "b", false), 0);
  assert.equal(radioTabIndex(state, "b", true), undefined);
  disabled.set(true);
  setSelectedValue(state, "a");
  disabled.set(false);
  readOnly.set(true);
  setSelectedValue(state, "a");
  assert.equal(state.selectedValue(), "b");
  assert.equal(isRadioInvalid(state), false);
  readOnly.set(false);
  setSelectedValue(state, null);
  setLastFocusedValue(state, "a");
  assert.equal(radioTabIndex(state, "a", false), 0);
  assert.equal(radioTabIndex(state, "b", false), -1);
});

test("controlled radio reports selection without writing its value", () => {
  const changes: string[] = [];
  const value = signal<string | null>("a");
  const state = createRadioGroupState({ value: () => value(), onChange: (next) => changes.push(next) });
  setSelectedValue(state, "b");
  assert.equal(state.selectedValue(), "a");
  assert.deepEqual(changes, ["b"]);
  value.set("b");
  assert.equal(state.selectedValue(), "b");
});

test("submenu toggle closes descendants and resets the focus strategy", () => {
  const root = createMenuTriggerState();
  const first = createSubmenuTriggerState({ triggerKey: "first" }, root, 0);
  const child = createSubmenuTriggerState({ triggerKey: "child" }, root, 1);
  toggleSubmenu(first, "first");
  toggleSubmenu(child, "last");
  assert.equal(isSubmenuOpen(root, "first", 0), true);
  assert.deepEqual(root.expandedKeysStack(), ["first", "child"]);
  assert.equal(child.focusStrategy(), "last");
  toggleSubmenu(first);
  assert.deepEqual(root.expandedKeysStack(), []);
  assert.equal(first.focusStrategy(), null);
  assert.equal(child.isOpen(), false);
});

test("toggle attribute accessors follow presses and disabled state prevents changes", () => {
  const changes: boolean[] = [];
  const state = createToggleState({ onChange: (value) => changes.push(value) });
  const attrs = toggleButtonAttrs(state);
  const pressed = attrs["aria-pressed"] as () => string;
  const selected = attrs["data-selected"] as () => string | undefined;
  assert.equal(attrs.type, "button");
  assert.equal(pressed(), "false");
  toggleButtonPress(state);
  assert.equal(isToggleSelected(state), true);
  assert.equal(pressed(), "true");
  assert.equal(selected(), "true");
  toggleButtonPress(state);
  assert.equal(selected(), undefined);
  assert.deepEqual(changes, [true, false]);
  const disabled = createToggleState({ isDisabled: true });
  toggleButtonPress(disabled);
  assert.equal(toggleButtonAttrs(disabled).disabled, true);
  assert.equal(isToggleSelected(disabled), false);
});
