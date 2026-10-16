// Ported from react-aria-components test/Switch.test.js (react-spectrum, Apache-2.0, © Adobe).
// Changes: `render` from `@rivetjs/runtime/testing` (Chromium); queries via `@testing-library/dom` `within`;
// `className` → `class`; render props are accessors (`isSelected()`); `jest.fn` → `vi.fn`; `<Context.Provider value>`
// → runtime `Provider`; `React.createRef` → `ref()`; `rerender` → a signal the example reads; default classes `rv-*`;
// Chromium's validation message instead of jsdom's "Constraints not satisfied"; `aria-describedby` read after the
// slot-id check (a microtask after mount).
// Skipped: "should support custom render function" (now in the render-*.browser.test.tsx files); "should support callback ref"
// asserts the React 19 ref cleanup return value (ported: the callback gets the input).
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal } from "@rivetjs/reactivity";
import { Provider, ref as createRef, Show } from "@rivetjs/runtime/dom";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { Switch as AriaSwitch, SwitchButton, SwitchContext, SwitchField, SwitchFieldContext } from "../switch/index.tsx";
import { FieldError } from "../form/field-error.tsx";
import { Form } from "../form/index.tsx";
import { Text } from "../text/index.tsx";

afterEach(cleanup);

function renderUI(ui: () => unknown) {
  const result = render(ui as never);
  return { ...within(result.container as HTMLElement), unmount: result.unmount };
}

type Props = Record<string, any>;

function SwitchExample(props: Props) {
  const { buttonClass, onHoverStart, onHoverEnd, onHoverChange, children, description, ...rest } = props;
  return (
    <SwitchField {...rest}>
      <SwitchButton class={buttonClass} onHoverStart={onHoverStart} onHoverEnd={onHoverEnd} onHoverChange={onHoverChange}>
        {children}
      </SwitchButton>
      <Show when={() => (typeof description === "function" ? description() : description)}>
        <Text slot="description">{typeof description === "function" ? () => description() : description}</Text>
      </Show>
      <FieldError />
    </SwitchField>
  );
}

function SwitchLegacy(props: Props) {
  const { buttonClass, class: className, ...rest } = props;
  return <AriaSwitch {...rest} class={className || buttonClass} />;
}

