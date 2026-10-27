// Ported from react-aria-components test/ColorField.test.js and react-aria test/color/useColorField.test.js
// (react-spectrum, Apache-2.0, © Adobe).
// Changes: `render` from `@rivetjs/runtime/testing` (Chromium); queries via `@testing-library/dom` `within(container)`;
// default class `rv-ColorField` / `rv-Label`; `jest.fn` → `vi.fn`; `userEvent.setup({ delay: null, pointerMap })` →
// `userEvent.setup()`; `rerender(<X prop />)` → a second render (static props) or a Signal value (form value);
// render props are accessors (`isDisabled()`); "supports validation errors": awaits a tick where React's act() flushes
// the useSlotId layout effect; the browser's message for a missing
// required value is "Please fill out this field." (jsdom: "Constraints not satisfied").
// useColorField: `renderHook` → a reactive root; bag values may be accessors (`read(bag[key])`); `htmlFor` → `for`;
// RA's `false` / `null` attribute values are kept (`disabled: false`, `aria-valuenow: null`).
// Skipped: "should support custom render function" (now in the render-*.browser.test.tsx files).
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { createRoot, signal } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { ColorField, ColorFieldContext, colorFieldProps, type AriaColorFieldProps, type ColorFieldProps } from "../color-field/index.tsx";
import { FieldError } from "../form/field-error.tsx";
import { Input } from "../input/index.tsx";
import { Label } from "../label/index.tsx";
import { Text } from "../text/index.tsx";
import { createColorFieldState, parseColor, toColor, type Color } from "../color/index.ts";
import { read } from "../interactions/utils.ts";

afterEach(cleanup);

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const TestColorField = (props: Partial<ColorFieldProps>) => (
  <ColorField defaultValue="#f00" data-foo="bar" {...props}>
    <Label>Color</Label>
    <Input />
    <Text slot="description">Description</Text>
    <Text slot="errorMessage">Error</Text>
  </ColorField>
);

const renderField = (props: Partial<ColorFieldProps> = {}) => within(render(() => <TestColorField {...props} />).container as HTMLElement);

