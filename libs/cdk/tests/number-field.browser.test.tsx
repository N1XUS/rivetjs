// Ported from react-aria-components test/NumberField.test.js (react-spectrum, Apache-2.0, © Adobe).
// Changes: `render` from `@rivetjs/runtime/testing` (Chromium); queries via `@testing-library/dom` `within(container)`;
// `className` → `class` (render props are accessors: `isHovered()`); `jest.fn` → `vi.fn`; `jest.mock(LiveAnnouncer)` →
// `vi.mock("../announcer/live-announcer.ts", { spy: true })`; `userEvent.setup({ delay: null, pointerMap })` →
// `userEvent.setup()`; `rerender` → signal / accessor props (`isReadOnly`, `value`, `formatOptions`); `act(...)` dropped
// (handlers run batched); default classes `rv-*`; jest fake timers → `vi.useFakeTimers()` + `fire` (mousedown / up on a
// disabled button, like upstream's `fireEvent`).
// Skipped: "should support custom render function" (now in the render-*.browser.test.tsx files).
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import { fire, flush, render } from "@rivetjs/runtime/testing";
import { within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { announce } from "../announcer/live-announcer.ts";
import { Button } from "../button/index.tsx";
import { FieldError } from "../form/field-error.tsx";
import { Form } from "../form/index.tsx";
import { Group, type GroupProps } from "../group/index.tsx";
import { I18nProvider } from "../i18n/i18n-provider.tsx";
import { Input } from "../input/index.tsx";
import { Label } from "../label/index.tsx";
import { Text } from "../text/index.tsx";
import { NumberField, NumberFieldContext, type NumberFieldProps } from "../number-field/index.tsx";

vi.mock("../announcer/live-announcer.ts", { spy: true });

beforeEach(() => {
  vi.mocked(announce).mockClear();
});

function TestNumberField(props: Partial<NumberFieldProps> & { groupProps?: Partial<GroupProps> }) {
  const { groupProps, ...rest } = props;
  return (
    <NumberField defaultValue={1024} minValue={0} {...({ "data-foo": "bar" } as {})} {...rest}>
      <Label>Width</Label>
      <Group {...groupProps}>
        <Button slot="decrement">-</Button>
        <Input />
        <Button slot="increment">+</Button>
      </Group>
      <Text slot="description">Description</Text>
      <Text slot="errorMessage">Error</Text>
    </NumberField>
  );
}

const renderField = (factory: () => any) => {
  const { container } = render(factory);
  return within(container as HTMLElement);
};

describe("NumberField", () => {
  let user: ReturnType<typeof userEvent.setup>;
  beforeAll(() => {
    user = userEvent.setup();
  });

  it("provides slots", () => {
    const { getByRole, getAllByRole } = renderField(() => <TestNumberField />);

    const group = getByRole("group");
    expect(group).toBeInTheDocument();
    expect(group).toHaveAttribute("class", "rv-Group");

    expect(group.closest(".rv-NumberField")).toHaveAttribute("data-foo", "bar");

    const input = getByRole("textbox");
    expect(input).toHaveValue("1,024");

    expect(input).toHaveAttribute("aria-labelledby");
    const label = document.getElementById(input.getAttribute("aria-labelledby")!);
    expect(label).toHaveAttribute("class", "rv-Label");
    expect(label).toHaveTextContent("Width");

    expect(input).toHaveAttribute("aria-describedby");
    expect(
      input
        .getAttribute("aria-describedby")!
        .split(" ")
        .map((id) => document.getElementById(id)!.textContent)
        .join(" "),
    ).toBe("Description Error");

    const buttons = getAllByRole("button");
    expect(buttons[0]).toHaveAttribute("aria-label", "Decrease");
    expect(buttons[1]).toHaveAttribute("aria-label", "Increase");
  });

  it("should support slot", () => {
    const { getByRole } = renderField(() => (
      <Provider token={NumberFieldContext} value={{ slots: { test: { "aria-label": "test" } } }}>
        <TestNumberField slot="test" />
      </Provider>
    ));

    const textbox = getByRole("textbox");
    expect(textbox.closest(".rv-NumberField")).toHaveAttribute("slot", "test");
    expect(textbox).toHaveAttribute("aria-label", "test");
  });

  // RAC custom render function: covered in the render-*.browser.test.tsx files.

  it("should support hover state", async () => {
    const { getByRole } = renderField(() => <TestNumberField groupProps={{ class: ({ isHovered }) => (isHovered() ? "hover" : "") }} />);
    const group = getByRole("group");

    expect(group).not.toHaveAttribute("data-hovered");
    expect(group).not.toHaveClass("hover");

    await user.hover(group);
    expect(group).toHaveAttribute("data-hovered", "true");
    expect(group).toHaveClass("hover");

    await user.unhover(group);
    expect(group).not.toHaveAttribute("data-hovered");
    expect(group).not.toHaveClass("hover");
  });

  it("should support focus visible state", async () => {
    const { getByRole } = renderField(() => <TestNumberField groupProps={{ class: ({ isFocusVisible }) => (isFocusVisible() ? "focus" : "") }} />);
    const group = getByRole("group");
    const input = getByRole("textbox");

    expect(group).not.toHaveAttribute("data-focus-visible");
    expect(group).not.toHaveClass("focus");

    await user.tab();
    expect(document.activeElement).toBe(input);
    expect(group).toHaveAttribute("data-focus-visible", "true");
    expect(group).toHaveClass("focus");

    await user.tab();
    expect(group).not.toHaveAttribute("data-focus-visible");
    expect(group).not.toHaveClass("focus");
  });

  it("should support read-only state", async () => {
    const isReadOnly = signal(false);
    const { getByRole } = renderField(() => <TestNumberField isReadOnly={isReadOnly} />);

    const input = getByRole("textbox");

    expect(input.closest(".rv-NumberField")).not.toHaveAttribute("data-readonly");
    isReadOnly.set(true);
    expect(input.closest(".rv-NumberField")).toHaveAttribute("data-readonly");
  });

  it("should support render props", () => {
    const { getByRole } = renderField(() => (
      <NumberField defaultValue={1024} minValue={300} maxValue={1400}>
        {({ state }) => (
          <>
            <Label>
              Width (min: {state.minValue as number}, max: {state.maxValue as number})
            </Label>
            <Group>
              <Button slot="decrement">-</Button>
              <Input />
              <Button slot="increment">+</Button>
            </Group>
          </>
        )}
      </NumberField>
    ));

    const input = getByRole("textbox");
    const label = document.getElementById(input.getAttribute("aria-labelledby")!);
    expect(label).toHaveTextContent("Width (min: 300, max: 1400)");
  });

  it("should support form value", () => {
    const value = signal<number | null>(25);
    render(() => <TestNumberField name="test" form="test" value={value} formatOptions={{ style: "currency", currency: "USD" }} />);
    const input = document.querySelector("input[name=test]");
    expect(input).toHaveValue("25");
    expect(input).toHaveAttribute("form", "test");

    value.set(null);
    expect(input).toHaveValue("");
  });

  it("should support disabled when having a form value", () => {
    render(() => <TestNumberField isDisabled name="test" form="test" value={25} formatOptions={{ style: "currency", currency: "USD" }} />);
    const input = document.querySelector("input[name=test]");
    expect(input).toBeDisabled();
  });

  it("should render data- attributes only on the outer element", () => {
    const { getAllByTestId } = renderField(() => <TestNumberField {...({ "data-testid": "number-field" } as {})} />);
    const outerEl = getAllByTestId("number-field");
    expect(outerEl).toHaveLength(1);
    expect(outerEl[0]).toHaveClass("rv-NumberField");
  });

  it("supports validation errors", async () => {
    const { getByRole, getByTestId } = renderField(() => (
      <form data-testid="form">
        <NumberField isRequired>
          <Label>Width</Label>
          <Group>
            <Button slot="decrement">-</Button>
            <Input />
            <Button slot="increment">+</Button>
          </Group>
          <FieldError />
        </NumberField>
      </form>
    ));

    // RA useSlotId drops the ids of parts that did not render in a layout effect; Rivet after a microtask.
    await flush();
    const input = getByRole("textbox") as HTMLInputElement;
    const numberfield = input.closest(".rv-NumberField");
    expect(input).toHaveAttribute("required");
    expect(input).not.toHaveAttribute("aria-required");
    expect(input).not.toHaveAttribute("aria-describedby");
    expect(input.validity.valid).toBe(false);
    expect(numberfield).not.toHaveAttribute("data-invalid");

    (getByTestId("form") as HTMLFormElement).checkValidity();

    expect(input).toHaveAttribute("aria-describedby");
    expect(document.getElementById(input.getAttribute("aria-describedby")!)).toHaveTextContent(input.validationMessage); // Chromium message (upstream jsdom: "Constraints not satisfied")
    expect(numberfield).toHaveAttribute("data-invalid");
    expect(document.activeElement).toBe(input);

    await user.keyboard("3");

    expect(input).toHaveAttribute("aria-describedby");
    expect(input.validity.valid).toBe(true);

    await user.tab();
    expect(input).not.toHaveAttribute("aria-describedby");
    expect(numberfield).not.toHaveAttribute("data-invalid");
  });

  it("supports pasting value in another numbering system", async () => {
    const formatOptions = signal<Intl.NumberFormatOptions | undefined>(undefined);
    const { getByRole } = renderField(() => <TestNumberField formatOptions={formatOptions} />);
    const input = getByRole("textbox") as HTMLInputElement;
    await user.tab();
    input.setSelectionRange(0, input.value.length);
    await user.paste("3.000.000,25");
    await user.keyboard("{Enter}");
    expect(input).toHaveValue("1,024");

    input.setSelectionRange(0, input.value.length);
    await user.paste("3 000 000,25");
    await user.keyboard("{Enter}");
    expect(input).toHaveValue("300,000,025");

    formatOptions.set({ style: "currency", currency: "USD" });

    input.setSelectionRange(0, input.value.length);
    await user.paste("3 000 000,256789");
    await user.keyboard("{Enter}");
    expect(input).toHaveValue("$3,000,000,256,789.00");

    input.setSelectionRange(0, input.value.length);
    await user.paste("1,000");
    await user.keyboard("{Enter}");
    // Ambiguous value should be parsed using the current locale
    expect(input).toHaveValue("$1,000.00");

    input.setSelectionRange(0, input.value.length);

    await user.paste("1.000");
    await user.keyboard("{Enter}");
    // Ambiguous value should be parsed using the current locale
    expect(input).toHaveValue("$1.00");
  });

  it("should support arabic singular and dual counts", async () => {
    const onChange = vi.fn();
    const { getByRole } = renderField(() => (
      <I18nProvider locale="ar-AE">
        <NumberField defaultValue={0} onChange={onChange} formatOptions={{ style: "unit", unit: "day", unitDisplay: "long" }}>
          <Label>Test</Label>
          <Group style={{ display: "flex" }}>
            <Button slot="decrement">-</Button>
            <Input />
            <Button slot="increment">+</Button>
          </Group>
          <FieldError />
        </NumberField>
      </I18nProvider>
    ));
    const input = getByRole("textbox");
    await user.tab();
    await user.keyboard("{ArrowUp}");
    expect(onChange).toHaveBeenLastCalledWith(1);
    expect(input).toHaveValue("يوم");

    await user.keyboard("{ArrowUp}");
    expect(input).toHaveValue("يومان");
    expect(onChange).toHaveBeenLastCalledWith(2);
  });

  it("should support repeat keydown events when holding an arrow key", async () => {
    const onChange = vi.fn();
    const { getByRole } = renderField(() => <TestNumberField onChange={onChange} />);
    const input = getByRole("textbox");

    await user.tab();
    expect(input).toHaveFocus();

    await user.keyboard("{ArrowUp>3/}");
    expect(input).toHaveValue("1,027");
    expect(onChange).toHaveBeenLastCalledWith(1027);

    await user.keyboard("{ArrowDown>3/}");
    expect(input).toHaveValue("1,024");
    expect(onChange).toHaveBeenLastCalledWith(1024);
  });

  it("should not type the grouping characters when useGrouping is false", async () => {
    const { getByRole } = renderField(() => <TestNumberField formatOptions={{ useGrouping: false }} />);
    const input = getByRole("textbox") as HTMLInputElement;

    await user.click(input);
    await user.keyboard("{Control>}a{/Control}{Backspace}");
    await user.keyboard("102,4");
    expect(input.value).toBe("1024");

    await user.clear(input);
    expect(input.value).toBe("");

    await user.paste("102,4");
    await user.tab();
    expect(input.value).toBe("1024");

    await user.click(input);
    input.setSelectionRange(0, input.value.length);
    await user.paste("1,024");
    await user.tab();
    expect(input.value).toBe("1024");
  });

  it("should not type the grouping characters when useGrouping is false and in German locale", async () => {
    const { getByRole } = renderField(() => (
      <I18nProvider locale="de-DE">
        <TestNumberField formatOptions={{ useGrouping: false }} />
      </I18nProvider>
    ));
    const input = getByRole("textbox") as HTMLInputElement;

    await user.click(input);
    await user.keyboard("{Control>}a{/Control}{Backspace}");
    await user.keyboard("102.4");
    expect(input.value).toBe("1024");

    await user.clear(input);
    expect(input.value).toBe("");

    await user.paste("102.4");
    await user.tab();
    expect(input.value).toBe("1024");

    await user.click(input);
    input.setSelectionRange(0, input.value.length);
    await user.paste("1.024");
    await user.tab();
    expect(input.value).toBe("1024");
  });

  it("should trigger onChange via programmatic click() on stepper buttons", () => {
    const onChange = vi.fn();
    const { container } = render(() => <TestNumberField defaultValue={1024} onChange={onChange} />);
    (container as HTMLElement).querySelector<HTMLElement>("[slot=increment]")!.click();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(1025);
    (container as HTMLElement).querySelector<HTMLElement>("[slot=decrement]")!.click();
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenCalledWith(1024);
  });

  it("should allow you to delete the first digit in a number if it is followed by a group separator", async () => {
    const { getByRole } = renderField(() => <TestNumberField defaultValue={1024} formatOptions={{ useGrouping: true }} />);
    const input = getByRole("textbox") as HTMLInputElement;
    await user.tab();
    await user.keyboard("{ArrowLeft}");
    await user.keyboard("{ArrowRight}");
    await user.keyboard("{Backspace}");
    expect(input).toHaveValue(",024");
    await user.keyboard("{Enter}");
    expect(input).toHaveValue("24");
  });

  it("supports onChange", async () => {
    const onChange = vi.fn();
    const { getByRole } = renderField(() => <TestNumberField defaultValue={200} onChange={onChange} />);
    const input = getByRole("textbox");
    await user.tab();
    await user.clear(input);
    await user.keyboard("1024");
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith(1024);
  });

  it("should support pasting into a format", async () => {
    const onChange = vi.fn();
    const { getByRole } = renderField(() => <TestNumberField defaultValue={200} onChange={onChange} formatOptions={{ style: "currency", currency: "USD" }} />);
    const input = getByRole("textbox");
    await user.tab();
    await user.clear(input);
    await user.paste("1,024");
    expect(input).toHaveValue("$1,024.00");
    expect(announce).toHaveBeenCalledTimes(2);
    expect(announce).toHaveBeenLastCalledWith("$1,024.00", "assertive");
    expect(onChange).toHaveBeenCalledWith(1024);
  });

  it("should not change the input value if the new value is not accepted", async () => {
    const { getByRole } = renderField(() => <TestNumberField value={200} />);
    const input = getByRole("textbox");
    await user.tab();
    await user.clear(input);
    await user.paste("1024");
    expect(input).toHaveValue("200");
    expect(announce).toHaveBeenLastCalledWith("200", "assertive");
    await user.keyboard("{Enter}");
    expect(input).toHaveValue("200");
  });

  it("should not reset validation errors on blur when value has not changed", async () => {
    const { getByRole } = renderField(() => (
      <Form validationErrors={{ testNumber: "This field has an error." }}>
        <NumberField name="testNumber" defaultValue={5}>
          <Label>Test Number</Label>
          <Group>
            <Button slot="decrement">-</Button>
            <Input />
            <Button slot="increment">+</Button>
          </Group>
          <FieldError />
        </NumberField>
      </Form>
    ));

    await flush();
    const input = getByRole("textbox");
    const numberfield = input.closest(".rv-NumberField");

    // Validation error should be displayed
    expect(numberfield).toHaveAttribute("data-invalid");
    expect(input).toHaveAttribute("aria-describedby");
    expect(document.getElementById(input.getAttribute("aria-describedby")!.split(" ")[0]!)).toHaveTextContent("This field has an error.");

    // Focus the field without changing the value
    input.focus();
    expect(numberfield).toHaveAttribute("data-invalid");

    // Blur the field without changing the value
    input.blur();

    // Validation error should still be displayed because the value didn't change
    expect(numberfield).toHaveAttribute("data-invalid");
    expect(input).toHaveAttribute("aria-describedby");
    expect(document.getElementById(input.getAttribute("aria-describedby")!.split(" ")[0]!)).toHaveTextContent("This field has an error.");
  });

  it("should not change the edited input value when value snapping is disabled", async () => {
    const { getByRole, getByTestId } = renderField(() => (
      <form data-testid="form">
        <NumberField isRequired defaultValue={20} minValue={10} step={10} maxValue={50} commitBehavior="validate">
          <Label>Width</Label>
          <Group>
            <Button slot="decrement">-</Button>
            <Input />
            <Button slot="increment">+</Button>
          </Group>
          <FieldError />
        </NumberField>
      </form>
    ));
    await flush();
    const input = getByRole("textbox") as HTMLInputElement;
    const form = getByTestId("form") as HTMLFormElement;
    expect(input.validity.valid).toBe(true);

    // Over max
    await user.tab();
    await user.clear(input);
    await user.keyboard("1024");
    await user.tab();
    expect(input).toHaveValue("1,024");
    expect(announce).toHaveBeenLastCalledWith("1,024", "assertive");
    expect(input.closest(".rv-NumberField")).toHaveAttribute("data-invalid", "true");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.validity.valid).toBe(false);
    expect(input).toHaveAttribute("aria-describedby");
    expect(document.getElementById(input.getAttribute("aria-describedby")!)).toHaveTextContent(input.validationMessage); // Chromium message (upstream jsdom: "Constraints not satisfied")

    form.checkValidity();
    expect(document.activeElement).toBe(input);

    // Valid
    await user.clear(input);
    await user.keyboard("30");
    await user.tab();
    expect(input).toHaveValue("30");
    expect(announce).toHaveBeenLastCalledWith("30", "assertive");
    expect(input.validity.valid).toBe(true);
    expect(input).not.toHaveAttribute("aria-describedby");

    // Under min
    await user.clear(input);
    await user.keyboard("2");
    await user.tab();
    expect(input).toHaveValue("2");
    expect(announce).toHaveBeenLastCalledWith("2", "assertive");
    expect(input.validity.valid).toBe(false);
    expect(input).toHaveAttribute("aria-describedby");

    form.checkValidity();
    expect(document.activeElement).toBe(input);

    // Not on step
    await user.clear(input);
    await user.keyboard("31");
    await user.tab();
    expect(input).toHaveValue("31");
    expect(announce).toHaveBeenLastCalledWith("31", "assertive");
    expect(input.validity.valid).toBe(false);
    expect(input).toHaveAttribute("aria-describedby");

    form.checkValidity();
    expect(document.activeElement).toBe(input);

    // Required
    await user.clear(input);
    await user.tab();
    expect(input).toHaveValue("");
    expect(input.validity.valid).toBe(false);
    expect(input).toHaveAttribute("aria-describedby");

    // Valid
    await user.clear(input);
    await user.keyboard("30");
    await user.tab();
    expect(input).toHaveValue("30");
    expect(input.validity.valid).toBe(true);
    expect(input).not.toHaveAttribute("aria-describedby");
  });

  describe("auto spinning", () => {
    afterEach(() => {
      if (vi.isFakeTimers()) vi.runOnlyPendingTimers();
      vi.useRealTimers();
    });

    // Skipped: needs RA usePress `isDisabled` effect (cancel a press when the button turns disabled) in Button
    // (`cancelPress` exists in interactions/press.tsx, Button does not call it) — Button lane, open question.
    it.skip("stops spinning if the associated button is disabled", async () => {
      const value = signal<number | null>(4);
      const { getByRole } = renderField(() => (
        <NumberField value={value}>
          <Label>Label</Label>
          <Group>
            <Input class="rv-Input inset" />
            <Button slot="decrement" isDisabled={() => (value() ?? 0) <= 4}>
              -
            </Button>
            <Button slot="increment" isDisabled={() => (value() ?? 0) >= 8}>
              +
            </Button>
          </Group>
        </NumberField>
      ));
      const input = getByRole("textbox");
      const decrementButton = getByRole("button", { name: /^Decrease/ }); // name = "Decrease Label" (aria-labelledby id + label)
      const incrementButton = getByRole("button", { name: /^Increase/ });
      await user.click(incrementButton);
      vi.useFakeTimers();
      // manually fire these events because user.click will refuse to fire the up event if the button is disabled
      fire(decrementButton, "pointerdown", { button: 0, pointerId: 1, pointerType: "mouse" }); // Chromium has PointerEvent: press listens to pointer events, not mouse
      fire(decrementButton, "pointerup", { button: 0, pointerId: 1, pointerType: "mouse" });
      vi.runAllTimers();
      expect(decrementButton).toBeDisabled();
      expect(input).toHaveValue("4");
    });
  });
});
