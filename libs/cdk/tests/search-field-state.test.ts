// Ported from react-stately test/searchfield/useSearchFieldState.test.js (react-spectrum, Apache-2.0, © Adobe).
// Changes: `renderHook(() => useSearchFieldState(props))` → `createSearchFieldState(props)`; `result.current.value`
// → `searchFieldValue(state)`; `setValue` → `setSearchFieldValue(state, v)`; `jest.fn` → `vi.fn`.
// Rivet additions: two-way Signal value, accessor value (read live, never written).
import { afterEach, describe, expect, it, vi } from "vitest";
import { signal } from "@rivetjs/reactivity";
import { createSearchFieldState, searchFieldValue, setSearchFieldValue } from "../state/search-field.ts";

describe("useSearchFieldState", () => {
  const onChange = vi.fn();
  const newValue = "newValue";

  afterEach(() => {
    onChange.mockClear();
  });

  it("should be controlled if props.value is defined", () => {
    const props = {
      value: "blah",
      onChange,
    };
    const state = createSearchFieldState(props);
    expect(searchFieldValue(state)).toBe(props.value);
    setSearchFieldValue(state, newValue);
    expect(searchFieldValue(state)).toBe(props.value);
    expect(onChange).toHaveBeenCalledWith(newValue);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("should start with value = props.defaultValue if props.value is not defined and props.defaultValue is defined", () => {
    const props = {
      defaultValue: "blah",
      onChange,
    };
    const state = createSearchFieldState(props);
    expect(searchFieldValue(state)).toBe(props.defaultValue);
    setSearchFieldValue(state, newValue);
    expect(searchFieldValue(state)).toBe(newValue);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('should default to uncontrolled with value = "" if defaultValue and value aren\'t defined', () => {
    const props = {
      onChange,
    };
    const state = createSearchFieldState(props);
    expect(searchFieldValue(state)).toBe("");
    setSearchFieldValue(state, newValue);
    expect(searchFieldValue(state)).toBe(newValue);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("should convert numeric values to strings (uncontrolled)", () => {
    const props = {
      defaultValue: 13,
    };

    const state = createSearchFieldState(props as never);
    expect(searchFieldValue(state)).toBe(props.defaultValue.toString());
  });

  it("should convert an array of string values to a string (uncontrolled)", () => {
    const props = {
      defaultValue: ["hi", "this", "is", "me"],
    };

    const state = createSearchFieldState(props as never);
    expect(searchFieldValue(state)).toBe(props.defaultValue.toString());
  });

  it("should convert numeric values to strings (controlled)", () => {
    const props = {
      value: 13,
    };

    const state = createSearchFieldState(props as never);
    expect(searchFieldValue(state)).toBe(props.value.toString());
  });

  it("should convert an array of string values to a string (controlled)", () => {
    const props = {
      value: ["hi", "this", "is", "me"],
    };

    const state = createSearchFieldState(props as never);
    expect(searchFieldValue(state)).toBe(props.value.toString());
  });

  // Rivet additions.
  it("two-way Signal value is written and reported", () => {
    const value = signal("a");
    const state = createSearchFieldState({ value, onChange });
    setSearchFieldValue(state, "b");
    expect(value()).toBe("b");
    expect(searchFieldValue(state)).toBe("b");
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("accessor value is read live and never written", () => {
    const source = signal("x");
    const state = createSearchFieldState({ value: () => source(), onChange });
    expect(searchFieldValue(state)).toBe("x");
    setSearchFieldValue(state, "y");
    expect(source()).toBe("x");
    expect(onChange).toHaveBeenCalledWith("y");
    source.set("z");
    expect(searchFieldValue(state)).toBe("z");
  });
});
