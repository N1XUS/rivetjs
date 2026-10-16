// Ported from react-stately test/slider/useSliderState.test.js (react-spectrum, Apache-2.0, © Adobe).
// Changes: `renderHook(() => useSliderState(props))` → `createSliderState(props)`; `result.current.x(...)` →
// free functions (`getThumbValue(state, 0)`, …), `result.current.values` → `sliderValues(state)`; `act`
// dropped; `numberFormatter: new Intl.NumberFormat(locale, options)` → `locale` + `formatOptions`; Jest
// globals from @rivetjs/testing/jest.
// Rivet additions: two-way signal value, scalar values, resume-table round trip, free drag position (`snap`).
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
  createSliderState,
  decrementThumb,
  endThumbSnap,
  getFormattedValue,
  getThumbMaxValue,
  getThumbMinValue,
  getThumbPercent,
  getThumbPositionPercent,
  getThumbValue,
  getThumbValueLabel,
  getValuePercent,
  incrementThumb,
  isThumbDragging,
  isThumbSnapping,
  setThumbDragPercent,
  setThumbDragging,
  setThumbEditable,
  setThumbPercent,
  setThumbValue,
  sliderValues,
} from "../slider/state.ts";
import { jsonRoundTrip } from "./state-json.ts";

describe("useSliderState", () => {
  it("should allow setting and reading values, percentages, and labels", () => {
    let formatOptions = {
      style: "currency",
      currency: "USD",
    } as const;
    let result = createSliderState({
      defaultValue: [50],
      minValue: 10,
      maxValue: 200,
      step: 10,
      locale: "en-US",
      formatOptions,
    });

    expect(getThumbValue(result, 0)).toBe(50);
    expect(getThumbPercent(result, 0)).toBe(40 / 190);
    expect(getValuePercent(result, 50)).toBe(40 / 190);
    expect(getThumbValueLabel(result, 0)).toBe("$50.00");

    setThumbValue(result, 0, 100);
    expect(getThumbValue(result, 0)).toBe(100);
    expect(getThumbPercent(result, 0)).toBe(90 / 190);
    expect(getThumbValueLabel(result, 0)).toBe("$100.00");

    setThumbValue(result, 0, 500);
    expect(getThumbValue(result, 0)).toBe(200);
    expect(getThumbPercent(result, 0)).toBe(1);
    expect(getThumbValueLabel(result, 0)).toBe("$200.00");

    setThumbValue(result, 0, 0);
    expect(getThumbValue(result, 0)).toBe(10);
    expect(getThumbPercent(result, 0)).toBe(0);
    expect(getThumbValueLabel(result, 0)).toBe("$10.00");

    setThumbValue(result, 0, 7);
    expect(getThumbValue(result, 0)).toBe(10);
    expect(getThumbPercent(result, 0)).toBe(0);
    expect(getThumbValueLabel(result, 0)).toBe("$10.00");

    setThumbPercent(result, 0, 0.13);
    expect(getThumbValue(result, 0)).toBe(30);
    expect(getThumbPercent(result, 0)).toBe(20 / 190);
  });

  it("should enforce maxValue and minValue for multiple thumbs", () => {
    let result = createSliderState({
      defaultValue: [50, 70, 90],
      minValue: 10,
      maxValue: 200,
    });

    expect(sliderValues(result)).toEqual([50, 70, 90]);

    expect(getThumbMinValue(result, 0)).toBe(10);
    expect(getThumbMaxValue(result, 0)).toBe(70);

    expect(getThumbMinValue(result, 1)).toBe(50);
    expect(getThumbMaxValue(result, 1)).toBe(90);

    expect(getThumbMinValue(result, 2)).toBe(70);
    expect(getThumbMaxValue(result, 2)).toBe(200);

    setThumbValue(result, 1, 80);
    expect(sliderValues(result)).toEqual([50, 80, 90]);
    expect(getThumbMinValue(result, 2)).toBe(80);

    setThumbValue(result, 1, 100);
    expect(sliderValues(result)).toEqual([50, 90, 90]);
    expect(getThumbMinValue(result, 2)).toBe(90);
  });

  it("should round values to nearest step with two thumbs", () => {
    let result = createSliderState({
      minValue: 1,
      maxValue: 15,
      step: 2.5,
      defaultValue: [1, 13],
    });

    expect(sliderValues(result)).toEqual([1, 13.5]);
    expect(getThumbMinValue(result, 1)).toBe(1);

    setThumbValue(result, 0, 3);
    expect(sliderValues(result)).toEqual([3.5, 13.5]);
    expect(getThumbMinValue(result, 1)).toBe(3.5);
    expect(getThumbMaxValue(result, 0)).toBe(13.5);

    setThumbValue(result, 1, 5);
    expect(sliderValues(result)).toEqual([3.5, 6]);
    expect(getThumbMaxValue(result, 0)).toBe(6);
  });

  it("should round values to nearest step with three thumbs", () => {
    let result = createSliderState({
      minValue: 1,
      maxValue: 15,
      step: 2.5,
      defaultValue: [1, 6, 13],
    });

    expect(sliderValues(result)).toEqual([1, 6, 13.5]);
    expect(getThumbMinValue(result, 1)).toBe(1);
    expect(getThumbMinValue(result, 2)).toBe(6);

    setThumbValue(result, 0, 3);
    expect(sliderValues(result)).toEqual([3.5, 6, 13.5]);
    expect(getThumbMinValue(result, 2)).toBe(6);
    expect(getThumbMinValue(result, 1)).toBe(3.5);
    expect(getThumbMaxValue(result, 0)).toBe(6);
    expect(getThumbMaxValue(result, 1)).toBe(13.5);

    setThumbValue(result, 2, 5);
    expect(sliderValues(result)).toEqual([3.5, 6, 6]);
    expect(getThumbMaxValue(result, 0)).toBe(6);
    expect(getThumbMaxValue(result, 1)).toBe(6);
  });

  it("should call onChange and onChangeEnd appropriately", () => {
    let onChangeEndSpy = jest.fn();
    let onChangeSpy = jest.fn();
    let result = createSliderState({
      onChangeEnd: onChangeEndSpy,
      onChange: onChangeSpy,
    });

    expect(sliderValues(result)).toEqual([0]);
    setThumbDragging(result, 0, true);
    setThumbValue(result, 0, 50);
    setThumbDragging(result, 0, false);
    expect(onChangeSpy).toHaveBeenLastCalledWith([50]);
    expect(onChangeEndSpy).toHaveBeenLastCalledWith([50]);

    onChangeEndSpy.mockClear();

    setThumbDragging(result, 0, true);
    expect(isThumbDragging(result, 0)).toBe(true);
    setThumbValue(result, 0, 55);
    expect(onChangeSpy).toHaveBeenLastCalledWith([55]);
    expect(onChangeEndSpy).not.toHaveBeenCalled();
    setThumbValue(result, 0, 60);
    expect(onChangeSpy).toHaveBeenLastCalledWith([60]);
    expect(onChangeEndSpy).not.toHaveBeenCalled();
    setThumbValue(result, 0, 65);
    setThumbDragging(result, 0, false);
    expect(onChangeSpy).toHaveBeenLastCalledWith([65]);
    expect(onChangeEndSpy).toHaveBeenLastCalledWith([65]);
  });

  it("should not call onChange and onChangeEnd if not being moved", () => {
    let onChangeEndSpy = jest.fn();
    let onChangeSpy = jest.fn();
    let result = createSliderState({
      onChangeEnd: onChangeEndSpy,
      onChange: onChangeSpy,
    });

    expect(sliderValues(result)).toEqual([0]);
    setThumbValue(result, 0, 0);
    expect(onChangeSpy).not.toHaveBeenCalled();
    expect(onChangeEndSpy).not.toHaveBeenCalled();
  });
});