describe("ColorField", () => {
  let user: ReturnType<typeof userEvent.setup>;
  beforeAll(() => {
    user = userEvent.setup();
  });

  it("provides slots", () => {
    const { getByRole } = renderField();
    const input = getByRole("textbox");
    expect(input.closest(".rv-ColorField")).toHaveAttribute("data-foo", "bar");
    expect(input).toHaveValue("#FF0000");

    expect(input).toHaveAttribute("aria-labelledby");
    const label = document.getElementById(input.getAttribute("aria-labelledby")!);
    expect(label).toHaveAttribute("class", "rv-Label");
    expect(label).toHaveTextContent("Color");

    expect(input).toHaveAttribute("aria-describedby");
    expect(
      input
        .getAttribute("aria-describedby")!
        .split(" ")
        .map((id) => document.getElementById(id)!.textContent)
        .join(" "),
    ).toBe("Description Error");
  });

  it("should support slot", () => {
    const { container } = render(() => (
      <Provider token={ColorFieldContext} value={{ slots: { test: { "aria-label": "test" } } }}>
        <TestColorField slot="test" />
      </Provider>
    ));
    const textbox = within(container as HTMLElement).getByRole("textbox");
    expect(textbox.closest(".rv-ColorField")).toHaveAttribute("slot", "test");
    expect(textbox).toHaveAttribute("aria-label", "test");
  });

  it("should support render props", () => {
    const { container } = render(() => (
      <ColorField defaultValue="#f00" isDisabled>
        {({ isDisabled }) => (
          <>
            <Label>Color ({isDisabled() ? "disabled" : ""})</Label>
            <Input />
          </>
        )}
      </ColorField>
    ));
    const input = within(container as HTMLElement).getByRole("textbox");
    const label = document.getElementById(input.getAttribute("aria-labelledby")!);
    expect(label).toHaveTextContent("Color (disabled)");
  });

  // RAC custom render function: covered in the render-*.browser.test.tsx files.

  it("should support form value", () => {
    const value = signal<string | Color | null>("#f00");
    render(() => <TestColorField name="test" value={value} />);
    const input = document.querySelector("input[name=test]") as HTMLInputElement;
    expect(input).toHaveValue("#FF0000");

    value.set(null);
    expect(input).toHaveValue("");
  });

  it("should support read-only state", () => {
    const { getByRole } = renderField();
    expect(getByRole("textbox").closest(".rv-ColorField")).not.toHaveAttribute("data-readonly");
    cleanup();
    const readOnly = renderField({ isReadOnly: true });
    expect(readOnly.getByRole("textbox").closest(".rv-ColorField")).toHaveAttribute("data-readonly");
  });

  it("should support required state", () => {
    const { getByRole } = renderField();
    expect(getByRole("textbox").closest(".rv-ColorField")).not.toHaveAttribute("data-required");
    cleanup();
    const required = renderField({ isRequired: true });
    expect(required.getByRole("textbox").closest(".rv-ColorField")).toHaveAttribute("data-required");
  });

  // Rivet: the spin keys in `data-rk` (held by the resume loader while a cold chunk loads); none when disabled.
  it("lists the spin keys on the input in data-rk", () => {
    expect(renderField().getByRole("textbox")).toHaveAttribute("data-rk", "ArrowUp ArrowDown PageUp PageDown Home End");
    expect(renderField({ isDisabled: true }).getByRole("textbox")).not.toHaveAttribute("data-rk");
  });

  it("should render data- attributes only on the outer element", () => {
    const { getAllByTestId } = renderField({ "data-testid": "number-field" } as never);
    const outerEl = getAllByTestId("number-field");
    expect(outerEl).toHaveLength(1);
    expect(outerEl[0]).toHaveClass("rv-ColorField");
  });

  it("should commit the typed value on Enter", async () => {
    const onChange = vi.fn();
    const { getByRole } = renderField({ onChange });
    const input = getByRole("textbox");

    await user.tab();
    await user.clear(input);
    await user.keyboard("#0000ff");
    expect(onChange).not.toHaveBeenCalled();

    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect((onChange.mock.calls[0]![0] as Color).toString("hexa")).toBe(parseColor("#0000ff").toString("hexa"));
    expect(input).toHaveValue("#0000FF");
  });

  it("should restore the previous value on Enter if the typed value cannot be parsed", async () => {
    const onChange = vi.fn();
    const { getByRole } = renderField({ onChange });
    const input = getByRole("textbox");

    await user.tab();
    await user.clear(input);
    await user.keyboard("ab");
    await user.keyboard("{Enter}");
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveValue("#FF0000");
  });

  it("should call a user onKeyDown handler exactly once per key press", async () => {
    const onKeyDown = vi.fn();
    renderField({ onKeyDown });

    await user.tab();
    await user.keyboard("a");
    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });

  it("supports validation errors", async () => {
    const { container } = render(() => (
      <form data-testid="form">
        <ColorField isRequired>
          <Label>Color</Label>
          <Input />
          <FieldError />
        </ColorField>
      </form>
    ));
    const { getByRole, getByTestId } = within(container as HTMLElement);
    const input = getByRole("textbox") as HTMLInputElement;
    const numberfield = input.closest(".rv-ColorField");
    await tick(); // RA useSlotId layout effect: the missing error part drops its id

    expect(input).toHaveAttribute("required");
    expect(input).not.toHaveAttribute("aria-required");
    expect(input).not.toHaveAttribute("aria-describedby");
    expect(input.validity.valid).toBe(false);
    expect(numberfield).not.toHaveAttribute("data-invalid");

    (getByTestId("form") as HTMLFormElement).checkValidity();
    await tick();

    expect(input).toHaveAttribute("aria-describedby");
    expect(document.getElementById(input.getAttribute("aria-describedby")!)).toHaveTextContent(input.validationMessage);
    expect(numberfield).toHaveAttribute("data-invalid");
    expect(document.activeElement).toBe(input);

    await user.keyboard("ff0");

    expect(input).toHaveAttribute("aria-describedby");
    expect(input.validity.valid).toBe(true);

    await user.tab();
    await tick();
    expect(input).not.toHaveAttribute("aria-describedby");
    expect(numberfield).not.toHaveAttribute("data-invalid");
  });

  it("should support the channel prop", async () => {
    const onChange = vi.fn();
    const { getByRole } = renderField({ value: "#abc", colorSpace: "hsl", channel: "hue", name: "hue", onChange });
    const colorField = getByRole("textbox") as HTMLInputElement;
    expect(colorField.value).toBe("210°");
    expect(colorField.closest(".rv-ColorField")).toHaveAttribute("data-channel", "hue");
    expect(colorField).not.toHaveAttribute("name");
    const hiddenInput = document.querySelector("input[name=hue]") as HTMLInputElement;
    expect(hiddenInput.value).toBe("210");
    expect(hiddenInput).toHaveAttribute("type", "hidden");

    await user.tab();
    await user.keyboard("100");
    await user.tab();
    expect((onChange.mock.calls.at(-1)![0] as Color).toString("hsl")).toBe(parseColor("hsl(100, 25%, 73.33%)").toString("hsl"));
  });

  it("should support form prop", () => {
    const { getByRole } = renderField({ form: "test" });
    expect(getByRole("textbox")).toHaveAttribute("form", "test");
  });

  // Rivet additions
  it("increments / decrements the hex value with the arrow keys and updates a two-way Signal", async () => {
    const value = signal<string | Color | null>("#000010");
    const { getByRole } = renderField({ value, defaultValue: undefined });
    const input = getByRole("textbox");
    await user.tab();
    await user.keyboard("{ArrowUp}");
    expect(toColor(value())!.toString("hex")).toBe("#000011");
    expect(input).toHaveValue("#000011");
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(toColor(value())!.toString("hex")).toBe("#00000F");
    await user.keyboard("{End}");
    expect(toColor(value())!.toString("hex")).toBe("#FFFFFF");
  });

  it("increments the channel value with the arrow keys", async () => {
    const onChange = vi.fn();
    const { container } = render(() => (
      <ColorField defaultValue="hsl(10, 50%, 50%)" channel="hue" onChange={onChange}>
        <Input />
      </ColorField>
    ));
    const input = within(container as HTMLElement).getByRole("textbox");
    // No Label: the channel name labels the input (RA useColorChannelField default aria-label).
    expect(input).toHaveAttribute("aria-label", "Hue");
    expect(input).not.toHaveAttribute("aria-labelledby");
    await user.tab();
    await user.keyboard("{ArrowUp}");
    expect((onChange.mock.calls.at(-1)![0] as Color).getChannelValue("hue")).toBe(11);
    expect(input).toHaveValue("11°");
  });

  it("rejects characters that are not hex digits", async () => {
    const { getByRole } = renderField();
    const input = getByRole("textbox");
    await user.tab();
    await user.clear(input);
    await user.keyboard("zz12");
    expect(input).toHaveValue("12");
  });
});

