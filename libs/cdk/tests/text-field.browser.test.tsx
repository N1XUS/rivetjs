// Ported from react-aria-components test/TextField.test.js (react-spectrum, Apache-2.0, © Adobe).
// Changes: `render` from `@rivetjs/runtime/testing` (Chromium); queries via `@testing-library/dom` `within`;
// `className` → `class`; render props are accessors (`isHovered()`); `jest.fn` → `vi.fn`; `<Context.Provider value>`
// → runtime `Provider`; `rerender` → a signal that re-creates the field (re-query the textbox); default classes `rv-*`;
// Chromium's validation message instead of jsdom's "Constraints not satisfied"; slot ids (`aria-describedby`) settle
// after a microtask (RA `useSlotId` effect).
// Skipped: "should support custom render function" (now in the render-*.browser.test.tsx files); "resets to defaultValue when
// submitting form action" (React 19 form actions).
// Rivet additions (end of file): accessor `isInvalid`, two-way Signal `value`, FieldError inside a `<Form>` with
// `validationErrors`, FieldInputContext (Autocomplete / ComboBox) merged into the input.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { TextField, TextFieldContext } from "../text-field/index.tsx";
import { Input } from "../input/index.tsx";
import { TextArea } from "../text-area/index.tsx";
import { Label } from "../label/index.tsx";
import { Text } from "../text/index.tsx";
import { FieldError } from "../form/field-error.tsx";
import { Form } from "../form/index.tsx";
import { FieldInputContext } from "../autocomplete/contexts.ts";

afterEach(cleanup);

function renderUI(ui: () => unknown) {
  const result = render(ui as never);
  return { ...within(result.container as HTMLElement), container: result.container as HTMLElement, unmount: result.unmount };
}

const microtasks = async () => {
  for (let i = 0; i < 4; i++) await Promise.resolve();
};

type Props = Record<string, any>;

