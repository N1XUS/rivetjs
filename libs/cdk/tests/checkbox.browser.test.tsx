// Ported from react-aria-components test/Checkbox.test.js (react-spectrum, Apache-2.0, © Adobe).
// Changes: `render` from `@rivetjs/runtime/testing` (Chromium); queries via `@testing-library/dom` `within`;
// `className` → `class`; render props are accessors (`isHovered()`); `jest.fn` → `vi.fn`; `<Context.Provider value>`
// → runtime `Provider`; `React.createRef` → `ref()`; `rerender` → a signal the example reads; default classes `rv-*`;
// Chromium's validation message instead of jsdom's "Constraints not satisfied".
// Skipped: "should support custom render function" (now in the render-*.browser.test.tsx files); "should support callback ref"
// asserts the React 19 ref cleanup return value (Rivet callback refs get `null` on unmount — ported that way).
// Rivet additions (end of file): accessor `isSelected` (controlled, reports through onChange), accessor
// `isIndeterminate` / `isDisabled`, two-way Signal `isSelected`, CheckboxContext slots.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal } from "@rivetjs/reactivity";
import { Provider, ref as createRef, Show } from "@rivetjs/runtime/dom";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { Checkbox as AriaCheckbox, CheckboxButton, CheckboxContext, CheckboxField, CheckboxFieldContext } from "../checkbox/index.tsx";
import { FieldError } from "../form/field-error.tsx";
import { Form } from "../form/index.tsx";
import { Text } from "../text/index.tsx";

afterEach(cleanup);

function renderUI(ui: () => unknown) {
  const result = render(ui as never);
  return { ...within(result.container as HTMLElement), unmount: result.unmount };
}

type Props = Record<string, any>;

function CheckboxExample(props: Props) {
  const { buttonClass, onHoverStart, onHoverEnd, onHoverChange, children, description, ...rest } = props;
  return (
    <CheckboxField {...rest}>
      <CheckboxButton class={buttonClass} onHoverStart={onHoverStart} onHoverEnd={onHoverEnd} onHoverChange={onHoverChange}>
        {children}
      </CheckboxButton>
      <Show when={() => (typeof description === "function" ? description() : description)}>
        <Text slot="description">{typeof description === "function" ? () => description() : description}</Text>
      </Show>
      <FieldError />
    </CheckboxField>
  );
}

function CheckboxLegacy(props: Props) {
  const { buttonClass, class: className, ...rest } = props;
  return <AriaCheckbox {...rest} class={className || buttonClass} />;
}