describe("useColorField", () => {
  const renderColorFieldHook = (props: Partial<AriaColorFieldProps>) =>
    createRoot(() => colorFieldProps({ "aria-label": "Primary Color", ...props } as AriaColorFieldProps, createColorFieldState(props))).value;

  it("handles defaults", () => {
    const { inputProps } = renderColorFieldHook({});
    expect(inputProps.type).toBe("text");
    expect(inputProps.autoComplete).toBe("off");
    expect(inputProps.autoCorrect).toBe("off");
    expect(inputProps.id).toBeTruthy();
    expect(inputProps.role).toBe("textbox");
    expect(inputProps["aria-valuenow"]).toBeNull();
    expect(inputProps["aria-valuetext"]).toBeNull();
    expect(inputProps["aria-valuemin"]).toBeNull();
    expect(inputProps["aria-valuemax"]).toBeNull();
    expect(read(inputProps["aria-required"])).toBeUndefined();
    expect(read(inputProps["aria-disabled"])).toBeUndefined();
    expect(read(inputProps["aria-readonly"])).toBeUndefined();
    expect(read(inputProps["aria-invalid"])).toBeUndefined();
    expect(read(inputProps.disabled)).toBe(false);
    expect(read(inputProps.readOnly)).toBe(false);
    expect(inputProps.spellCheck).toBe("false");
  });

  it("should return props for colorValue provided", () => {
    const colorValue = parseColor("#ff88a0");
    const { inputProps } = renderColorFieldHook({ value: colorValue });
    expect(inputProps["aria-valuenow"]).toBeNull();
    expect(inputProps["aria-valuetext"]).toBeNull();
    expect(read(inputProps.value)).toBe("#FF88A0");
  });

  it("should return props for label", () => {
    const { labelProps, inputProps } = renderColorFieldHook({ "aria-label": undefined, label: "Secondary Color" });
    expect(labelProps.id).toBeTruthy();
    expect(labelProps.for).toBe(inputProps.id);
    expect(inputProps.id).toBeTruthy();
    expect(read(inputProps["aria-labelledby"])).toBe(labelProps.id);
    expect(read(inputProps["aria-label"])).toBeUndefined(); // because label prop is provided instead of aria-label
  });

  it("should return prop for invalid", () => {
    const { inputProps } = renderColorFieldHook({ isInvalid: true });
    expect(read(inputProps["aria-invalid"])).toBe(true);
  });

  it("should return prop for required", () => {
    const { inputProps } = renderColorFieldHook({ isRequired: true });
    expect(read(inputProps["aria-required"])).toBe(true);
  });

  it("should return prop for readonly", () => {
    const { inputProps } = renderColorFieldHook({ isReadOnly: true });
    expect(read(inputProps["aria-readonly"])).toBe(true);
    expect(read(inputProps.readOnly)).toBe(true);
  });

  it("should return prop for disabled", () => {
    const { inputProps } = renderColorFieldHook({ isDisabled: true });
    expect(read(inputProps["aria-disabled"])).toBe(true);
    expect(read(inputProps.disabled)).toBe(true);
  });
});