describe("Rivet additions", () => {
  it("number value / defaultValue: onChange gets a number; two-way signal written", () => {
    let value = signal(20);
    let onChange = jest.fn();
    let result = createSliderState({ value, onChange });
    incrementThumb(result, 0, 10);
    expect(untrack(value)).toBe(30);
    expect(onChange).toHaveBeenLastCalledWith(30);
    decrementThumb(result, 0);
    expect(untrack(value)).toBe(29);
    value.set(75);
    expect(getThumbValue(result, 0)).toBe(75);
  });

  it("fixed controlled value: onChange only", () => {
    let onChange = jest.fn();
    let result = createSliderState({ value: [10, 20], onChange });
    setThumbValue(result, 1, 30);
    expect(onChange).toHaveBeenLastCalledWith([10, 30]);
    expect(sliderValues(result)).toEqual([10, 20]);
    expect(result.defaultValues).toEqual([10, 20]);
  });

  it("non-editable / disabled thumbs ignore writes; formats ranges and lists", () => {
    let result = createSliderState({ defaultValue: [10, 20, 30], locale: "en-US" });
    setThumbEditable(result, 0, false);
    setThumbValue(result, 0, 15);
    expect(sliderValues(result)).toEqual([10, 20, 30]);
    expect(getFormattedValue(result)).toBe("10, 20, 30");
    expect(getFormattedValue(result, [1, 5])).toBe("1–5");
    let disabled = createSliderState({ defaultValue: 5, isDisabled: true });
    setThumbValue(disabled, 0, 6);
    expect(getThumbValue(disabled, 0)).toBe(5);
    expect(disabled.pageSize).toBe(10);
  });

  it("resume-table round trip keeps values, drag and editable flags", () => {
    let result = createSliderState({ defaultValue: [10, 40], minValue: 0, maxValue: 50, step: 5, locale: "de-DE", formatOptions: { style: "percent" } });
    setThumbDragging(result, 1, true);
    setThumbValue(result, 1, 42);
    setThumbEditable(result, 0, false);
    let decoded = jsonRoundTrip(result);
    expect(sliderValues(decoded)).toEqual([10, 40]);
    expect(isThumbDragging(decoded, 1)).toBe(true);
    setThumbValue(decoded, 0, 20);
    expect(getThumbValue(decoded, 0)).toBe(10);
    setThumbValue(decoded, 1, 46);
    expect(sliderValues(decoded)).toEqual([10, 45]);
    expect(getThumbValueLabel(decoded, 1)).toBe("4.500\u00a0%");
  });

  it("format override (RA ColorSliderState getThumbValueLabel / getFormattedValue): default value param only", () => {
    let base = createSliderState({ defaultValue: [10, 20], locale: "en-US" });
    let result = { ...base, format: { formattedValue: () => "custom", thumbValueLabel: (index: number) => `thumb ${index}` } };
    expect(getFormattedValue(result)).toBe("custom");
    expect(getThumbValueLabel(result, 1)).toBe("thumb 1");
    expect(getFormattedValue(result, [1, 5])).toBe("1–5");
    expect(getFormattedValue(base)).toBe("10–20");
  });
});

