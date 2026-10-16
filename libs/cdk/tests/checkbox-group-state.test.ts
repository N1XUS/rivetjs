// Ported from react-stately test/checkbox/useCheckboxGroupState.test.tsx (react-spectrum, Apache-2.0, © Adobe).
// Changes: a `Test` component + `render` / `rerender` / `act` → `createCheckboxGroupState` and the free
// functions; `container.textContent` → `state.value().join(", ")`; "control the value" re-creates the state
// with the new prop (a changed plain prop re-creates the Rivet component) and adds the two-way Signal form;
// "toggleState twice synchronously" ends at the initial value (writes chain within a task, no stale render value);
// Jest globals from @rivetjs/testing/jest.
// Rivet additions (below the upstream suite): plain controlled value only reports changes; `setInvalid`
// merges checkbox results into the group validation; `isRequiredNow`; JSON round trip of the state.
/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { describe, expect, it, jest } from "@rivetjs/testing/jest";
import { signal } from "@rivetjs/reactivity";
import {
  addValue,
  createCheckboxGroupState,
  isGroupInvalid,
  isRequiredNow,
  isSelected,
  removeValue,
  setInvalid,
  setValue,
  toggleValue,
} from "../state/checkbox-group.ts";
import { DEFAULT_VALIDATION_RESULT, displayValidation } from "../state/form-validation.ts";
import { jsonRoundTrip } from "./state-json.ts";

const text = (state: ReturnType<typeof createCheckboxGroupState>) => state.value().join(", ");

describe("useCheckboxGroupState", () => {
  it("should return basic interface when no props are provided", () => {
    const state = createCheckboxGroupState();

    expect(state.value()).toEqual([]);
    expect(state.isDisabled).toBe(false);
    expect(state.isReadOnly).toBe(false);
    expect(typeof setValue).toBe("function");
    expect(typeof addValue).toBe("function");
    expect(typeof removeValue).toBe("function");
    expect(typeof toggleValue).toBe("function");
    expect(typeof isSelected).toBe("function");
  });

  it("should return the same `isDisabled` that has been provided", () => {
    const state = createCheckboxGroupState({ isDisabled: true });

    expect(state.isDisabled).toBe(true);
  });

  it("should return the same `isReadOnly` that has been provided", () => {
    const state = createCheckboxGroupState({ isReadOnly: true });

    expect(state.isReadOnly).toBe(true);
  });

  it("should be possible to provide the initial value", () => {
    const state = createCheckboxGroupState({ value: ["foo", "bar"] });

    expect(state.value()).toEqual(["foo", "bar"]);
  });

  it("should be possible to provide a default value", () => {
    const state = createCheckboxGroupState({ defaultValue: ["foo", "bar"] });

    expect(state.value()).toEqual(["foo", "bar"]);
  });

  it("should support isSelected to determine if a value is selected", () => {
    const state = createCheckboxGroupState({ value: ["foo", "bar"] });

    expect(isSelected(state, "foo")).toBe(true);
    expect(isSelected(state, "baz")).toBe(false);
  });

  it("should be possible to control the value", () => {
    // Plain value: a new prop re-creates the state (Rivet re-creates the component).
    expect(text(createCheckboxGroupState({ value: ["foo"] }))).toBe("foo");
    expect(text(createCheckboxGroupState({ value: ["foo", "bar"] }))).toBe("foo, bar");

    // Two-way Signal: the caller's signal is the value.
    const value = signal(["foo"]);
    const state = createCheckboxGroupState({ value });
    expect(text(state)).toBe("foo");
    value.set(["foo", "bar"]);
    expect(text(state)).toBe("foo, bar");
  });

  it("should be possible to have the value uncontrolled", () => {
    const state = createCheckboxGroupState({ defaultValue: ["foo"] });

    expect(text(state)).toBe("foo");

    setValue(state, ["foo", "bar"]);

    expect(text(state)).toBe("foo, bar");
  });

  it("should call the provided `onChange` callback whenever value changes", () => {
    const onChangeSpy = jest.fn();
    const nextValue = ["foo", "bar"];
    const state = createCheckboxGroupState({ defaultValue: ["foo"], onChange: onChangeSpy });

    setValue(state, nextValue);

    expect(onChangeSpy).toHaveBeenCalledWith(nextValue);
  });

  it("should be possible to add a value using `addValue`", () => {
    const state = createCheckboxGroupState({ defaultValue: ["foo"] });

    addValue(state, "baz");

    expect(text(state)).toBe("foo, baz");
  });

  it("should not add the same value multiple times when using `addValue`", () => {
    const state = createCheckboxGroupState({ defaultValue: ["foo"] });

    addValue(state, "baz");
    addValue(state, "baz");
    addValue(state, "baz");
    addValue(state, "baz");

    expect(text(state)).toBe("foo, baz");
  });

  it("should be possible to remove a value using `removeValue`", () => {
    const state = createCheckboxGroupState({ defaultValue: ["foo", "qwe"] });

    removeValue(state, "foo");

    expect(text(state)).toBe("qwe");
  });

  it("should be possible to add & remove value based on it being or not in the stored value using `toggleValue`", () => {
    const state = createCheckboxGroupState({ defaultValue: ["foo", "qwe"] });

    toggleValue(state, "foo");

    expect(text(state)).toBe("qwe");

    toggleValue(state, "foo");

    expect(text(state)).toBe("qwe, foo");
  });

  it("should go back to the initial value after `toggleState` being called twice with the same value synchronously", () => {
    const state = createCheckboxGroupState({ defaultValue: ["foo", "qwe"] });

    toggleValue(state, "qwe");
    toggleValue(state, "qwe");

    // Deviation: upstream reads the value of the last React render in both calls (stale closure) and
    // ends at "foo"; Rivet writes chain in one task (controllable `pending`), so the value is back at the
    // initial value — what the test title says.
    expect(text(state)).toBe("foo, qwe");
  });

  it("should not update state for readonly group", () => {
    const state = createCheckboxGroupState({ isReadOnly: true, defaultValue: ["test"] });

    expect(text(state)).toBe("test");
    addValue(state, "foo");
    expect(text(state)).toBe("test");
    removeValue(state, "test");
    expect(text(state)).toBe("test");
    toggleValue(state, "foo");
    expect(text(state)).toBe("test");
    setValue(state, ["foo"]);
    expect(text(state)).toBe("test");
  });

  it("should not update state for disabled group", () => {
    const state = createCheckboxGroupState({ isDisabled: true, defaultValue: ["test"] });

    expect(text(state)).toBe("test");
    addValue(state, "foo");
    expect(text(state)).toBe("test");
    removeValue(state, "test");
    expect(text(state)).toBe("test");
    toggleValue(state, "foo");
    expect(text(state)).toBe("test");
    setValue(state, ["foo"]);
    expect(text(state)).toBe("test");
  });
});

