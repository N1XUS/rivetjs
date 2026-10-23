// Tests for the color states ported from react-stately src/color (useColorAreaState, useColorSliderState,
// useColorWheelState, useColorChannelFieldState, useColorPickerState). react-stately has no direct tests for
// these hooks (only Color / useColor / useColorFieldState, see color-model.test.ts, color-field-state.test.ts);
// the cases follow the hook implementations and the keyboard / pointer expectations of react-aria
// test/color/{useColorArea,useColorSlider,useColorWheel,useColorField}.test.tsx.
import { describe, expect, it, jest } from "@rivetjs/testing/jest";
import { signal, untrack } from "@rivetjs/reactivity";
import {
  colorValue,
  createColorAreaState,
  createColorChannelFieldState,
  createColorPickerState,
  createColorSliderState,
  createColorWheelState,
  decrement,
  decrementX,
  decrementY,
  defaultColorValue,
  getChannels,
  getChannelSteps,
  getColor,
  getDefaultValue,
  getDisplayColor,
  getFormattedValue,
  getHue,
  getThumbPosition,
  getThumbValueLabel,
  getValue,
  getXValue,
  getYValue,
  increment,
  incrementX,
  incrementY,
  isDragging,
  numberFieldView,
  parseColor,
  setColor,
  setColorFromPoint,
  setColorValue,
  setDragging,
  setHue,
  setHueFromPoint,
  setValue,
  setXValue,
  sliderView,
} from "../color/index.ts";
import { decrementThumb, getThumbValue, setThumbDragging, setThumbPercent, setThumbValue } from "../slider/state.ts";
import { commit, increment as incrementNumber, inputValue, setInputValue } from "../number/index.tsx";

describe("createColorAreaState", () => {
  it("defaults to white in rgb with red / green axes", () => {
    let state = createColorAreaState({});
    expect(getValue(state).toString("hex")).toBe("#FFFFFF");
    expect(getChannels(state)).toEqual({ xChannel: "red", yChannel: "green", zChannel: "blue" });
    expect(getChannelSteps(state)).toEqual({ xChannelStep: 1, yChannelStep: 1, xChannelPageStep: 0x11, yChannelPageStep: 0x11 });
    expect(getThumbPosition(state)).toEqual({ x: 1, y: 0 });
  });

  it("converts to colorSpace and picks the remaining channels", () => {
    let state = createColorAreaState({ defaultValue: "#ff0000", colorSpace: "hsb", xChannel: "saturation" });
    expect(getValue(state).getColorSpace()).toBe("hsb");
    expect(getChannels(state)).toEqual({ xChannel: "saturation", yChannel: "hue", zChannel: "brightness" });
    expect(getXValue(state)).toBe(100);
    expect(getYValue(state)).toBe(0);
  });

  it("sets values from points (snapped), increments / decrements, fires onChange / onChangeEnd", () => {
    let onChange = jest.fn();
    let onChangeEnd = jest.fn();
    let state = createColorAreaState({ defaultValue: "hsl(0, 50%, 50%)", xChannel: "saturation", yChannel: "lightness", onChange, onChangeEnd });
    setDragging(state, true);
    expect(isDragging(state)).toBe(true);
    setColorFromPoint(state, 0.255, 0.255);
    expect(getXValue(state)).toBe(26);
    expect(getYValue(state)).toBe(75);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]![0].toString("hsl")).toBe("hsl(0, 26%, 75%)");
    incrementX(state, 10);
    incrementY(state);
    expect(getXValue(state)).toBe(36);
    expect(getYValue(state)).toBe(76);
    incrementY(state, 50);
    expect(getYValue(state)).toBe(100);
    decrementX(state, 40);
    decrementY(state);
    expect(getXValue(state)).toBe(0);
    expect(getYValue(state)).toBe(99);
    expect(onChangeEnd).not.toHaveBeenCalled();
    setDragging(state, false);
    expect(onChangeEnd).toHaveBeenCalledTimes(1);
    expect(onChangeEnd.mock.calls[0]![0].toString("hsl")).toBe("hsl(0, 0%, 99%)");
    setXValue(state, 0);
    expect(onChange).toHaveBeenCalledTimes(6);
    expect(getDisplayColor(setAlpha(state)).getChannelValue("alpha")).toBe(1);
  });

  it("two-way signal: writes the lossless string, follows outside writes", () => {
    let value = signal<string>("#000000");
    let state = createColorAreaState({ value });
    setXValue(state, 255);
    expect(untrack(value)).toBe("rgba(255, 0, 0, 1)");
    value.set("#00ff00");
    expect(getYValue(state)).toBe(255);
    expect(getDefaultValue(state).toString("hex")).toBe("#000000");
  });
});