describe('Rivet: snap="release" free drag position', () => {
  it("free position during a drag, stepped value; snap on release; resume round trip", () => {
    let result = createSliderState({ defaultValue: [20, 50], step: 10 });
    expect(result.snap).toBe("release");
    expect(getThumbPositionPercent(result, 1)).toBe(0.5);
    setThumbDragging(result, 1, true);
    setThumbPercent(result, 1, 0.37);
    setThumbDragPercent(result, 1, 0.37);
    expect(sliderValues(result)).toEqual([20, 40]);
    expect(getThumbPositionPercent(result, 1)).toBe(0.37);
    // clamped to the neighbouring thumb
    setThumbDragPercent(result, 1, 0.05);
    expect(getThumbPositionPercent(result, 1)).toBe(0.2);
    setThumbDragPercent(result, 1, 0.37);

    let decoded = jsonRoundTrip(result);
    expect(getThumbPositionPercent(decoded, 1)).toBe(0.37);

    // No requestAnimationFrame (node): release jumps to the step.
    setThumbDragging(result, 1, false);
    expect(getThumbPositionPercent(result, 1)).toBe(0.4);
    expect(isThumbSnapping(result, 1)).toBe(false);
  });

  it("release animates through Motion1D frames (requestAnimationFrame), then ends; endThumbSnap stops it", () => {
    const callbacks: FrameRequestCallback[] = [];
    let now = 0;
    const g = globalThis as Record<string, unknown>;
    const saved = [g.requestAnimationFrame, g.cancelAnimationFrame];
    g.requestAnimationFrame = (cb: FrameRequestCallback) => callbacks.push(cb);
    g.cancelAnimationFrame = () => {};
    const step = () => {
      now += 16;
      const pending = callbacks.splice(0);
      for (const cb of pending) cb(now);
    };
    try {
      let result = createSliderState({ defaultValue: [20, 50], step: 10 });
      setThumbDragging(result, 1, true);
      setThumbPercent(result, 1, 0.37);
      setThumbDragPercent(result, 1, 0.37);
      setThumbDragging(result, 1, false);
      expect(isThumbSnapping(result, 1)).toBe(true);
      expect(getThumbPositionPercent(result, 1)).toBe(0.37);
      step();
      step();
      step();
      const mid = getThumbPositionPercent(result, 1);
      expect(mid).toBeGreaterThan(0.37);
      expect(mid).toBeLessThan(0.4);
      for (let i = 0; i < 200 && isThumbSnapping(result, 1); i++) step();
      expect(isThumbSnapping(result, 1)).toBe(false);
      expect(getThumbPositionPercent(result, 1)).toBe(0.4);

      setThumbDragging(result, 1, true);
      setThumbDragPercent(result, 1, 0.43);
      setThumbDragging(result, 1, false);
      expect(isThumbSnapping(result, 1)).toBe(true);
      endThumbSnap(result, 1);
      expect(isThumbSnapping(result, 1)).toBe(false);
      expect(getThumbPositionPercent(result, 1)).toBe(0.4);
      step();
      expect(getThumbPositionPercent(result, 1)).toBe(0.4);
    } finally {
      [g.requestAnimationFrame, g.cancelAnimationFrame] = saved;
    }
  });

  it('snap="drag": no free position', () => {
    let result = createSliderState({ defaultValue: [20], step: 10, snap: "drag" });
    setThumbDragging(result, 0, true);
    setThumbPercent(result, 0, 0.37);
    setThumbDragPercent(result, 0, 0.37);
    expect(getThumbPositionPercent(result, 0)).toBe(0.4);
    setThumbDragging(result, 0, false);
    expect(isThumbSnapping(result, 0)).toBe(false);
  });
});
