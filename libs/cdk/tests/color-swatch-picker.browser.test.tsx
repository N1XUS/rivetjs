// Ported from react-aria-components test/ColorSwatchPicker.test.js (react-spectrum, Apache-2.0, © Adobe).
// Changes: `render` from `@rivetjs/runtime/testing` (Chromium); queries via `@testing-library/dom` `within(container)`;
// `className` → `class`; default classes `rv-ColorSwatchPicker` / `rv-ColorSwatchPickerItem`;
// `userEvent.setup({ delay: null, pointerMap })` → `userEvent.setup()`; `onChange` compared with `toEqual` on hex strings.
// Rivet additions: a two-way Signal value; a ColorPicker keeping a ColorSwatchPicker and a ColorField in sync; item render props.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal } from "@rivetjs/reactivity";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { ColorSwatch } from "../color-swatch/index.tsx";
import { ColorSwatchPicker, ColorSwatchPickerItem } from "../color-swatch-picker/index.tsx";
import { ColorPicker } from "../color-picker/index.tsx";
import { ColorField } from "../color-field/index.tsx";
import { Input } from "../input/index.tsx";
import { parseColor, toColor, type Color } from "../color/index.ts";

afterEach(cleanup);

const q = (fn: () => unknown) => within(render(fn as never).container as HTMLElement);

function Swatches() {
  return (
    <>
      <ColorSwatchPickerItem color="#f00">
        <ColorSwatch />
      </ColorSwatchPickerItem>
      <ColorSwatchPickerItem color="#0f0">
        <ColorSwatch />
      </ColorSwatchPickerItem>
      <ColorSwatchPickerItem color="#0ff">
        <ColorSwatch />
      </ColorSwatchPickerItem>
      <ColorSwatchPickerItem color="#00f">
        <ColorSwatch />
      </ColorSwatchPickerItem>
    </>
  );
}

describe("ColorSwatchPicker", () => {
  let user: ReturnType<typeof userEvent.setup>;
  beforeAll(() => {
    user = userEvent.setup();
  });

  it("renders a listbox", async () => {
    const onChange = vi.fn();
    const { getByRole } = q(() => (
      <ColorSwatchPicker onChange={(c) => onChange(c)}>
        <Swatches />
      </ColorSwatchPicker>
    ));

    const listbox = getByRole("listbox");
    expect(listbox).toHaveAttribute("aria-label", "Color swatches");
    expect(listbox).toHaveAttribute("class", "rv-ColorSwatchPicker");

    const options = within(listbox).getAllByRole("option");
    expect(options).toHaveLength(4);
    expect(options[0]).toHaveAttribute("class", "rv-ColorSwatchPickerItem");
    expect(within(options[0]!).getByRole("img")).toHaveAttribute("aria-label", "vibrant red");

    await user.click(options[1]!);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect((onChange.mock.calls[0]![0] as Color).toString("hexa")).toBe(parseColor("#0f0").toString("hexa"));
    expect(options[1]).toHaveAttribute("aria-selected", "true");
  });

  it("supports custom class", () => {
    const { getByRole } = q(() => (
      <ColorSwatchPicker class="picker">
        <ColorSwatchPickerItem color="#f00" class="item">
          <ColorSwatch />
        </ColorSwatchPickerItem>
      </ColorSwatchPicker>
    ));

    const listbox = getByRole("listbox");
    expect(listbox).toHaveAttribute("class", "picker");

    const options = within(listbox).getAllByRole("option");
    expect(options[0]).toHaveAttribute("class", "item");
  });

  it("supports custom aria-label", () => {
    const { getByRole } = q(() => (
      <ColorSwatchPicker aria-label="test">
        <Swatches />
      </ColorSwatchPicker>
    ));
    expect(getByRole("listbox")).toHaveAttribute("aria-label", "test");
  });

  it("supports custom aria-labelledby", () => {
    const { getByRole } = q(() => (
      <ColorSwatchPicker aria-labelledby="test">
        <Swatches />
      </ColorSwatchPicker>
    ));
    const listbox = getByRole("listbox");
    expect(listbox).toHaveAttribute("aria-labelledby", "test");
    expect(listbox).not.toHaveAttribute("aria-label");
  });

  it("supports defaultValue", () => {
    const { getByRole } = q(() => (
      <ColorSwatchPicker defaultValue="#0ff">
        <Swatches />
      </ColorSwatchPicker>
    ));
    const options = within(getByRole("listbox")).getAllByRole("option");
    expect(options[2]).toHaveAttribute("aria-selected", "true");
  });

  it("handles keyboard input", async () => {
    const onChange = vi.fn();
    const { getByRole } = q(() => (
      <ColorSwatchPicker onChange={(c) => onChange(c)}>
        <Swatches />
      </ColorSwatchPicker>
    ));
    const options = within(getByRole("listbox")).getAllByRole("option");
    expect(options).toHaveLength(4);

    await user.tab();
    expect(document.activeElement).toBe(options[0]);

    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(options[1]);

    await user.keyboard("{Enter}");
    expect(options[1]).toHaveAttribute("aria-selected", "true");
  });

  // Rivet additions
  it("follows and writes a two-way Signal value", async () => {
    const value = signal<string | Color>("#f00");
    const { getByRole } = q(() => (
      <ColorSwatchPicker value={value}>
        <Swatches />
      </ColorSwatchPicker>
    ));
    const options = within(getByRole("listbox")).getAllByRole("option");
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    await user.click(options[3]!);
    expect(toColor(value())!.toString("hex")).toBe("#0000FF");
    expect(options[3]).toHaveAttribute("aria-selected", "true");
    expect(options[0]).toHaveAttribute("aria-selected", "false");
    value.set("#00ffff");
    expect(options[2]).toHaveAttribute("aria-selected", "true");
    expect(options[3]).toHaveAttribute("aria-selected", "false");
  });

  it("keeps the item's color space and passes `color` to item render props", async () => {
    const onChange = vi.fn();
    const { getByRole } = q(() => (
      <ColorSwatchPicker onChange={(c) => onChange(c)}>
        <ColorSwatchPickerItem
          color="hsl(120, 100%, 50%)"
          class={({ color, isSelected }) => `item ${color().getChannelValue("hue")} ${isSelected() ? "on" : "off"}`}
        >
          {({ color }) => <span>{color().toString("hsl")}</span>}
        </ColorSwatchPickerItem>
      </ColorSwatchPicker>
    ));
    const option = within(getByRole("listbox")).getByRole("option");
    expect(option).toHaveAttribute("class", "item 120 off");
    expect(option).toHaveTextContent("hsl(120, 100%, 50%)");
    await user.click(option);
    expect((onChange.mock.calls[0]![0] as Color).getColorSpace()).toBe("hsl");
    expect(option).toHaveAttribute("class", "item 120 on");
  });

  it("stays in sync with a ColorPicker", async () => {
    const { getByRole } = q(() => (
      <ColorPicker defaultValue="#f00">
        <ColorSwatchPicker>
          <Swatches />
        </ColorSwatchPicker>
        <ColorField aria-label="hex">
          <Input />
        </ColorField>
      </ColorPicker>
    ));
    const options = within(getByRole("listbox")).getAllByRole("option");
    const field = getByRole("textbox");
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    await user.click(options[1]!);
    expect(field).toHaveValue("#00FF00");
    field.focus();
    await user.clear(field);
    await user.keyboard("00f");
    await user.tab();
    expect(options[3]).toHaveAttribute("aria-selected", "true");
    expect(options[1]).toHaveAttribute("aria-selected", "false");
  });
});
