// Ported from react-stately test/disclosure/useDisclosureState.test.ts + useDisclosureGroupState.test.ts,
// Apache-2.0, © Adobe.
// Rivet: renderHook + act → direct state factories; `rerender` with a new controlled value → a two-way
// Signal written from outside (Rivet's re-render equivalent); plain controlled values stay as upstream.
import { describe, expect, it, vi } from "vitest";
import { signal } from "@rivetjs/reactivity";
import {
  collapse,
  createDisclosureGroupState,
  createDisclosureState,
  expand,
  isKeyExpanded,
  keyExpanded,
  setExpandedKeys,
  toggleDisclosure,
  toggleKey,
  type Key,
} from "../state/disclosure.ts";

describe("useDisclosureState", () => {
  it("should initialize as not expanded by default", () => {
    expect(createDisclosureState({}).isExpanded()).toBe(false);
  });

  it("should initialize with defaultExpanded when provided", () => {
    expect(createDisclosureState({ defaultExpanded: true }).isExpanded()).toBe(true);
  });

  it("should allow controlled isExpanded prop", () => {
    const isExpanded = signal(true);
    const state = createDisclosureState({ isExpanded });
    expect(state.isExpanded()).toBe(true);
    isExpanded.set(false);
    expect(state.isExpanded()).toBe(false);
  });

  it("should call onExpandedChange when expanded state changes", () => {
    const onExpandedChange = vi.fn();
    const state = createDisclosureState({ onExpandedChange });
    expand(state);
    expect(onExpandedChange).toHaveBeenCalledWith(true);
    collapse(state);
    expect(onExpandedChange).toHaveBeenCalledWith(false);
  });

  it("should toggle expanded state correctly", () => {
    const state = createDisclosureState({});
    toggleDisclosure(state);
    expect(state.isExpanded()).toBe(true);
    toggleDisclosure(state);
    expect(state.isExpanded()).toBe(false);
  });

  it("should not change state when controlled", () => {
    const onExpandedChange = vi.fn();
    const state = createDisclosureState({ isExpanded: false, onExpandedChange });
    expand(state);
    expect(state.isExpanded()).toBe(false);
    expect(onExpandedChange).toHaveBeenCalledWith(true);
  });

  // Rivet: a two-way Signal is written, then onExpandedChange runs.
  it("writes a two-way Signal and calls onExpandedChange", () => {
    const onExpandedChange = vi.fn();
    const isExpanded = signal(false);
    const state = createDisclosureState({ isExpanded, onExpandedChange });
    toggleDisclosure(state);
    expect(isExpanded()).toBe(true);
    expect(onExpandedChange).toHaveBeenCalledWith(true);
  });

  // Rivet: a read-only accessor (the group's computed) is controlled.
  it("treats a read-only accessor as controlled", () => {
    const group = createDisclosureGroupState({ defaultExpandedKeys: ["a"] });
    const onExpandedChange = vi.fn((v: boolean) => {
      expect(v).toBe(false);
      toggleKey(group, "a");
    });
    const state = createDisclosureState({ isExpanded: keyExpanded(group, "a"), onExpandedChange });
    expect(state.isExpanded()).toBe(true);
    toggleDisclosure(state);
    expect(onExpandedChange).toHaveBeenCalledTimes(1);
    expect(state.isExpanded()).toBe(false);
  });
});

describe("useDisclosureGroupState", () => {
  it("should initialize with empty expandedKeys when not provided", () => {
    expect(createDisclosureGroupState({}).expandedKeys().size).toBe(0);
  });

  it("should initialize with defaultExpandedKeys when provided", () => {
    const state = createDisclosureGroupState({ defaultExpandedKeys: ["item1"] });
    expect(state.expandedKeys().has("item1")).toBe(true);
    expect(state.expandedKeys().has("item2")).toBe(false);
  });

  it("should initialize with multiple defaultExpandedKeys when provided, and if allowsMultipleExpanded is true", () => {
    const state = createDisclosureGroupState({ defaultExpandedKeys: ["item1", "item2"], allowsMultipleExpanded: true });
    expect(state.expandedKeys().has("item1")).toBe(true);
    expect(state.expandedKeys().has("item2")).toBe(true);
  });

  it("should allow controlled expandedKeys prop", () => {
    const expandedKeys = signal<Set<Key>>(new Set(["item1"]));
    const state = createDisclosureGroupState({ expandedKeys });
    expect(state.expandedKeys().has("item1")).toBe(true);
    expandedKeys.set(new Set(["item2"]));
    expect(state.expandedKeys().has("item1")).toBe(false);
    expect(state.expandedKeys().has("item2")).toBe(true);
  });

  it("should toggle key correctly when allowsMultipleExpanded is false", () => {
    const state = createDisclosureGroupState({});
    toggleKey(state, "item1");
    expect(state.expandedKeys().has("item1")).toBe(true);
    toggleKey(state, "item2");
    expect(state.expandedKeys().has("item1")).toBe(false);
    expect(state.expandedKeys().has("item2")).toBe(true);
  });

  it("should toggle key correctly when allowsMultipleExpanded is true", () => {
    const state = createDisclosureGroupState({ allowsMultipleExpanded: true });
    toggleKey(state, "item1");
    expect(state.expandedKeys().has("item1")).toBe(true);
    toggleKey(state, "item2");
    expect(state.expandedKeys().has("item1")).toBe(true);
    expect(state.expandedKeys().has("item2")).toBe(true);
  });

  it("should call onExpandedChange when expanded keys change", () => {
    const onExpandedChange = vi.fn();
    const state = createDisclosureGroupState({ onExpandedChange });
    toggleKey(state, "item1");
    expect(onExpandedChange).toHaveBeenCalledWith(new Set(["item1"]));
  });

  it("should not expand more than one key when allowsMultipleExpanded is false", () => {
    const state = createDisclosureGroupState({});
    toggleKey(state, "item1");
    toggleKey(state, "item2");
    expect(state.expandedKeys().size).toBe(1);
    expect(state.expandedKeys().has("item2")).toBe(true);
  });

  it("should respect isDisabled prop", () => {
    expect(createDisclosureGroupState({ isDisabled: true }).isDisabled).toBe(true);
  });

  // Rivet additions.
  it("clamps defaultExpandedKeys to one key in single mode", () => {
    const state = createDisclosureGroupState({ defaultExpandedKeys: ["a", "b"] });
    expect([...state.expandedKeys()]).toEqual(["a"]);
  });

  it("plain controlled expandedKeys are not written; onExpandedChange is called", () => {
    const onExpandedChange = vi.fn();
    const state = createDisclosureGroupState({ expandedKeys: ["a"], onExpandedChange });
    toggleKey(state, "b");
    expect([...state.expandedKeys()]).toEqual(["a"]);
    expect(onExpandedChange).toHaveBeenCalledWith(new Set(["b"]));
  });

  it("isKeyExpanded compares keys as strings; setExpandedKeys replaces", () => {
    const state = createDisclosureGroupState({ allowsMultipleExpanded: true });
    setExpandedKeys(state, new Set<Key>([1, "x"]));
    expect(isKeyExpanded(state, "1")).toBe(true);
    expect(isKeyExpanded(state, "y")).toBe(false);
  });
});
