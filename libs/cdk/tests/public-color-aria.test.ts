// Public React Aria color handler bags: custom markup gets the same channel and ARIA state.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";
import { createColorAreaState, createColorSliderState, createColorWheelState, getValue } from "@rivetjs/cdk/color";
import { colorAreaProps, createColorAreaInteraction } from "@rivetjs/cdk/color-area/behaviour";
import { colorSliderProps, createColorSliderInteraction } from "@rivetjs/cdk/color-slider/behaviour";
import { colorWheelProps, createColorWheelInteraction } from "@rivetjs/cdk/color-wheel/behaviour";

installDom();

test("color area names both axes, associates form fields and suppresses disabled interaction", () => {
  const state = createColorAreaState({ defaultValue: "hsl(0, 50%, 50%)", xChannel: "saturation", yChannel: "lightness" });
  const props = {
    locale: "en-US",
    direction: "ltr" as const,
    interaction: createColorAreaInteraction(),
    inputXRef: () => undefined,
    inputYRef: () => undefined,
    containerRef: () => undefined,
    xName: "saturation",
    yName: "lightness",
    form: "editor",
    "aria-label": "Color",
    isDisabled: true,
  };
  const bags = colorAreaProps(props, state);
  assert.equal(bags.colorAreaProps.role, "group");
  assert.equal(bags.xInputProps.name, "saturation");
  assert.equal(bags.yInputProps.name, "lightness");
  assert.equal(bags.xInputProps.form, "editor");
  assert.equal(bags.xInputProps["aria-orientation"], "horizontal");
  assert.equal(bags.yInputProps["aria-orientation"], "vertical");
  assert.equal(bags.xInputProps.disabled, true);
  assert.equal(bags.yInputProps.disabled, true);
  assert.equal(bags.thumbProps.onKeyDown, undefined);
  assert.equal(bags.colorAreaProps.onPointerDown, undefined);
});

test("color slider bag exposes channel bounds and its change handler writes the channel", () => {
  const state = createColorSliderState({ locale: "en-US", defaultValue: "hsl(120, 50%, 50%)", channel: "hue" });
  const input = document.createElement("input");
  input.type = "range";
  input.max = "360";
  const props = {
    locale: "en-US",
    direction: "ltr" as const,
    interaction: createColorSliderInteraction(),
    inputRef: () => input,
    trackRef: () => undefined,
    channel: "hue" as const,
    name: "hue",
    "aria-label": "Hue",
  };
  const bags = colorSliderProps(props, state);
  assert.equal(String((bags.inputProps.min as () => number)()), "0");
  assert.equal(String((bags.inputProps.max as () => number)()), "360");
  assert.equal(String((bags.inputProps.value as () => number)()), "120");
  input.addEventListener("change", bags.inputProps.onChange as EventListener);
  input.value = "240";
  input.dispatchEvent(new Event("change"));
  assert.equal(getValue(state).getChannelValue("hue"), 240);
});

test("color wheel bag forwards ARIA details and updates hue from a native range input", () => {
  const state = createColorWheelState({ defaultValue: "hsl(120, 50%, 50%)" });
  const input = document.createElement("input");
  input.type = "range";
  input.max = "360";
  const props = {
    locale: "en-US",
    interaction: createColorWheelInteraction(),
    inputRef: () => input,
    innerRadius: 40,
    outerRadius: 50,
    name: "hue",
    "aria-describedby": "help",
    "aria-errormessage": "error",
  };
  const bags = colorWheelProps(props, state);
  assert.equal(bags.inputProps.name, "hue");
  assert.equal(bags.inputProps["aria-describedby"], "help");
  assert.equal(bags.inputProps["aria-errormessage"], "error");
  assert.equal(bags.inputProps.type, "range");
  input.addEventListener("change", bags.inputProps.onChange as EventListener);
  input.value = "300";
  input.dispatchEvent(new Event("change"));
  assert.equal(getValue(state).getChannelValue("hue"), 300);
  const disabled = colorWheelProps({ ...props, isDisabled: true }, state);
  assert.equal(disabled.inputProps.disabled, true);
  assert.equal(disabled.trackProps.onPointerDown, undefined);
  assert.equal(disabled.thumbProps.onKeyDown, undefined);
});