describe.each([
  { name: "Input", component: Input as (p: Props) => unknown },
  { name: "TextArea", component: TextArea as (p: Props) => unknown },
])("$name", ({ name, component }) => {
  let user: ReturnType<typeof userEvent.setup>;
  beforeAll(() => {
    user = userEvent.setup();
  });

  const Component = component;
  function TestTextField(props: Props) {
    const { inputProps = {}, ...rest } = props;
    return (
      <TextField defaultValue="test" data-testid="text-field-test" data-foo="bar" {...rest}>
        <Label>Test</Label>
        <Component {...inputProps} />
        <Text slot="description">Description</Text>
        <Text slot="errorMessage">Error</Text>
      </TextField>
    );
  }

  it("provides slots", async () => {
    const { getByRole } = renderUI(() => <TestTextField />);
    await microtasks();

    const input = getByRole("textbox") as HTMLInputElement;
    expect(input).toHaveValue("test");
    expect(input).toHaveAttribute("class", `rv-${name}`);
    if (name === "Input") expect(input).toHaveAttribute("type", "text");
    else expect(input).not.toHaveAttribute("type");

    expect(input.closest(".rv-TextField")).toHaveAttribute("data-foo", "bar");

    expect(input).toHaveAttribute("aria-labelledby");
    const label = document.getElementById(input.getAttribute("aria-labelledby")!);
    expect(label).toHaveAttribute("class", "rv-Label");
    expect(label).toHaveTextContent("Test");

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
    const { getByRole } = renderUI(() => (
      <Provider token={TextFieldContext} value={{ slots: { test: { "aria-label": "test" } } }}>
        <TestTextField slot="test" />
      </Provider>
    ));
    const textbox = getByRole("textbox");
    expect(textbox.closest(".rv-TextField")).toHaveAttribute("slot", "test");
    expect(textbox).toHaveAttribute("aria-label", "test");
  });

  // RAC custom render function: covered in the render-*.browser.test.tsx files.

  it("should support hover state", async () => {
    const hoverStartSpy = vi.fn();
    const hoverChangeSpy = vi.fn();
    const hoverEndSpy = vi.fn();
    const { getByRole } = renderUI(() => (
      <TestTextField
        inputProps={{
          class: ({ isHovered }: { isHovered: () => boolean }) => (isHovered() ? "hover" : ""),
          onHoverStart: hoverStartSpy,
          onHoverChange: hoverChangeSpy,
          onHoverEnd: hoverEndSpy,
        }}
      />
    ));
    const input = getByRole("textbox");

    expect(input).not.toHaveAttribute("data-hovered");
    expect(input).not.toHaveClass("hover");

    await user.hover(input);
    expect(input).toHaveAttribute("data-hovered", "true");
    expect(input).toHaveClass("hover");
    expect(hoverStartSpy).toHaveBeenCalledTimes(1);
    expect(hoverChangeSpy).toHaveBeenCalledTimes(1);

    await user.unhover(input);
    expect(input).not.toHaveAttribute("data-hovered");
    expect(input).not.toHaveClass("hover");
    expect(hoverEndSpy).toHaveBeenCalledTimes(1);
    expect(hoverChangeSpy).toHaveBeenCalledTimes(2);
  });

  it("should support focus visible state", async () => {
    const { getByRole } = renderUI(() => (
      <TestTextField inputProps={{ class: ({ isFocusVisible }: { isFocusVisible: () => boolean }) => (isFocusVisible() ? "focus" : "") }} />
    ));
    const input = getByRole("textbox");

    expect(input).not.toHaveAttribute("data-focus-visible");
    expect(input).not.toHaveClass("focus");

    await user.tab();
    expect(document.activeElement).toBe(input);
    expect(input).toHaveAttribute("data-focus-visible", "true");
    expect(input).toHaveClass("focus");

    await user.tab();
    expect(input).not.toHaveAttribute("data-focus-visible");
    expect(input).not.toHaveClass("focus");
  });

  it("should support read-only state", async () => {
    const readOnly = signal(false);
    const { getByRole } = renderUI(() => <div>{() => (readOnly() ? <TestTextField isReadOnly /> : <TestTextField />)}</div>);
    expect(getByRole("textbox").closest(".rv-TextField")).not.toHaveAttribute("data-readonly");
    readOnly.set(true);
    await microtasks();
    expect(getByRole("textbox").closest(".rv-TextField")).toHaveAttribute("data-readonly");
  });

  it("should support required state", async () => {
    const required = signal(false);
    const { getByRole } = renderUI(() => <div>{() => (required() ? <TestTextField isRequired /> : <TestTextField />)}</div>);
    expect(getByRole("textbox").closest(".rv-TextField")).not.toHaveAttribute("data-required");
    required.set(true);
    await microtasks();
    expect(getByRole("textbox").closest(".rv-TextField")).toHaveAttribute("data-required");
  });

  it("should render data- attributes only on the outer element", () => {
    const { getAllByTestId } = renderUI(() => <TestTextField />);
    const outerEl = getAllByTestId("text-field-test");
    expect(outerEl).toHaveLength(1);
    expect(outerEl[0]).toHaveClass("rv-TextField");
  });

  it("supports validation errors", async () => {
    const { getByRole, getByTestId } = renderUI(() => (
      <form data-testid="form">
        <TextField isRequired>
          <Label>Test</Label>
          <Component />
          <FieldError />
        </TextField>
      </form>
    ));
    await microtasks();

    const input = getByRole("textbox") as HTMLInputElement;
    expect(input).toHaveAttribute("required");
    expect(input).not.toHaveAttribute("aria-required");
    expect(input).not.toHaveAttribute("aria-describedby");
    expect(input.validity.valid).toBe(false);

    (getByTestId("form") as HTMLFormElement).checkValidity();
    await microtasks();

    expect(input).toHaveAttribute("aria-describedby");
    expect(document.getElementById(input.getAttribute("aria-describedby")!)).toHaveTextContent(input.validationMessage);
    expect(input.closest(".rv-TextField")).toHaveAttribute("data-invalid");
    expect(document.activeElement).toBe(input);

    await user.keyboard("Devon");

    expect(input).toHaveAttribute("aria-describedby");
    expect(input.validity.valid).toBe(true);

    await user.tab();
    await microtasks();
    expect(input).not.toHaveAttribute("aria-describedby");
    expect(input.closest(".rv-TextField")).not.toHaveAttribute("data-invalid");
  });

  it("should not render the field error div if no error is provided and isInvalid is true", async () => {
    const { getByRole } = renderUI(() => (
      <form data-testid="form">
        <TextField isRequired isInvalid>
          <Label>Test</Label>
          <Component />
          <FieldError />
        </TextField>
      </form>
    ));
    await microtasks();

    const input = getByRole("textbox");
    expect(input).toHaveAttribute("aria-invalid");
    expect(input).toHaveAttribute("data-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
  });

  it("supports customizing validation errors", async () => {
    const { getByRole, getByTestId } = renderUI(() => (
      <form data-testid="form">
        <TextField isRequired>
          <Label>Test</Label>
          <Component />
          <FieldError>{(e: { validationDetails: () => ValidityState }) => (e.validationDetails().valueMissing ? "Please enter a name" : null)}</FieldError>
        </TextField>
      </form>
    ));
    await microtasks();

    const input = getByRole("textbox") as HTMLInputElement;
    expect(input).toHaveAttribute("required");
    expect(input).not.toHaveAttribute("aria-required");
    expect(input).not.toHaveAttribute("aria-describedby");
    expect(input.validity.valid).toBe(false);

    (getByTestId("form") as HTMLFormElement).checkValidity();
    await microtasks();

    expect(input).toHaveAttribute("aria-describedby");
    expect(document.getElementById(input.getAttribute("aria-describedby")!)).toHaveTextContent("Please enter a name");
    expect(document.activeElement).toBe(input);

    await user.keyboard("Devon");

    expect(input).toHaveAttribute("aria-describedby");
    expect(input.validity.valid).toBe(true);

    await user.tab();
    await microtasks();
    expect(input).not.toHaveAttribute("aria-describedby");
  });

  it("should render the id attribute only on the input element", () => {
    const { getAllByTestId, getByRole } = renderUI(() => <TestTextField id="name" />);
    const outerEl = getAllByTestId("text-field-test");
    const input = getByRole("textbox");

    expect(outerEl).toHaveLength(1);
    expect(outerEl[0]).not.toHaveAttribute("id");
    expect(input).toHaveAttribute("id", "name");
  });

  it("should link an id on the input to the label htmlFor", async () => {
    const { getAllByTestId, getByRole, getByText } = renderUI(() => (
      <TextField defaultValue="test" data-testid="text-field-test" data-foo="bar">
        <Label>Test</Label>
        <Input id="name" />
        <Text slot="description">Description</Text>
        <Text slot="errorMessage">Error</Text>
      </TextField>
    ));
    await microtasks();
    const outerEl = getAllByTestId("text-field-test");
    const input = getByRole("textbox");
    const label = getByText("Test");

    expect(outerEl).toHaveLength(1);
    expect(outerEl[0]).not.toHaveAttribute("id");
    expect(input).toHaveAttribute("id", "name");
    expect(label).toHaveAttribute("for", "name");
  });

  it("should support form prop", () => {
    const { getByRole } = renderUI(() => <TestTextField form="test" />);
    expect(getByRole("textbox")).toHaveAttribute("form", "test");
  });

  it.skip("resets to defaultValue when submitting form action (React 19 form actions)", () => {});
});

describe("TextField (Rivet)", () => {
  let user: ReturnType<typeof userEvent.setup>;
  beforeAll(() => {
    user = userEvent.setup();
  });

  it("accessor isInvalid stays live without re-creating the field", async () => {
    const invalid = signal(false);
    const { getByRole } = renderUI(() => (
      <TextField isInvalid={() => invalid()}>
        <Label>Name</Label>
        <Input />
        <FieldError>Bad name</FieldError>
      </TextField>
    ));
    await microtasks();
    const input = getByRole("textbox");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
    invalid.set(true);
    await microtasks();
    expect(getByRole("textbox")).toBe(input);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.closest(".rv-TextField")).toHaveAttribute("data-invalid");
    expect(document.getElementById(input.getAttribute("aria-describedby")!)).toHaveTextContent("Bad name");
  });

  it("two-way Signal value", async () => {
    const value = signal("a");
    const { getByRole } = renderUI(() => (
      <TextField value={value}>
        <Label>Name</Label>
        <Input />
      </TextField>
    ));
    const input = getByRole("textbox") as HTMLInputElement;
    expect(input).toHaveValue("a");
    await user.type(input, "b");
    expect(value()).toBe("ab");
    value.set("z");
    await microtasks();
    expect(input).toHaveValue("z");
  });

  it("Form validationErrors render in FieldError", async () => {
    const { getByRole } = renderUI(() => (
      <Form validationErrors={{ username: "Taken" }}>
        <TextField name="username">
          <Label>User</Label>
          <Input />
          <FieldError />
        </TextField>
      </Form>
    ));
    await microtasks();
    const input = getByRole("textbox");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(document.getElementById(input.getAttribute("aria-describedby")!)).toHaveTextContent("Taken");
  });

  it("merges FieldInputContext into the input (value accessor, onChange, handlers, aria-*), not the root", async () => {
    const query = signal("ab");
    const onChange = vi.fn((v: string) => query.set(v));
    const onKeyDown = vi.fn();
    const onPointerDown = vi.fn();
    const active = signal<string | undefined>(undefined);
    const { getByRole } = renderUI(() => (
      <Provider
        token={FieldInputContext}
        value={{
          value: () => query(),
          onChange: (v: string) => onChange(v),
          onKeyDown: (e: KeyboardEvent) => onKeyDown(e),
          onPointerDown: (e: PointerEvent) => onPointerDown(e),
          "aria-activedescendant": () => active(),
          "aria-controls": () => "list",
          "aria-autocomplete": "list",
          enterKeyHint: "go",
        }}
      >
        <TextField>
          <Label>Search</Label>
          <Input />
        </TextField>
      </Provider>
    ));
    const input = getByRole("textbox") as HTMLInputElement;
    expect(input).toHaveValue("ab");
    expect(input).toHaveAttribute("aria-controls", "list");
    expect(input).toHaveAttribute("aria-autocomplete", "list");
    expect(input).toHaveAttribute("enterkeyhint", "go");
    expect(input).not.toHaveAttribute("aria-activedescendant");
    active.set("opt-1");
    await microtasks();
    expect(input).toHaveAttribute("aria-activedescendant", "opt-1");
    await user.type(input, "c");
    expect(onChange).toHaveBeenLastCalledWith("abc");
    expect(onKeyDown).toHaveBeenCalled();
    expect(input).toHaveValue("abc");
    const pointerCalls = onPointerDown.mock.calls.length;
    expect(pointerCalls).toBeGreaterThan(0);
    // The root only gets the TextField's own DOM props.
    (input.closest(".rv-TextField") as HTMLElement).dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    expect(onPointerDown.mock.calls.length).toBe(pointerCalls);
  });
});