describe.each(["Switch", "SwitchField"])("%s", (comp) => {
  let user: ReturnType<typeof userEvent.setup>;
  beforeAll(() => {
    user = userEvent.setup();
  });

  const Switch = comp === "SwitchField" ? SwitchExample : SwitchLegacy;
  const findRoot = (el: Element) => (comp === "SwitchField" ? el.closest("label")!.parentElement! : el.closest("label")!);

  it("should render a switch with default class", () => {
    const { getByRole } = renderUI(() => <Switch>Test</Switch>);
    const checkbox = getByRole("switch").closest("label")!;
    expect(findRoot(checkbox)).toHaveAttribute("class", `rv-${comp}`);
  });

  it("should render a switch with custom class", () => {
    const { getByRole } = renderUI(() => <Switch class="test">Test</Switch>);
    const checkbox = getByRole("switch").closest("label")!;
    expect(findRoot(checkbox)).toHaveAttribute("class", "test");
  });

  it("should support DOM props", () => {
    const { getByRole } = renderUI(() => <Switch data-foo="bar">Test</Switch>);
    const checkbox = getByRole("switch").closest("label")!;
    expect(findRoot(checkbox)).toHaveAttribute("data-foo", "bar");
    expect(getByRole("switch")).not.toHaveAttribute("data-foo", "bar");
  });

  it("should support slot", () => {
    const Context = comp === "SwitchField" ? SwitchFieldContext : SwitchContext;
    const { getByRole } = renderUI(() => (
      <Provider token={Context as never} value={{ slots: { test: { "aria-label": "test" } } }}>
        <Switch slot="test">Test</Switch>
      </Provider>
    ));

    const checkbox = getByRole("switch");
    expect(findRoot(checkbox.closest("label")!)).toHaveAttribute("slot", "test");
    expect(checkbox).toHaveAttribute("aria-label", "test");
  });

  it("should support hover", async () => {
    const hoverStartSpy = vi.fn();
    const hoverChangeSpy = vi.fn();
    const hoverEndSpy = vi.fn();
    const { getByRole } = renderUI(() => (
      <Switch
        buttonClass={({ isHovered }: { isHovered: () => boolean }) => (isHovered() ? "hover" : "")}
        onHoverStart={hoverStartSpy}
        onHoverChange={hoverChangeSpy}
        onHoverEnd={hoverEndSpy}
      >
        Test
      </Switch>
    ));
    const checkbox = getByRole("switch").closest("label")!;

    expect(checkbox).not.toHaveAttribute("data-hovered");
    expect(checkbox).not.toHaveClass("hover");

    await user.hover(checkbox);
    expect(checkbox).toHaveAttribute("data-hovered", "true");
    expect(checkbox).toHaveClass("hover");
    expect(hoverStartSpy).toHaveBeenCalledTimes(1);
    expect(hoverChangeSpy).toHaveBeenCalledTimes(1);

    await user.unhover(checkbox);
    expect(checkbox).not.toHaveAttribute("data-hovered");
    expect(checkbox).not.toHaveClass("hover");
    expect(hoverEndSpy).toHaveBeenCalledTimes(1);
    expect(hoverChangeSpy).toHaveBeenCalledTimes(2);
  });

  it("should support focus ring", async () => {
    const { getByRole } = renderUI(() => (
      <Switch buttonClass={({ isFocusVisible }: { isFocusVisible: () => boolean }) => (isFocusVisible() ? "focus" : "")}>Test</Switch>
    ));
    const checkbox = getByRole("switch");
    const label = checkbox.closest("label")!;

    expect(label).not.toHaveAttribute("data-focus-visible");
    expect(label).not.toHaveClass("focus");

    await user.tab();
    expect(document.activeElement).toBe(checkbox);
    expect(label).toHaveAttribute("data-focus-visible", "true");
    expect(label).toHaveClass("focus");

    await user.tab();
    expect(label).not.toHaveAttribute("data-focus-visible");
    expect(label).not.toHaveClass("focus");
  });

  it("should support focus events", async () => {
    const onBlur = vi.fn();
    const onFocus = vi.fn();
    const onFocusChange = vi.fn();
    const { getByRole, getByText } = renderUI(() => (
      <>
        <Switch onFocus={onFocus} onFocusChange={onFocusChange} onBlur={onBlur}>
          Test
        </Switch>
        <button>Steal focus</button>
      </>
    ));

    const checkbox = getByRole("switch");
    const button = getByText("Steal focus");

    await user.tab();
    expect(document.activeElement).toBe(checkbox);
    expect(onBlur).not.toHaveBeenCalled();
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onFocusChange).toHaveBeenCalledTimes(1); // triggered by onFocus
    expect(onFocusChange).toHaveBeenLastCalledWith(true);

    await user.tab();
    expect(document.activeElement).toBe(button);
    expect(onBlur).toHaveBeenCalled();
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onFocusChange).toHaveBeenCalledTimes(2); // triggered by onBlur
    expect(onFocusChange).toHaveBeenLastCalledWith(false);
  });

  it("should support press state", async () => {
    const onPress = vi.fn();
    const onClick = vi.fn();
    const onClickCapture = vi.fn();
    const { getByRole } = renderUI(() => (
      <Switch
        buttonClass={({ isPressed }: { isPressed: () => boolean }) => (isPressed() ? "pressed" : "")}
        onPress={onPress}
        onClick={onClick}
        onClickCapture={onClickCapture}
      >
        Test
      </Switch>
    ));
    const checkbox = getByRole("switch").closest("label")!;

    expect(checkbox).not.toHaveAttribute("data-pressed");
    expect(checkbox).not.toHaveClass("pressed");

    await user.pointer({ target: checkbox, keys: "[MouseLeft>]" });
    expect(checkbox).toHaveAttribute("data-pressed", "true");
    expect(checkbox).toHaveClass("pressed");

    await user.pointer({ target: checkbox, keys: "[/MouseLeft]" });
    expect(checkbox).not.toHaveAttribute("data-pressed");
    expect(checkbox).not.toHaveClass("pressed");

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClickCapture).toHaveBeenCalledTimes(1);
  });

  it("should support press state with keyboard", async () => {
    const onPress = vi.fn();
    const onClick = vi.fn();
    const { getByRole } = renderUI(() => (
      <Switch buttonClass={({ isPressed }: { isPressed: () => boolean }) => (isPressed() ? "pressed" : "")} onPress={onPress} onClick={onClick}>
        Test
      </Switch>
    ));
    const checkbox = getByRole("switch").closest("label")!;

    expect(checkbox).not.toHaveAttribute("data-pressed");
    expect(checkbox).not.toHaveClass("pressed");

    await user.tab();
    await user.keyboard("[Space>]");
    expect(checkbox).toHaveAttribute("data-pressed", "true");
    expect(checkbox).toHaveClass("pressed");

    await user.keyboard("[/Space]");
    expect(checkbox).not.toHaveAttribute("data-pressed");
    expect(checkbox).not.toHaveClass("pressed");

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("should support disabled state", () => {
    const { getByRole } = renderUI(() => (
      <Switch isDisabled class={({ isDisabled }: { isDisabled: () => boolean }) => (isDisabled() ? "disabled" : "")}>
        Test
      </Switch>
    ));
    const checkbox = getByRole("switch");
    const label = checkbox.closest("label")!;

    expect(checkbox).toBeDisabled();
    expect(label).toHaveAttribute("data-disabled", "true");
    expect(findRoot(label)).toHaveAttribute("data-disabled", "true");
    expect(findRoot(label)).toHaveClass("disabled");
  });

  it("should support selected state", async () => {
    const onChange = vi.fn();
    const { getByRole } = renderUI(() => (
      <Switch onChange={onChange} buttonClass={({ isSelected }: { isSelected: () => boolean }) => (isSelected() ? "selected" : "")}>
        Test
      </Switch>
    ));
    const checkbox = getByRole("switch");
    const label = checkbox.closest("label")!;

    expect(checkbox).not.toBeChecked();
    expect(label).not.toHaveAttribute("data-selected");
    expect(findRoot(label)).not.toHaveAttribute("data-selected");
    expect(label).not.toHaveClass("selected");

    await user.click(checkbox);
    expect(onChange).toHaveBeenLastCalledWith(true);
    expect(checkbox).toBeChecked();
    expect(label).toHaveAttribute("data-selected", "true");
    expect(findRoot(label)).toHaveAttribute("data-selected", "true");
    expect(label).toHaveClass("selected");

    await user.click(checkbox);
    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(checkbox).not.toBeChecked();
    expect(label).not.toHaveAttribute("data-selected");
    expect(findRoot(label)).not.toHaveAttribute("data-selected");
    expect(label).not.toHaveClass("selected");
  });

  it("should support read only state", () => {
    const { getByRole } = renderUI(() => (
      <Switch isReadOnly buttonClass={({ isReadOnly }: { isReadOnly: () => boolean }) => (isReadOnly() ? "readonly" : "")}>
        Test
      </Switch>
    ));
    const checkbox = getByRole("switch");
    const label = checkbox.closest("label")!;

    expect(checkbox).toHaveAttribute("aria-readonly", "true");
    expect(label).toHaveAttribute("data-readonly");
    expect(findRoot(label)).toHaveAttribute("data-readonly");
    expect(label).toHaveClass("readonly");
  });

  if (comp === "SwitchField") {
    it("should support description", async () => {
      const { getByRole } = renderUI(() => <Switch description="hello">Test</Switch>);
      const checkbox = getByRole("switch");
      await microtasks();
      expect(checkbox).toHaveAttribute("aria-describedby");
      expect(document.getElementById(checkbox.getAttribute("aria-describedby")!)).toHaveTextContent("hello");
    });

    it("should update aria-describedby when changing description prop", async () => {
      const description = signal<string | undefined>(undefined);
      const { getByRole } = renderUI(() => <Switch description={description}>Test</Switch>);
      const checkbox = getByRole("switch");
      await microtasks();
      expect(checkbox).not.toHaveAttribute("aria-describedby");

      description.set("hello");
      await microtasks();
      expect(checkbox).toHaveAttribute("aria-describedby");

      description.set(undefined);
      await microtasks();
      expect(checkbox).not.toHaveAttribute("aria-describedby");
    });
  }

  if (comp === "SwitchField")
    it("should support required state (SwitchField)", async () => {
      const { getByRole } = renderUI(() => (
        <Form>
          <Switch isRequired buttonClass={({ isRequired }: { isRequired: () => boolean }) => (isRequired() ? "required" : "")}>
            Test
          </Switch>
        </Form>
      ));
      const checkbox = getByRole("switch") as HTMLInputElement;
      const label = checkbox.closest("label")!;

      expect(checkbox).toHaveAttribute("required");
      expect(label).toHaveAttribute("data-required", "true");
      expect(label).toHaveClass("required");
      expect(findRoot(label)).toHaveAttribute("data-required", "true");

      {
        await microtasks();
        expect(checkbox).not.toHaveAttribute("aria-describedby");
        checkbox.form!.requestSubmit();
        await microtasks();

        expect(checkbox).toHaveAttribute("aria-invalid", "true");
        expect(label).toHaveAttribute("data-invalid", "true");
        expect(findRoot(label)).toHaveAttribute("data-invalid", "true");

        expect(checkbox).toHaveAttribute("aria-describedby");
        expect(document.getElementById(checkbox.getAttribute("aria-describedby")!)!.textContent).toBe(checkbox.validationMessage);
      }

      await user.click(label);

      expect(checkbox).not.toHaveAttribute("aria-invalid");
      expect(label).not.toHaveAttribute("data-invalid");
      expect(findRoot(label)).not.toHaveAttribute("data-invalid");
      await microtasks();
      expect(checkbox).not.toHaveAttribute("aria-describedby");
    });

  it("should support render props", async () => {
    const { getByRole } = renderUI(() => <Switch>{({ isSelected }: { isSelected: () => boolean }) => (isSelected() ? "On" : "Off")}</Switch>);
    const s = getByRole("switch");
    const label = s.closest("label")!;
    expect(s).not.toBeChecked();
    expect(label).toHaveTextContent("Off");

    await user.click(s);

    expect(s).toBeChecked();
    expect(label).toHaveTextContent("On");
  });

  it("should support refs", () => {
    const ref = createRef<HTMLElement>();
    const { getByRole } = renderUI(() => <Switch ref={ref}>Test</Switch>);
    expect(ref()).toBe(findRoot(getByRole("switch")));
  });

  it("should support input ref", () => {
    const inputRef = createRef<HTMLInputElement>();
    const { getByRole } = renderUI(() => <Switch inputRef={inputRef}>Test</Switch>);
    expect(inputRef()).toBe(getByRole("switch"));
  });

  it("should support callback ref", () => {
    const onRef = vi.fn();
    const { getByRole, unmount } = renderUI(() => <Switch inputRef={onRef}>Test</Switch>);
    expect(onRef).toHaveBeenCalledWith(getByRole("switch"));
    unmount();
  });

  it("should support and merge input ref on context", () => {
    const inputRef = createRef<HTMLInputElement>();
    const contextInputRef = createRef<HTMLInputElement>();
    const Context = comp === "SwitchField" ? SwitchFieldContext : SwitchContext;
    const { getByRole } = renderUI(() => (
      <Provider token={Context as never} value={{ inputRef: contextInputRef }}>
        <Switch inputRef={inputRef}>Test</Switch>
      </Provider>
    ));
    expect(inputRef()).toBe(getByRole("switch"));
    expect(contextInputRef()).toBe(getByRole("switch"));
  });

  it("should render data- attributes only on the outer element", () => {
    const { getAllByTestId } = renderUI(() => <Switch data-testid="switch-test">Test</Switch>);
    const outerEl = getAllByTestId("switch-test");
    expect(outerEl).toHaveLength(1);
    expect(outerEl[0]).toHaveClass(`rv-${comp}`);
  });

  it("should support form prop", () => {
    const { getByRole } = renderUI(() => <Switch form="test">Test</Switch>);
    const checkbox = getByRole("switch");
    expect(checkbox).toHaveAttribute("form", "test");
  });

  it("should support implicit form submission from a focused switch on Enter", async () => {
    const onSubmit = vi.fn((e: Event) => e.preventDefault());
    const { getByRole } = renderUI(() => (
      <form onSubmit={onSubmit}>
        <Switch>Test</Switch>
        <button type="submit">Submit</button>
      </form>
    ));

    const checkbox = getByRole("switch");
    await user.click(checkbox);
    await user.keyboard("{Enter}");

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

const microtasks = async () => {
  for (let i = 0; i < 4; i++) await Promise.resolve();
};
