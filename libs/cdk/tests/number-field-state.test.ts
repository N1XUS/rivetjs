// Ported from react-stately test/numberfield/useNumberFieldState.test.ts (react-spectrum, Apache-2.0, © Adobe).
// Changes: `renderHook` + `rerender({formatOptions})` -> `createNumberFieldState` with `formatOptions` as an accessor
// over a signal (a re-render with new props = writing the signal); Jest globals from @rivetjs/testing/jest.
// Rivet additions (below the upstream suite): commit / increment / decrement / controlled-value cases from the
// upstream hook implementation (useNumberFieldState.ts) and react-aria useNumberField tests.
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
import { _inspect, computed, signal, untrack, type Signal } from "@rivetjs/reactivity";
import { createDecoder, createEncoder } from "@rivetjs/runtime/resume-format";
import {
  canDecrement,
  canIncrement,
  commit,
  createNumberFieldState,
  decrement,
  decrementToMin,
  increment,
  incrementToMax,
  inputValue,
  numberValue,
  setInputValue,
  validate,
} from "../number/index.tsx";
import { displayValidation } from "../state/form-validation.ts";

describe("useNumberFieldState", () => {
  describe("formatOptions stability", () => {
    it("does not reset inputValue when re-rendered with same formatOptions content", () => {
      let initialFormatOptions = {
        style: "unit",
        unit: "millisecond",
        useGrouping: false,
      } as Intl.NumberFormatOptions;
      let formatOptions = signal<Intl.NumberFormatOptions | undefined>(initialFormatOptions);
      let result = createNumberFieldState({ defaultValue: 1, formatOptions: () => formatOptions(), locale: "en-US" });

      // Simulate user typing '2' (without committing)
      setInputValue(result, "2");
      expect(inputValue(result)).toBe("2");

      // Re-render with new-reference but same-content formatOptions (simulates inline object literal)
      formatOptions.set({
        style: "unit",
        unit: "millisecond",
        useGrouping: false,
      } as Intl.NumberFormatOptions);

      // inputValue should NOT be reset to '1' (the formatted defaultValue)
      expect(inputValue(result)).toBe("2");
    });

    it("resets inputValue when formatOptions content actually changes", () => {
      let formatOptions = signal<Intl.NumberFormatOptions | undefined>({ style: "currency", currency: "EUR" });
      let result = createNumberFieldState({ defaultValue: 1024, formatOptions: () => formatOptions(), locale: "en-US" });

      expect(inputValue(result)).toBe("€1,024.00");

      formatOptions.set({ style: "currency", currency: "USD" });

      expect(inputValue(result)).toBe("$1,024.00");
    });

    it("does not reset inputValue when re-rendered with undefined formatOptions", () => {
      let formatOptions = signal<Intl.NumberFormatOptions | undefined>(undefined);
      let result = createNumberFieldState({ defaultValue: 1, formatOptions: () => formatOptions(), locale: "en-US" });

      setInputValue(result, "2");
      expect(inputValue(result)).toBe("2");

      formatOptions.set(undefined);

      expect(inputValue(result)).toBe("2");
    });
  });

  describe("Rivet: state behaviour", () => {
    it("formats the default value and reports the default number value", () => {
      let state = createNumberFieldState({ defaultValue: 1234.5, locale: "de-DE" });
      expect(inputValue(state)).toBe("1.234,5");
      expect(numberValue(state)).toBe(1234.5);
      expect(state.defaultNumberValue).toBe(1234.5);
    });

    it("snaps the default value to step and clamps it to min/max", () => {
      expect(numberValue(createNumberFieldState({ defaultValue: 7, step: 5, locale: "en-US" }))).toBe(5);
      expect(numberValue(createNumberFieldState({ defaultValue: 120, maxValue: 100, locale: "en-US" }))).toBe(100);
      expect(numberValue(createNumberFieldState({ defaultValue: 120, maxValue: 100, commitBehavior: "validate", locale: "en-US" }))).toBe(120);
    });

    it("commit parses, snaps and reformats the input, firing onChange", () => {
      let onChange = jest.fn();
      let state = createNumberFieldState({ defaultValue: 1, minValue: 0, maxValue: 10, step: 0.5, onChange, locale: "en-US" });
      setInputValue(state, "7.3");
      expect(numberValue(state)).toBe(7.3);
      commit(state);
      expect(inputValue(state)).toBe("7.5");
      expect(numberValue(state)).toBe(7.5);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenLastCalledWith(7.5);

      commit(state, "42");
      expect(inputValue(state)).toBe("10");
      expect(onChange).toHaveBeenLastCalledWith(10);
    });

    it("commit of an empty input clears the value; an unparsable input restores the current value", () => {
      let onChange = jest.fn();
      let state = createNumberFieldState({ defaultValue: 3, onChange, locale: "en-US" });
      setInputValue(state, "abc");
      commit(state);
      expect(inputValue(state)).toBe("3");
      expect(onChange).not.toHaveBeenCalled();

      setInputValue(state, "");
      commit(state);
      expect(inputValue(state)).toBe("");
      expect(numberValue(state)).toBeNaN();
      expect(onChange).toHaveBeenLastCalledWith(NaN);
    });

    it("increment / decrement step from the current value, starting at min/max (or 0) when empty", () => {
      let state = createNumberFieldState({ minValue: 2, maxValue: 9, step: 3, locale: "en-US" });
      expect(inputValue(state)).toBe("");
      increment(state);
      expect(inputValue(state)).toBe("2");
      increment(state);
      expect(inputValue(state)).toBe("5");
      setInputValue(state, "6");
      decrement(state);
      expect(inputValue(state)).toBe("5");
      incrementToMax(state);
      expect(inputValue(state)).toBe("8");
      expect(canIncrement(state)).toBe(false);
      expect(canDecrement(state)).toBe(true);
      decrementToMin(state);
      expect(inputValue(state)).toBe("2");
      expect(canDecrement(state)).toBe(false);

      let empty = createNumberFieldState({ locale: "en-US" });
      decrement(empty);
      expect(inputValue(empty)).toBe("0");
      decrement(empty);
      expect(inputValue(empty)).toBe("-1");
    });

    it("increment re-formats the input when the value does not change", () => {
      let state = createNumberFieldState({ defaultValue: 4, locale: "en-US" });
      increment(state);
      expect(inputValue(state)).toBe("5");
      setInputValue(state, "4");
      increment(state);
      expect(inputValue(state)).toBe("5");
    });

    it("percent fields step by 0.01 and decimals do not drift", () => {
      let percent = createNumberFieldState({ defaultValue: 0.5, formatOptions: { style: "percent" }, locale: "en-US" });
      expect(inputValue(percent)).toBe("50%");
      increment(percent);
      expect(inputValue(percent)).toBe("51%");
      expect(numberValue(percent)).toBe(0.51);

      let decimal = createNumberFieldState({ defaultValue: 0.2, step: 0.2, locale: "en-US" });
      increment(decimal);
      expect(numberValue(decimal)).toBe(0.4);
      increment(decimal);
      expect(numberValue(decimal)).toBe(0.6);
    });

    it("disabled / read-only fields cannot increment or decrement", () => {
      expect(canIncrement(createNumberFieldState({ defaultValue: 1, isDisabled: true, locale: "en-US" }))).toBe(false);
      expect(canDecrement(createNumberFieldState({ defaultValue: 1, isReadOnly: true, locale: "en-US" }))).toBe(false);
    });

    it("controlled value: writes go to the signal, external writes reformat the input", () => {
      let value = signal<number | null>(5);
      let onChange = jest.fn();
      let state = createNumberFieldState({ value, onChange, locale: "en-US" });
      expect(inputValue(state)).toBe("5");
      increment(state);
      expect(value()).toBe(6);
      expect(inputValue(state)).toBe("6");
      expect(onChange).toHaveBeenLastCalledWith(6);

      value.set(1000);
      expect(inputValue(state)).toBe("1,000");
      value.set(null);
      expect(inputValue(state)).toBe("");
      expect(numberValue(state)).toBeNaN();
    });

    it("bindings over inputValue re-run when the value, locale or format options change", () => {
      let value = signal<number | null>(5);
      let formatOptions = signal<Intl.NumberFormatOptions | undefined>(undefined);
      let state = createNumberFieldState({ value, formatOptions: () => formatOptions(), locale: "en-US" });
      let text = computed(() => inputValue(state));
      expect(text()).toBe("5");
      value.set(1234);
      expect(text()).toBe("1,234");
      formatOptions.set({ style: "currency", currency: "USD" });
      expect(text()).toBe("$1,234.00");
      increment(state);
      expect(value()).toBe(1235);
      expect(text()).toBe("$1,235.00");
    });

    it("locale changes reformat the input", () => {
      let locale = signal("en-US");
      let state = createNumberFieldState({ defaultValue: 1234.5, locale: () => locale() });
      expect(inputValue(state)).toBe("1,234.5");
      locale.set("de-DE");
      expect(inputValue(state)).toBe("1.234,5");
    });

    it("validate checks partial input against the locale and min/max", () => {
      let state = createNumberFieldState({ minValue: 0, locale: "en-US" });
      expect(validate(state, "12.")).toBe(true);
      expect(validate(state, "-")).toBe(false);
      expect(validate(state, "1a")).toBe(false);
      expect(validate(createNumberFieldState({ locale: "en-US" }), "-")).toBe(true);
    });

    it("keeps the numbering system the user typed in", () => {
      let state = createNumberFieldState({ locale: "en-US" });
      setInputValue(state, "٣");
      expect(numberValue(state)).toBe(3);
      increment(state);
      expect(inputValue(state)).toBe("٤");
    });

    it("commits validation on commit (native behaviour shows the custom error)", () => {
      let state = createNumberFieldState({
        defaultValue: 1,
        validationBehavior: "native",
        validate: (v) => (v > 5 ? "Too big" : null),
        locale: "en-US",
      });
      expect(displayValidation(state.validation).isInvalid).toBe(false);
      commit(state, "8");
      expect(displayValidation(state.validation).isInvalid).toBe(true);
      expect(displayValidation(state.validation).validationErrors).toEqual(["Too big"]);
    });
    it("validate receives the upstream numberValue: NaN for an empty controlled value (not null)", () => {
      let validateFn = jest.fn((v: number) => (isNaN(v) ? "Empty" : null));
      let value = signal<number | null>(null);
      let state = createNumberFieldState({ value, validate: validateFn, locale: "en-US" });
      expect(displayValidation(state.validation).validationErrors).toEqual(["Empty"]);
      expect(validateFn).toHaveBeenLastCalledWith(NaN);
      value.set(3);
      expect(displayValidation(state.validation).isInvalid).toBe(false);
      expect(validateFn).toHaveBeenLastCalledWith(3);
    });

    it("validate receives the snapped controlled value (commitBehavior snap)", () => {
      let validateFn = jest.fn((v: number) => (v > 10 ? "Too big" : null));
      let state = createNumberFieldState({ value: signal<number | null>(14), maxValue: 10, validate: validateFn, locale: "en-US" });
      expect(displayValidation(state.validation).isInvalid).toBe(false);
      expect(validateFn).toHaveBeenLastCalledWith(10);
    });

    it("plain controlled value: changes fire onChange, the value and input stay controlled", () => {
      let onChange = jest.fn();
      let state = createNumberFieldState({ value: 5, onChange, locale: "en-US" });
      increment(state);
      expect(onChange).toHaveBeenLastCalledWith(6);
      expect(inputValue(state)).toBe("5");
      commit(state, "9");
      expect(onChange).toHaveBeenLastCalledWith(9);
      expect(inputValue(state)).toBe("5");
    });

    it("resume shape: the state is signals + JSON and survives an encode / decode round trip", () => {
      let state = createNumberFieldState({ defaultValue: 2, minValue: 0, maxValue: 10, formatOptions: { style: "percent" }, locale: "de-DE" });
      setInputValue(state, "40 %");
      // Resume table encoding: signals by value (server-resume `special`), everything else plain; functions throw.
      let { ref, table } = createEncoder({
        special: (value, ref) => {
          let reactive = _inspect(value);
          return reactive?.kind === "signal" ? { s: ref(reactive.value) } : undefined;
        },
      });
      let root = ref(state);
      let decoded = createDecoder(JSON.parse(JSON.stringify(table)), { signal: () => signal<unknown>(undefined) as Signal<unknown> }).get(root) as typeof state;
      expect(untrack(decoded.value)).toBe(2);
      expect(inputValue(decoded)).toBe("40 %");
      expect(numberValue(decoded)).toBe(0.4);
      commit(decoded);
      expect(untrack(decoded.value)).toBe(0.4);
      expect(inputValue(decoded)).toBe("40\u00a0%");
      increment(decoded);
      expect(inputValue(decoded)).toBe("41\u00a0%");
      expect(decoded.defaultNumberValue).toBe(2);
    });
  });
});