function setAlpha<T extends Parameters<typeof setValue>[0]>(state: T): T {
  setValue(state, getValue(state).withChannelValue("alpha", 0.5));
  return state;
}

describe("createColorSliderState", () => {
  it("requires a value or defaultValue", () => {
    expect(() => createColorSliderState({ channel: "hue", locale: "en-US" })).toThrow("useColorSliderState requires a value or defaultValue");
  });

  it("maps slider writes to the channel; labels, display color, steps", () => {
    let onChange = jest.fn();
    let onChangeEnd = jest.fn();
    let state = createColorSliderState({ defaultValue: "hsl(0, 100%, 50%)", channel: "hue", locale: "en-US", onChange, onChangeEnd });
    expect(state.step).toBe(1);
    expect(state.pageSize).toBe(15);
    expect(getThumbValueLabel(state)).toBe("0°");
    setThumbDragging(sliderView(state), 0, true);
    expect(isDragging(state)).toBe(true);
    setThumbValue(sliderView(state), 0, 120);
    expect(getValue(state).toString("hsl")).toBe("hsl(120, 100%, 50%)");
    expect(onChange.mock.calls[0]![0].toString("hsl")).toBe("hsl(120, 100%, 50%)");
    setThumbPercent(sliderView(state), 0, 0.5);
    expect(getThumbValue(sliderView(state), 0)).toBe(180);
    setThumbDragging(sliderView(state), 0, false);
    expect(onChangeEnd).toHaveBeenCalledTimes(1);
    expect(onChangeEnd.mock.calls[0]![0].toString("hsl")).toBe("hsl(180, 100%, 50%)");
    expect(getFormattedValue(state)).toBe("180°");
    expect(getDisplayColor(state).toString("hsl")).toBe("hsl(180, 100%, 50%)");
    setValue(state, "hsla(10, 20%, 30%, 0.5)");
    expect(getDisplayColor(state).toString("hsla")).toBe("hsla(10, 100%, 50%, 1)");
  });

  it("alpha / percent channels, colorSpace conversion", () => {
    let state = createColorSliderState({ defaultValue: "#ff000080", channel: "alpha", locale: "de-DE" });
    expect(getThumbValueLabel(state)).toBe("50 %");
    expect(getDisplayColor(state).getChannelValue("alpha")).toBeCloseTo(0.5, 2);
    let saturation = createColorSliderState({ defaultValue: "#ff0000", channel: "saturation", colorSpace: "hsb", locale: "en-US" });
    expect(getValue(saturation).getColorSpace()).toBe("hsb");
    decrementThumb(sliderView(saturation), 0, 5);
    expect(getValue(saturation).getChannelValue("saturation")).toBe(95);
  });
});

