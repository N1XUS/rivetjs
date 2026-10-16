// Ported from react-aria-components test/ColorSwatch.test.js and test/ColorPicker.test.js (react-spectrum, Apache-2.0, © Adobe).
// Changes: `render` from `@rivetjs/runtime/testing` (Chromium); queries via `@testing-library/dom` `within(container)`;
// `className` → `class`; render props are accessors (`color()`); default class `rv-ColorSwatch`;
// `userEvent.setup({ delay: null, pointerMap })` → `userEvent.setup()`; `act()` dropped (synchronous bindings).
// Skipped: "should support custom render function" (now in the render-*.browser.test.tsx files).
// Rivet additions: an accessor `color` (ColorPicker), ColorPicker over a two-way Signal syncing all children.
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { ColorSwatch, ColorSwatchContext } from "../color-swatch/index.tsx";
import { ColorArea } from "../color-area/index.tsx";
import { ColorField } from "../color-field/index.tsx";
import { ColorPicker } from "../color-picker/index.tsx";
import { ColorSlider } from "../color-slider/index.tsx";
import { ColorThumb } from "../color-thumb/index.tsx";
import { ColorWheel } from "../color-wheel/index.tsx";
import { Input } from "../input/index.tsx";
import { SliderTrack } from "../slider/index.tsx";
import { toColor, type Color } from "../color/index.ts";

afterEach(cleanup);

const q = (fn: () => unknown) => within(render(fn as never).container as HTMLElement);

describe("ColorSwatch", () => {
  it("should render a swatch with default class", () => {
    const img = q(() => <ColorSwatch color="#f00" />).getByRole("img");
    expect(img).toHaveAttribute("class", "rv-ColorSwatch");
    expect(img).toHaveAttribute("aria-label", "vibrant red");
    expect(img).toHaveAttribute("aria-roledescription", "color swatch");
    expect(img).toHaveStyle({ backgroundColor: "#f00" });
  });

  it("should render a swatch with custom class", () => {
    expect(q(() => <ColorSwatch class="test" />).getByRole("img")).toHaveAttribute("class", "test");
  });

  it("should support DOM props", () => {
    expect(q(() => <ColorSwatch {...({ "data-foo": "bar" } as {})} />).getByRole("img")).toHaveAttribute("data-foo", "bar");
  });

  // RAC custom render function: covered in the render-*.browser.test.tsx files.

  it("should support render props", () => {
    const { getByTestId } = q(() => (
      <ColorSwatch color="#f00">{({ color }) => <div style={{ background: color().toString() }} data-testid="wrapper" />}</ColorSwatch>
    ));
    // Chromium computes the `background` shorthand with all its longhands (jsdom keeps the color): compare the color.
    expect(getByTestId("wrapper")).toHaveStyle({ backgroundColor: "#f00" });
  });

  it("should support slot", () => {
    const img = q(() => (
      <Provider token={ColorSwatchContext} value={{ slots: { test: { color: "#ff0" } } }}>
        <ColorSwatch slot="test" />
      </Provider>
    )).getByRole("img");
    expect(img).toHaveAttribute("aria-label", "very light vibrant yellow");
  });

  it("should support custom aria-label", () => {
    expect(q(() => <ColorSwatch color="#f00" aria-label="Background" />).getByRole("img")).toHaveAttribute("aria-label", "vibrant red, Background");
  });

  it("should support custom aria-labelledby", () => {
    const img = q(() => <ColorSwatch color="#f00" aria-labelledby="label-id" />).getByRole("img");
    expect(img).toHaveAttribute("aria-label", "vibrant red");
    expect(img).toHaveAttribute("id");
    expect(img).toHaveAttribute("aria-labelledby", `${img.id} label-id`);
  });

  it("should support custom colorName", () => {
    expect(q(() => <ColorSwatch color="#f00" colorName="Fire truck red" />).getByRole("img")).toHaveAttribute("aria-label", "Fire truck red");
  });

  // Rivet addition
  it("follows an accessor color", () => {
    const color = signal("#f00");
    const img = q(() => <ColorSwatch color={() => color()} />).getByRole("img");
    expect(img).toHaveAttribute("aria-label", "vibrant red");
    color.set("#00f");
    expect(img).toHaveAttribute("aria-label", "dark vibrant blue");
    expect(img).toHaveStyle({ backgroundColor: "#00f" });
  });
});

describe("ColorPicker", () => {
  let user: ReturnType<typeof userEvent.setup>;
  beforeAll(() => {
    user = userEvent.setup();
  });

  it("renders", async () => {
    const { getByRole, getAllByRole } = q(() => (
      <ColorPicker defaultValue="#f00">
        <ColorSwatch />
        <ColorArea colorSpace="hsb" xChannel="saturation" yChannel="brightness">
          <ColorThumb />
        </ColorArea>
        <ColorSlider colorSpace="hsb" channel="hue">
          <SliderTrack>
            <ColorThumb />
          </SliderTrack>
        </ColorSlider>
        <ColorField aria-label="hex">
          <Input />
        </ColorField>
      </ColorPicker>
    ));

    const swatch = getByRole("img");
    expect(swatch).toHaveAttribute("aria-label", "vibrant red");

    const sliders = getAllByRole("slider");
    expect(sliders).toHaveLength(2);
    expect(sliders[0]).toHaveValue("100");
    expect(sliders[1]).toHaveValue("0");

    const colorField = getAllByRole("textbox")[0]!;
    expect(colorField).toHaveValue("#FF0000");

    colorField.focus();
    await user.clear(colorField);
    await user.keyboard("00f");
    await user.tab();

    expect(swatch).toHaveAttribute("aria-label", "dark vibrant blue");
    expect(sliders[0]).toHaveValue("100");
    expect(sliders[1]).toHaveValue("240");
    expect(colorField).toHaveValue("#0000FF");
  });

  // Rivet addition
  it("syncs a two-way Signal value with its children (wheel keys → field, swatch)", async () => {
    const value = signal<string | Color>("hsl(0, 100%, 50%)");
    const { getByRole } = q(() => (
      <ColorPicker value={value}>
        <ColorSwatch />
        <ColorWheel outerRadius={100} innerRadius={80}>
          <ColorThumb />
        </ColorWheel>
        <ColorField aria-label="hex">
          <Input />
        </ColorField>
      </ColorPicker>
    ));
    await user.tab();
    await user.keyboard("{PageUp}");
    expect(toColor(value())!.getChannelValue("hue")).toBe(15);
    expect(getByRole("textbox")).toHaveValue("#FF4000");
    expect(getByRole("img")).toHaveStyle({ backgroundColor: "#ff4000" });
    value.set("#00ff00");
    expect(getByRole("slider")).toHaveValue("120");
    expect(getByRole("textbox")).toHaveValue("#00FF00");
  });
});