describe.each(["Checkbox", "CheckboxField"])("%s", (comp) => {
  let user: ReturnType<typeof userEvent.setup>;
  beforeAll(() => {
    user = userEvent.setup();
  });

  const Checkbox = comp === "CheckboxField" ? CheckboxExample : CheckboxLegacy;
  const findRoot = (el: Element) => (comp === "CheckboxField" ? el.closest("label")!.parentElement! : el.closest("label")!);

  it("should render a checkbox with default class", () => {
    const { getByRole } = renderUI(() => <Checkbox>Test</Checkbox>);
    const checkbox = getByRole("checkbox").closest("label")!;
    expect(findRoot(checkbox)).toHaveAttribute("class", `rv-${comp}`);
  });

  it("should render a checkbox with custom class", () => {
    const { getByRole } = renderUI(() => <Checkbox class="test">Test</Checkbox>);
    const checkbox = getByRole("checkbox").closest("label")!;
    expect(findRoot(checkbox)).toHaveAttribute("class", "test");
  });

  it("should support DOM props", () => {
    const { getByRole } = renderUI(() => <Checkbox data-foo="bar">Test</Checkbox>);
    const checkbox = getByRole("checkbox").closest("label")!;
    expect(findRoot(checkbox)).toHaveAttribute("data-foo", "bar");
    expect(getByRole("checkbox")).not.toHaveAttribute("data-foo", "bar");
  });

  it("should support slot", () => {
    const Context = comp === "CheckboxField" ? CheckboxFieldContext : CheckboxContext;
    const { getByRole } = renderUI(() => (
      <Provider token={Context as never} value={{ slots: { test: { "aria-label": "test" } } }}>
        <Checkbox slot="test">Test</Checkbox>
      </Provider>
    ));

    const checkbox = getByRole("checkbox");
    expect(findRoot(checkbox.closest("label")!)).toHaveAttribute("slot", "test");
    expect(checkbox).toHaveAttribute("aria-label", "test");
  });

  it("should support hover", async () => {
    const hoverStartSpy = vi.fn();
    const hoverChangeSpy = vi.fn();
    const hoverEndSpy = vi.fn();
    const { getByRole } = renderUI(() => (
      <Checkbox
        buttonClass={({ isHovered }: { isHovered: () => boolean }) => (isHovered() ? "hover" : "")}
        onHoverStart={hoverStartSpy}
        onHoverChange={hoverChangeSpy}
        onHoverEnd={hoverEndSpy}
      >
        Test
      </Checkbox>
    ));
    const checkbox = getByRole("checkbox").closest("label")!;

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
      <Checkbox buttonClass={({ isFocusVisible }: { isFocusVisible: () => boolean }) => (isFocusVisible() ? "focus" : "")}>Test</Checkbox>
    ));
    const checkbox = getByRole("checkbox");
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
        <Checkbox onFocus={onFocus} onFocusChange={onFocusChange} onBlur={onBlur}>
          Test
        </Checkbox>
        <button>Steal focus</button>
      </>
    ));

    const checkbox = getByRole("checkbox");
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
      <Checkbox
        buttonClass={({ isPressed }: { isPressed: () => boolean }) => (isPressed() ? "pressed" : "")}
        onPress={onPress}
        onClick={onClick}
        onClickCapture={onClickCapture}
      >
        Test
      </Checkbox>
    ));
    const checkbox = getByRole("checkbox").closest("label")!;

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
      <Checkbox buttonClass={({ isPressed }: { isPressed: () => boolean }) => (isPressed() ? "pressed" : "")} onPress={onPress} onClick={onClick}>
        Test
      </Checkbox>
    ));
    const checkbox = getByRole("checkbox").closest("label")!;

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
      <Checkbox isDisabled class={({ isDisabled }: { isDisabled: () => boolean }) => (isDisabled() ? "disabled" : "")}>
        Test
      </Checkbox>
    ));
    const checkbox = getByRole("checkbox");
    const label = checkbox.closest("label")!;

    expect(checkbox).toBeDisabled();
    expect(label).toHaveAttribute("data-disabled", "true");
    expect(findRoot(label)).toHaveAttribute("data-disabled", "true");
    expect(findRoot(label)).toHaveClass("disabled");
  });

  it("should support selected state", async () => {
    const onChange = vi.fn();
    const { getByRole } = renderUI(() => (
      <Checkbox onChange={onChange} buttonClass={({ isSelected }: { isSelected: () => boolean }) => (isSelected() ? "selected" : "")}>
        Test
      </Checkbox>
    ));
    const checkbox = getByRole("checkbox");
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

  it("should support indeterminate state", () => {
    const { getByRole } = renderUI(() => (
      <Checkbox isIndeterminate buttonClass={({ isIndeterminate }: { isIndeterminate: () => boolean }) => (isIndeterminate() ? "indeterminate" : "")}>
        Test
      </Checkbox>
    ));
    const checkbox = getByRole("checkbox");
    const label = checkbox.closest("label")!;

    expect(checkbox).toHaveProperty("indeterminate", true);
    expect(label).toHaveAttribute("data-indeterminate");
    expect(findRoot(label)).toHaveAttribute("data-indeterminate");
    expect(label).toHaveClass("indeterminate");
  });

  it("should support read only state", () => {
    const { getByRole } = renderUI(() => (
      <Checkbox isReadOnly buttonClass={({ isReadOnly }: { isReadOnly: () => boolean }) => (isReadOnly() ? "readonly" : "")}>
        Test
      </Checkbox>
    ));
    const checkbox = getByRole("checkbox");
    const label = checkbox.closest("label")!;

    expect(checkbox).toHaveAttribute("aria-readonly", "true");
    expect(label).toHaveAttribute("data-readonly");
    expect(findRoot(label)).toHaveAttribute("data-readonly");
    expect(label).toHaveClass("readonly");
  });

  it("should support invalid state", () => {
    const { getByRole } = renderUI(() => (
      <Checkbox isInvalid buttonClass={({ isInvalid }: { isInvalid: () => boolean }) => (isInvalid() ? "invalid" : "")}>
        Test
      </Checkbox>
    ));
    const checkbox = getByRole("checkbox");
    const label = checkbox.closest("label")!;

    expect(checkbox).toHaveAttribute("aria-invalid", "true");
    expect(label).toHaveAttribute("data-invalid", "true");
    expect(findRoot(label)).toHaveAttribute("data-invalid", "true");
    expect(label).toHaveClass("invalid");
  });

  if (comp === "CheckboxField") {
    it("should support description", async () => {
      const { getByRole } = renderUI(() => <Checkbox description="hello">Test</Checkbox>);
      const checkbox = getByRole("checkbox");
      await microtasks();
      expect(checkbox).toHaveAttribute("aria-describedby");
      expect(document.getElementById(checkbox.getAttribute("aria-describedby")!)).toHaveTextContent("hello");
    });

    it("should update aria-describedby when changing description prop", async () => {
      const description = signal<string | undefined>(undefined);
      const { getByRole } = renderUI(() => <Checkbox description={description}>Test</Checkbox>);
      const checkbox = getByRole("checkbox");
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

  it("should support required state", async () => {
    const { getByRole } = renderUI(() => (
      <Form>
        <Checkbox isRequired buttonClass={({ isRequired }: { isRequired: () => boolean }) => (isRequired() ? "required" : "")}>
          Test
        </Checkbox>
      </Form>
    ));
    const checkbox = getByRole("checkbox") as HTMLInputElement;
    const label = checkbox.closest("label")!;

    expect(checkbox).toHaveAttribute("required");
    expect(label).toHaveAttribute("data-required", "true");
    expect(label).toHaveClass("required");
    expect(findRoot(label)).toHaveAttribute("data-required", "true");

    if (comp === "CheckboxField") {
      await microtasks();
      expect(checkbox).not.toHaveAttribute("aria-describedby");
      checkbox.form!.requestSubmit();
      await microtasks();

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
    const { getByRole } = renderUI(() => (
      <Checkbox>{({ isSelected }: { isSelected: () => boolean }) => (isSelected() ? "Selected" : "Not Selected")}</Checkbox>
    ));
    const checkbox = getByRole("checkbox").closest("label")!;

    expect(checkbox).toHaveTextContent("Not Selected");

    await user.click(checkbox);
    expect(checkbox).toHaveTextContent("Selected");
  });

  it("should support refs", () => {
    const ref = createRef<HTMLElement>();
    const { getByRole } = renderUI(() => <Checkbox ref={ref}>Test</Checkbox>);
    expect(ref()).toBe(findRoot(getByRole("checkbox")));
  });

  it("should support input ref", () => {
    const inputRef = createRef<HTMLInputElement>();
    const { getByRole } = renderUI(() => <Checkbox inputRef={inputRef}>Test</Checkbox>);
    expect(inputRef()).toBe(getByRole("checkbox"));
  });

  it("should support callback ref", () => {
    const onRef = vi.fn();
    const { getByRole, unmount } = renderUI(() => <Checkbox inputRef={onRef}>Test</Checkbox>);
    expect(onRef).toHaveBeenCalledWith(getByRole("checkbox"));
    unmount();
  });

  it("should support and merge input ref on context", () => {
    const inputRef = createRef<HTMLInputElement>();
    const contextInputRef = createRef<HTMLInputElement>();
    const Context = comp === "CheckboxField" ? CheckboxFieldContext : CheckboxContext;
    const { getByRole } = renderUI(() => (
      <Provider token={Context as never} value={{ inputRef: contextInputRef }}>
        <Checkbox inputRef={inputRef}>Test</Checkbox>
      </Provider>
    ));
    expect(inputRef()).toBe(getByRole("checkbox"));
    expect(contextInputRef()).toBe(getByRole("checkbox"));
  });

  it("should support form prop", () => {
    const { getByRole } = renderUI(() => <Checkbox form="test">Test</Checkbox>);
    const checkbox = getByRole("checkbox");
    expect(checkbox).toHaveAttribute("form", "test");
  });

  it("should not trigger onBlur/onFocus on sequential presses", async () => {
    const onBlur = vi.fn();
    const onFocus = vi.fn();
    const { getByRole } = renderUI(() => (
      <Checkbox onFocus={onFocus} onBlur={onBlur}>
        Test
      </Checkbox>
    ));

    const checkbox = getByRole("checkbox");
    const label = checkbox.closest("label")!;

    await user.click(label);
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).not.toHaveBeenCalled();

    onFocus.mockClear();

    await user.click(label);

    expect(onBlur).not.toHaveBeenCalled();
    expect(onFocus).not.toHaveBeenCalled();
  });

  it("should support implicit form submission from a focused checkbox on Enter", async () => {
    const onSubmit = vi.fn((e: Event) => e.preventDefault());
    const { getByRole } = renderUI(() => (
      <form onSubmit={onSubmit}>
        <Checkbox>Test</Checkbox>
        <button type="submit">Submit</button>
      </form>
    ));

    const checkbox = getByRole("checkbox");
    await user.click(checkbox);
    await user.keyboard("{Enter}");

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

const microtasks = async () => {
  for (let i = 0; i < 4; i++) await Promise.resolve();
};

describe("Checkbox (Rivet)", () => {
  let user: ReturnType<typeof userEvent.setup>;
  beforeAll(() => {
    user = userEvent.setup();
  });

  it("accessor isSelected: controlled by the caller, changes reported through onChange", async () => {
    const selected = signal(false);
    const onChange = vi.fn((v: boolean) => selected.set(v));
    const { getByRole } = renderUI(() => (
      <AriaCheckbox isSelected={() => selected()} onChange={onChange}>
        Test
      </AriaCheckbox>
    ));
    const checkbox = getByRole("checkbox") as HTMLInputElement;
    await user.click(checkbox);
    expect(onChange).toHaveBeenLastCalledWith(true);
    expect(checkbox.checked).toBe(true);
    selected.set(false);
    await microtasks();
    expect(checkbox.checked).toBe(false);
    expect(checkbox.closest("label")).not.toHaveAttribute("data-selected");
  });

  it("plain controlled isSelected without a state change keeps the input unchecked", async () => {
    const onChange = vi.fn();
    const { getByRole } = renderUI(() => (
      <AriaCheckbox isSelected={false} onChange={onChange}>
        Test
      </AriaCheckbox>
    ));
    const checkbox = getByRole("checkbox") as HTMLInputElement;
    await user.click(checkbox);
    expect(onChange).toHaveBeenLastCalledWith(true);
    await microtasks();
    expect(checkbox.checked).toBe(false);
  });

  it("two-way Signal isSelected", async () => {
    const selected = signal(true);
    const { getByRole } = renderUI(() => <AriaCheckbox isSelected={selected}>Test</AriaCheckbox>);
    const checkbox = getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    await user.click(checkbox);
    expect(selected()).toBe(false);
    selected.set(true);
    await microtasks();
    expect(checkbox.checked).toBe(true);
  });

  it("accessor isIndeterminate and isDisabled stay live", async () => {
    const mixed = signal(true);
    const disabled = signal(false);
    const { getByRole } = renderUI(() => (
      <AriaCheckbox isIndeterminate={() => mixed()} isDisabled={() => disabled()}>
        Test
      </AriaCheckbox>
    ));
    const checkbox = getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.indeterminate).toBe(true);
    mixed.set(false);
    disabled.set(true);
    await microtasks();
    expect(checkbox.indeterminate).toBe(false);
    expect(checkbox).toBeDisabled();
    expect(checkbox.closest("label")).toHaveAttribute("data-disabled", "true");
  });

  it("CheckboxContext slots (collection selection checkbox)", () => {
    const { getByRole } = renderUI(() => (
      <Provider token={CheckboxContext} value={{ slots: { selection: { "aria-label": "Select row", isSelected: () => true } } }}>
        <AriaCheckbox slot="selection" />
      </Provider>
    ));
    const checkbox = getByRole("checkbox", { name: "Select row" });
    expect(checkbox).toBeChecked();
  });
});
