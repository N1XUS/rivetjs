// Ported from react-stately test/color/useColorFieldState.test.js (react-spectrum, Apache-2.0, © Adobe).
// Changes: `renderHook(() => useColorFieldState(props))` → `createColorFieldState(props)`; `result.current.x` →
// free functions (`colorValue(state)`, `inputValue(state)`, `commit(state)`, …); `act` dropped (writes are
// synchronous); Jest globals from @rivetjs/testing/jest; `it.each` template tables → arrays.
// Rivet additions: two-way signal value, resume-table round trip.
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
import { signal, untrack } from "@rivetjs/reactivity";
import {
  colorValue,
  commit,
  createColorFieldState,
  decrement,
  decrementToMin,
  increment,
  incrementToMax,
  inputValue,
  parseColor,
  setInputValue,
  type ColorFieldProps,
  type ColorFieldState,
} from "../color/index.ts";
import { jsonRoundTrip } from "./state-json.ts";

const actions: Record<string, (state: ColorFieldState) => void> = { increment, decrement, incrementToMax, decrementToMin };

describe("useColorFieldState tests", function () {
  it.each([
    { Name: "no initial value", props: {} },
    { Name: "invalid initial value", props: { defaultValue: "invalidColor" } },
  ])("should be in empty state if $Name is provided", function ({ props }) {
    let result = createColorFieldState(props as ColorFieldProps);
    expect(colorValue(result)).toBeUndefined();
    expect(inputValue(result)).toBe("");
  });

  it.each([
    { Name: "6-length hex string", props: { defaultValue: "#aabbcc" } },
    { Name: "3-length hex string", props: { defaultValue: "#abc" } },
    { Name: "Color object", props: { defaultValue: parseColor("#aabbcc") } },
    { Name: "6-length hex string (controlled)", props: { value: "#aabbcc" } },
    { Name: "3-length hex string (controlled)", props: { value: "#abc" } },
    { Name: "Color object (controlled)", props: { value: parseColor("#aabbcc") } },
  ])("should accept $Name as value", function ({ props }) {
    let result = createColorFieldState(props as ColorFieldProps);
    expect(colorValue(result)!.getChannelValue("red")).toBe(170);
    expect(colorValue(result)!.getChannelValue("green")).toBe(187);
    expect(colorValue(result)!.getChannelValue("blue")).toBe(204);
    expect(colorValue(result)!.getChannelValue("alpha")).toBe(1);
    expect(inputValue(result)).toBe("#AABBCC");
  });

  it.each([
    { name: "not increment beyond max value", action: "increment", props: { defaultValue: "#ffffff" } },
    { name: "increment to max value", action: "incrementToMax", props: { defaultValue: "#aabbcc" } },
  ])("should $action $name", function ({ action, props }) {
    let result = createColorFieldState(props);
    actions[action]!(result);
    expect(colorValue(result)!.getChannelValue("red")).toBe(255);
    expect(colorValue(result)!.getChannelValue("green")).toBe(255);
    expect(colorValue(result)!.getChannelValue("blue")).toBe(255);
    expect(colorValue(result)!.getChannelValue("alpha")).toBe(1);
    expect(inputValue(result)).toBe("#FFFFFF");
  });

  it.each([
    { name: "not decrement beyond min value", action: "decrement", props: { defaultValue: "#000000" } },
    { name: "decrement to min value", action: "decrementToMin", props: { defaultValue: "#aabbcc" } },
  ])("should $action $name", function ({ action, props }) {
    let result = createColorFieldState(props);
    actions[action]!(result);
    expect(colorValue(result)!.getChannelValue("red")).toBe(0);
    expect(colorValue(result)!.getChannelValue("green")).toBe(0);
    expect(colorValue(result)!.getChannelValue("blue")).toBe(0);
    expect(colorValue(result)!.getChannelValue("alpha")).toBe(1);
    expect(inputValue(result)).toBe("#000000");
  });

  it("should revert to last valid input value", function () {
    let onChangeSpy = jest.fn();
    let props = { defaultValue: "#abc", minValue: "#abc", onChange: onChangeSpy };
    let result = createColorFieldState(props);
    expect(inputValue(result)).toBe("#AABBCC");
    expect(colorValue(result)!.getChannelValue("red")).toBe(170);
    expect(colorValue(result)!.getChannelValue("green")).toBe(187);
    expect(colorValue(result)!.getChannelValue("blue")).toBe(204);
    expect(colorValue(result)!.getChannelValue("alpha")).toBe(1);

    setInputValue(result, "ab");
    expect(inputValue(result)).toBe("ab");

    commit(result);
    expect(inputValue(result)).toBe("#AABBCC");
    expect(onChangeSpy).not.toHaveBeenCalled();
  });

  it("should not accept invalid characters", function () {
    let onChangeSpy = jest.fn();
    let props = { defaultValue: "#abc", minValue: "#abc", onChange: onChangeSpy };
    let result = createColorFieldState(props);
    expect(inputValue(result)).toBe("#AABBCC");
    expect(colorValue(result)!.getChannelValue("red")).toBe(170);
    expect(colorValue(result)!.getChannelValue("green")).toBe(187);
    expect(colorValue(result)!.getChannelValue("blue")).toBe(204);
    expect(colorValue(result)!.getChannelValue("alpha")).toBe(1);

    setInputValue(result, "invalidColor");

    commit(result);
    expect(inputValue(result)).toBe("#AABBCC");
    expect(onChangeSpy).not.toHaveBeenCalled();
  });

  it("should update colorValue (uncontrolled)", function () {
    let onChangeSpy = jest.fn();
    let props = { defaultValue: "#abc", onChange: onChangeSpy };
    let result = createColorFieldState(props);
    expect(colorValue(result)!.getChannelValue("red")).toBe(170);
    expect(colorValue(result)!.getChannelValue("green")).toBe(187);
    expect(colorValue(result)!.getChannelValue("blue")).toBe(204);
    expect(colorValue(result)!.getChannelValue("alpha")).toBe(1);
    expect(inputValue(result)).toBe("#AABBCC");

    let newColor = parseColor("#cba");
    setInputValue(result, "#cba");

    commit(result);
    expect(onChangeSpy).toHaveBeenCalledWith(newColor);
    expect(colorValue(result)!.getChannelValue("red")).toBe(204);
    expect(colorValue(result)!.getChannelValue("green")).toBe(187);
    expect(colorValue(result)!.getChannelValue("blue")).toBe(170);
    expect(colorValue(result)!.getChannelValue("alpha")).toBe(1);
    expect(inputValue(result)).toBe("#CCBBAA");
  });

  it("should not update colorValue (controlled)", function () {
    let onChangeSpy = jest.fn();
    let props = { value: "#abc", onChange: onChangeSpy };
    let result = createColorFieldState(props);
    expect(colorValue(result)!.getChannelValue("red")).toBe(170);
    expect(colorValue(result)!.getChannelValue("green")).toBe(187);
    expect(colorValue(result)!.getChannelValue("blue")).toBe(204);
    expect(colorValue(result)!.getChannelValue("alpha")).toBe(1);
    expect(inputValue(result)).toBe("#AABBCC");

    let newColor = parseColor("#cba");
    setInputValue(result, "#cba");

    commit(result);
    expect(onChangeSpy).toHaveBeenCalledWith(newColor);
    expect(colorValue(result)!.getChannelValue("red")).toBe(170);
    expect(colorValue(result)!.getChannelValue("green")).toBe(187);
    expect(colorValue(result)!.getChannelValue("blue")).toBe(204);
    expect(colorValue(result)!.getChannelValue("alpha")).toBe(1);
    expect(inputValue(result)).toBe("#AABBCC");
  });

  it("should call onChange when input is cleared", function () {
    let onChangeSpy = jest.fn();
    let props = { defaultValue: "#abc", onChange: onChangeSpy };
    let result = createColorFieldState(props);
    expect(colorValue(result)!.getChannelValue("red")).toBe(170);
    expect(colorValue(result)!.getChannelValue("green")).toBe(187);
    expect(colorValue(result)!.getChannelValue("blue")).toBe(204);
    expect(colorValue(result)!.getChannelValue("alpha")).toBe(1);
    expect(inputValue(result)).toBe("#AABBCC");

    setInputValue(result, "");

    commit(result);
    expect(onChangeSpy).toHaveBeenCalledWith(null);
    expect(colorValue(result)).toBeNull();
    expect(inputValue(result)).toBe("");
  });

  it.each([{ action: "increment" }, { action: "incrementToMax" }])("should not call onChange on $action when value is already at max", function ({ action }) {
    let onChangeSpy = jest.fn();
    let props = { defaultValue: "#FFF", onChange: onChangeSpy };
    let result = createColorFieldState(props);
    expect(colorValue(result)!.getChannelValue("red")).toBe(255);
    expect(colorValue(result)!.getChannelValue("green")).toBe(255);
    expect(colorValue(result)!.getChannelValue("blue")).toBe(255);
    expect(colorValue(result)!.getChannelValue("alpha")).toBe(1);
    expect(inputValue(result)).toBe("#FFFFFF");

    actions[action]!(result);
    expect(onChangeSpy).not.toHaveBeenCalled();
  });

  it.each([{ action: "decrement" }, { action: "decrementToMin" }])("should not call onChange on $action when value is already at min", function ({ action }) {
    let onChangeSpy = jest.fn();
    let props = { defaultValue: "#000", onChange: onChangeSpy };
    let result = createColorFieldState(props);
    expect(colorValue(result)!.getChannelValue("red")).toBe(0);
    expect(colorValue(result)!.getChannelValue("green")).toBe(0);
    expect(colorValue(result)!.getChannelValue("blue")).toBe(0);
    expect(colorValue(result)!.getChannelValue("alpha")).toBe(1);
    expect(inputValue(result)).toBe("#000000");

    actions[action]!(result);
    expect(onChangeSpy).not.toHaveBeenCalled();
  });

  it("should not call onChange when new value has the same color value", function () {
    let onChangeSpy = jest.fn();
    let props = { defaultValue: "#BBB", minValue: "#BBB", onChange: onChangeSpy };
    let result = createColorFieldState(props);
    expect(colorValue(result)!.getChannelValue("red")).toBe(187);
    expect(colorValue(result)!.getChannelValue("green")).toBe(187);
    expect(colorValue(result)!.getChannelValue("blue")).toBe(187);
    expect(colorValue(result)!.getChannelValue("alpha")).toBe(1);
    expect(inputValue(result)).toBe("#BBBBBB");

    setInputValue(result, "#BBBBBB");
    expect(onChangeSpy).not.toHaveBeenCalled();
  });
});

describe("Rivet additions", function () {
  it("two-way signal value: commit writes the signal, outside writes reformat the input", function () {
    let value = signal<string | null>("#abc");
    let result = createColorFieldState({ value });
    setInputValue(result, "#cba");
    commit(result);
    expect(untrack(value)).toBe("rgba(204, 187, 170, 1)");
    expect(inputValue(result)).toBe("#CCBBAA");
    setInputValue(result, "12");
    value.set("#00ff00");
    expect(inputValue(result)).toBe("#00FF00");
  });

  it("resume-table round trip keeps value and typed input", function () {
    let result = createColorFieldState({ defaultValue: "#abc" });
    setInputValue(result, "#12");
    let decoded = jsonRoundTrip(result);
    expect(inputValue(decoded)).toBe("#12");
    expect(colorValue(decoded)!.toString("hex")).toBe("#AABBCC");
    setInputValue(decoded, "#123456");
    commit(decoded);
    expect(colorValue(decoded)!.toString("hex")).toBe("#123456");
    expect(inputValue(decoded)).toBe("#123456");
  });
});