describe("createColorWheelState", () => {
  it("defaults to hsl red; rgb values convert to hsl", () => {
    expect(getValue(createColorWheelState({})).toString("hsl")).toBe("hsl(0, 100%, 50%)");
    let state = createColorWheelState({ defaultValue: "#00ff00" });
    expect(getValue(state).getColorSpace()).toBe("hsl");
    expect(getHue(state)).toBe(120);
    expect(state.step).toBe(1);
    expect(state.pageStep).toBe(15);
  });

  it("wraps the hue on increment / decrement and from points", () => {
    let onChange = jest.fn();
    let onChangeEnd = jest.fn();
    let state = createColorWheelState({ defaultValue: "hsl(359, 100%, 50%)", onChange, onChangeEnd });
    increment(state);
    expect(getHue(state)).toBe(0);
    decrement(state);
    expect(getHue(state)).toBe(359);
    setHue(state, 0);
    decrement(state, 15);
    expect(getHue(state)).toBe(345);
    increment(state, 15);
    expect(getHue(state)).toBe(0);
    setHue(state, 361);
    expect(getHue(state)).toBe(0);
    setHue(state, -10);
    expect(getHue(state)).toBe(350);
    setDragging(state, true);
    setHueFromPoint(state, 0, 10, 10);
    expect(getHue(state)).toBe(90);
    setDragging(state, false);
    expect(onChangeEnd.mock.calls[0]![0].getChannelValue("hue")).toBe(90);
    let { x, y } = getThumbPosition(state, 10);
    expect(x).toBeCloseTo(0, 10);
    expect(y).toBeCloseTo(10, 10);
    expect(getDisplayColor(state).toString("hsla")).toBe("hsla(90, 100%, 50%, 1)");
    expect(state.isDisabled).toBe(false);
  });
});

describe("createColorChannelFieldState", () => {
  it("edits one channel through the number field; percent channels as 0-1", () => {
    let onChange = jest.fn();
    let state = createColorChannelFieldState({ defaultValue: "hsl(10, 20%, 30%)", channel: "saturation", locale: "en-US", onChange });
    expect(state.multiplier).toBe(100);
    expect(inputValue(numberFieldView(state))).toBe("20%");
    setInputValue(numberFieldView(state), "45%");
    commit(numberFieldView(state));
    expect(colorValue(state).toString("hsl")).toBe("hsl(10, 45%, 30%)");
    expect(onChange.mock.calls[0]![0].toString("hsl")).toBe("hsl(10, 45%, 30%)");
    expect(inputValue(numberFieldView(state))).toBe("45%");
    incrementNumber(numberFieldView(state));
    expect(colorValue(state).getChannelValue("saturation")).toBe(46);
    setInputValue(numberFieldView(state), "");
    commit(numberFieldView(state));
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(colorValue(state).toString("hex")).toBe("#000000");
    expect(defaultColorValue(state)!.toString("hsl")).toBe("hsl(10, 20%, 30%)");
  });

  it("converts to colorSpace; outside value writes reformat the input", () => {
    let value = signal<string | null>("#ff0000");
    let state = createColorChannelFieldState({ value, channel: "hue", colorSpace: "hsb", locale: "en-US" });
    expect(inputValue(numberFieldView(state))).toBe("0°");
    value.set("#00ff00");
    expect(inputValue(numberFieldView(state))).toBe("120°");
    setColorValue(state, parseColor("hsb(240, 100%, 100%)"));
    expect(untrack(value)).toBe("hsba(240, 100%, 100%, 1)");
  });
});

describe("createColorPickerState", () => {
  it("defaults to black, ignores null, fires onChange", () => {
    let onChange = jest.fn();
    let state = createColorPickerState({ onChange });
    expect(getColor(state).toString("hex")).toBe("#000000");
    setColor(state, null);
    expect(onChange).not.toHaveBeenCalled();
    setColor(state, parseColor("#abc"));
    expect(getColor(state).toString("hex")).toBe("#AABBCC");
    expect(onChange).toHaveBeenCalledTimes(1);
    let invalid = createColorPickerState({ value: "nope", defaultValue: "#123456" });
    expect(getColor(invalid).toString("hex")).toBe("#123456");
  });
});