describe("createCheckboxGroupState (Rivet)", () => {
  it("a plain controlled value only reports changes", () => {
    const onChange = jest.fn();
    const state = createCheckboxGroupState({ value: ["a"], onChange });
    addValue(state, "b");
    expect(onChange).toHaveBeenLastCalledWith(["a", "b"]);
    expect(text(state)).toBe("a");
  });

  it("a Signal value is written (two-way) and reported", () => {
    const onChange = jest.fn();
    const value = signal<string[]>([]);
    const state = createCheckboxGroupState({ value, onChange });
    addValue(state, "a");
    expect(value()).toEqual(["a"]);
    expect(onChange).toHaveBeenLastCalledWith(["a"]);
  });

  it("isRequiredNow: required while nothing is selected", () => {
    const state = createCheckboxGroupState({ isRequired: true });
    expect(isRequiredNow(state)).toBe(true);
    addValue(state, "a");
    expect(isRequiredNow(state)).toBe(false);
  });

  it("setInvalid merges checkbox results into the group validation (aria)", () => {
    const state = createCheckboxGroupState({ validationBehavior: "aria" });
    const invalid = {
      isInvalid: true,
      validationErrors: ["Bad"],
      validationDetails: { ...DEFAULT_VALIDATION_RESULT.validationDetails, customError: true, valid: false },
    };
    setInvalid(state, "a", invalid);
    expect(isGroupInvalid(state)).toBe(true);
    expect(displayValidation(state.validation).validationErrors).toEqual(["Bad"]);
    setInvalid(state, "a", DEFAULT_VALIDATION_RESULT);
    expect(isGroupInvalid(state)).toBe(false);
  });

  it("serializes (resume table round trip)", () => {
    const state = createCheckboxGroupState({ defaultValue: ["a"], isRequired: true });
    const copy = jsonRoundTrip(state);
    expect(copy.value()).toEqual(["a"]);
    expect(copy.required).toBe(true);
  });
});
