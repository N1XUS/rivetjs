// Ported from react-aria-components test/CheckboxGroup.test.js (react-spectrum, Apache-2.0, © Adobe).
// Changes: `render` from `@rivetjs/runtime/testing` (Chromium); queries via `@testing-library/dom` `within`;
// `className` → `class`; render props are accessors (`isDisabled()`); `jest.fn` → `vi.fn`;
// `<Context.Provider value>` → runtime `Provider`; default classes `rv-*`; Chromium's validation message
// instead of jsdom's "Constraints not satisfied"; `aria-describedby` read after the slot-id check (RA useSlotId
// layout effect → a microtask after mount).
// Skipped: "should support custom render function" (now in the render-*.browser.test.tsx files).
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { Provider } from "@rivetjs/runtime/dom";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { Checkbox as AriaCheckbox, CheckboxButton, CheckboxField, CheckboxGroup, CheckboxGroupContext } from "../checkbox/index.tsx";
import { FieldError } from "../form/field-error.tsx";
import { Label } from "../label/index.tsx";
import { Text } from "../text/index.tsx";

afterEach(cleanup);

function renderUI(ui: () => unknown) {
  const result = render(ui as never);
  return within(result.container as HTMLElement);
}

const microtasks = async () => {
  for (let i = 0; i < 4; i++) await Promise.resolve();
};

type Props = Record<string, any>;

function CheckboxExample(props: Props) {
  const { buttonClass, onHoverStart, onHoverEnd, onHoverChange, children, description, ...rest } = props;
  return (
    <CheckboxField {...rest}>
      <CheckboxButton class={buttonClass} onHoverStart={onHoverStart} onHoverEnd={onHoverEnd} onHoverChange={onHoverChange}>
        {children}
      </CheckboxButton>
      {description ? <Text slot="description">{description}</Text> : null}
      <FieldError />
    </CheckboxField>
  );
}

function CheckboxLegacy(props: Props) {
  const { buttonClass, class: className, description: _description, ...rest } = props;
  return <AriaCheckbox {...rest} class={className || buttonClass} />;
}

describe.each(["CheckboxField", "Checkbox"])("CheckboxGroup with %s", (comp) => {
  let user: ReturnType<typeof userEvent.setup>;
  beforeAll(() => {
    user = userEvent.setup();
  });

  const Checkbox = comp === "CheckboxField" ? CheckboxExample : CheckboxLegacy;
  const findRoot = (el: Element) => (comp === "CheckboxField" ? el.closest("label")!.parentElement! : el.closest("label")!);
  const TestCheckboxGroup = (p: { groupProps?: Props; checkboxProps?: Props }) => {
    const groupProps = p.groupProps ?? {};
    const checkboxProps = p.checkboxProps ?? {};
    return (
      <CheckboxGroup {...groupProps}>
        <Label>Test</Label>
        <Checkbox {...checkboxProps} value="a">
          A
        </Checkbox>
        <Checkbox {...checkboxProps} value="b">
          B
        </Checkbox>
        <Checkbox {...checkboxProps} value="c">
          C
        </Checkbox>
      </CheckboxGroup>
    );
  };

  const renderGroup = (groupProps?: Props, checkboxProps?: Props) =>
    renderUI(() => <TestCheckboxGroup groupProps={groupProps} checkboxProps={checkboxProps} />);

  it("should render a checkbox group with default classes", () => {
    const { getByRole, getAllByRole } = renderGroup();
    const group = getByRole("group");
    expect(group).toHaveAttribute("class", "rv-CheckboxGroup");
    expect(group).toHaveAttribute("aria-labelledby");
    expect(document.getElementById(group.getAttribute("aria-labelledby")!)).toHaveTextContent("Test");

    const checkboxes = getAllByRole("checkbox");
    for (const checkbox of checkboxes) {
      expect(findRoot(checkbox)).toHaveAttribute("class", `rv-${comp}`);
    }
  });

  it("should render a checkbox group with custom classes", () => {
    const { getByRole, getAllByRole } = renderGroup({ class: "group" }, { class: "checkbox" });
    const group = getByRole("group");
    expect(group).toHaveAttribute("class", "group");
    const checkboxes = getAllByRole("checkbox");
    for (const checkbox of checkboxes) {
      expect(findRoot(checkbox)).toHaveAttribute("class", "checkbox");
    }
  });

  it("should support DOM props", () => {
    const { getByRole } = renderGroup({ "data-foo": "bar" });
    const group = getByRole("group");
    expect(group).toHaveAttribute("data-foo", "bar");
  });

  it("should support slot", () => {
    const { getByRole } = renderUI(() => (
      <Provider token={CheckboxGroupContext} value={{ slots: { test: { "aria-label": "test" } } }}>
        <TestCheckboxGroup groupProps={{ slot: "test" }} />
      </Provider>
    ));

    const group = getByRole("group");
    expect(group).toHaveAttribute("slot", "test");
    expect(group).toHaveAttribute("aria-label", "test");
  });

  it("should support disabled state on checkbox", () => {
    const { getAllByRole } = renderGroup({}, { isDisabled: true, class: ({ isDisabled }: Props) => (isDisabled() ? "disabled" : "") });
    const checkbox = getAllByRole("checkbox")[0]!;
    const label = checkbox.closest("label");

    expect(checkbox).toBeDisabled();
    expect(label).toHaveAttribute("data-disabled", "true");
    expect(findRoot(checkbox)).toHaveAttribute("data-disabled", "true");
    expect(findRoot(checkbox)).toHaveClass("disabled");
  });

  it("should support disabled state on group", () => {
    const className = ({ isDisabled }: Props) => (isDisabled() ? "disabled" : "");
    const { getByRole, getAllByRole } = renderGroup({ isDisabled: true, class: className }, { class: className });
    const group = getByRole("group");
    const checkbox = getAllByRole("checkbox")[0]!;
    const label = checkbox.closest("label");

    expect(group).toHaveAttribute("aria-disabled");
    expect(group).toHaveClass("disabled");

    expect(checkbox).toBeDisabled();
    expect(label).toHaveAttribute("data-disabled", "true");
    expect(findRoot(checkbox)).toHaveAttribute("data-disabled", "true");
    expect(findRoot(checkbox)).toHaveClass("disabled");
  });

  it("should support selected state", async () => {
    const onChange = vi.fn();
    const { getAllByRole } = renderGroup({ onChange }, { class: ({ isSelected }: Props) => (isSelected() ? "selected" : "") });
    const checkboxes = getAllByRole("checkbox");
    const label = checkboxes[0]!.closest("label");

    expect(checkboxes[0]).not.toBeChecked();
    expect(label).not.toHaveAttribute("data-selected");
    expect(label).not.toHaveClass("selected");

    await user.click(checkboxes[0]!);
    expect(onChange).toHaveBeenLastCalledWith(["a"]);
    expect(checkboxes[0]).toBeChecked();
    expect(label).toHaveAttribute("data-selected", "true");
    expect(findRoot(checkboxes[0]!)).toHaveAttribute("data-selected", "true");
    expect(findRoot(checkboxes[0]!)).toHaveClass("selected");

    await user.click(checkboxes[0]!);
    expect(onChange).toHaveBeenLastCalledWith([]);
    expect(checkboxes[0]).not.toBeChecked();
    expect(label).not.toHaveAttribute("data-selected");
    expect(findRoot(checkboxes[0]!)).not.toHaveAttribute("data-selected");
    expect(findRoot(checkboxes[0]!)).not.toHaveClass("selected");
  });

  it("should support read only state", () => {
    const className = ({ isReadOnly }: Props) => (isReadOnly() ? "readonly" : "");
    const { getByRole, getAllByRole } = renderGroup({ isReadOnly: true, class: className }, { class: className });
    const group = getByRole("group");
    const checkbox = getAllByRole("checkbox")[0]!;
    const label = checkbox.closest("label");

    expect(group).toHaveAttribute("data-readonly");
    expect(group).toHaveClass("readonly");

    expect(label).toHaveAttribute("data-readonly");
    expect(findRoot(checkbox)).toHaveAttribute("data-readonly");
    expect(findRoot(checkbox)).toHaveClass("readonly");
  });

  it("should support validation state", () => {
    const className = ({ isInvalid }: Props) => (isInvalid() ? "invalid" : undefined);
    const { getByRole, getAllByRole } = renderGroup({ isInvalid: true, class: className }, { class: className });
    const group = getByRole("group");
    const checkbox = getAllByRole("checkbox")[0]!;
    const label = checkbox.closest("label");

    expect(group).toHaveAttribute("data-invalid", "true");
    expect(group).toHaveClass("invalid");

    expect(label).toHaveAttribute("data-invalid", "true");
    expect(findRoot(checkbox)).toHaveAttribute("data-invalid", "true");
    expect(findRoot(checkbox)).toHaveClass("invalid");
  });

  it("should support required state", () => {
    const className = ({ isRequired }: Props) => (isRequired() ? "required" : "");
    const { getByRole, getAllByRole } = renderGroup({ isRequired: true, class: className }, { isRequired: true, class: className });
    const group = getByRole("group");
    const checkbox = getAllByRole("checkbox")[0]!;
    const label = checkbox.closest("label");

    expect(group).toHaveAttribute("data-required", "true");
    expect(group).toHaveClass("required");

    expect(label).toHaveAttribute("data-required", "true");
    expect(findRoot(checkbox)).toHaveAttribute("data-required", "true");
    expect(findRoot(checkbox)).toHaveClass("required");
  });

  it("supports help text", async () => {
    const { getByRole, getAllByRole } = renderUI(() => (
      <CheckboxGroup isInvalid>
        <Label>Test</Label>
        <Checkbox value="a" description="hello">
          A
        </Checkbox>
        <Text slot="description">Description</Text>
        <Text slot="errorMessage">Error</Text>
      </CheckboxGroup>
    ));
    await microtasks();

    const group = getByRole("group");
    expect(group).toHaveAttribute("aria-describedby");
    expect(
      group
        .getAttribute("aria-describedby")!
        .split(" ")
        .map((id) => document.getElementById(id)!.textContent)
        .join(" "),
    ).toBe("Description Error");

    const checkbox = getAllByRole("checkbox")[0]!;
    expect(checkbox).toHaveAttribute("aria-describedby");
    expect(
      checkbox
        .getAttribute("aria-describedby")!
        .split(" ")
        .map((id) => document.getElementById(id)!.textContent)
        .join(" "),
    ).toBe(comp === "CheckboxField" ? "hello Error Description" : "Error Description");
  });

  it("should support render props", () => {
    const { getByRole } = renderUI(() => (
      <CheckboxGroup isRequired>
        {({ isRequired }: Props) => (
          <>
            <Label data-required={isRequired()}>Test</Label>
            <Checkbox value="a">A</Checkbox>
          </>
        )}
      </CheckboxGroup>
    ));
    const group = getByRole("group");
    const label = document.getElementById(group.getAttribute("aria-labelledby")!);
    expect(label).toHaveAttribute("data-required", "true");
  });

  it("should support aria-describedby on a checkbox", async () => {
    const { getAllByRole } = renderGroup({}, { "aria-describedby": "test" });
    await microtasks();
    const checkboxes = getAllByRole("checkbox");
    for (const checkbox of checkboxes) {
      expect(checkbox).toHaveAttribute("aria-describedby", "test");
    }
  });

  it("should support validation errors", async () => {
    const { getByRole, getAllByRole, getByTestId } = renderUI(() => (
      <form data-testid="form">
        <CheckboxGroup isRequired>
          <Label>Test</Label>
          <Checkbox value="a">A</Checkbox>
          <FieldError />
        </CheckboxGroup>
      </form>
    ));
    await microtasks();

    const group = getByRole("group");
    const checkboxes = getAllByRole("checkbox") as HTMLInputElement[];
    expect(group).not.toHaveAttribute("aria-describedby");
    expect(group).not.toHaveAttribute("data-invalid");
    for (const checkbox of checkboxes) {
      expect(findRoot(checkbox)).not.toHaveAttribute("data-invalid");
    }

    (getByTestId("form") as HTMLFormElement).checkValidity();
    await microtasks();

    expect(group).toHaveAttribute("aria-describedby");
    expect(document.getElementById(group.getAttribute("aria-describedby")!)!.textContent).toBe(checkboxes[0]!.validationMessage);
    expect(group).toHaveAttribute("data-invalid");

    for (const checkbox of checkboxes) {
      expect(findRoot(checkbox)).toHaveAttribute("data-invalid");
    }

    await user.click(checkboxes[0]!);
    await microtasks();
    expect(group).not.toHaveAttribute("aria-describedby");
    expect(group).not.toHaveAttribute("data-invalid");
    for (const checkbox of checkboxes) {
      expect(findRoot(checkbox)).not.toHaveAttribute("data-invalid");
    }
  });

  it("should support focus events", async () => {
    const onBlur = vi.fn();
    const onFocus = vi.fn();
    const onFocusChange = vi.fn();
    const { getAllByRole, getByText } = renderUI(() => (
      <>
        <TestCheckboxGroup groupProps={{ onBlur, onFocus, onFocusChange }} />
        <button>Steal focus</button>
      </>
    ));
    const checkboxes = getAllByRole("checkbox");
    const button = getByText("Steal focus");

    // first gaining focus
    await user.tab();
    expect(document.activeElement).toBe(checkboxes[0]);
    expect(onBlur).not.toHaveBeenCalled();
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onFocusChange).toHaveBeenCalledTimes(1); // triggered by onFocus
    expect(onFocusChange).toHaveBeenLastCalledWith(true);

    // inner focus changes shouldn't call the callbacks.
    await user.tab();
    expect(document.activeElement).toBe(checkboxes[1]);
    expect(onBlur).not.toHaveBeenCalled();
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onFocusChange).toHaveBeenCalledTimes(1);
    expect(onFocusChange).toHaveBeenLastCalledWith(true);

    // `onBlur` and the following `onFocusChange` only should be called when losing focus to an outer element.
    await user.click(button);
    expect(document.activeElement).toBe(button);
    expect(onBlur).toHaveBeenCalled();
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onFocusChange).toHaveBeenCalledTimes(2); // triggered by onBlur
    expect(onFocusChange).toHaveBeenLastCalledWith(false);
  });

  it("should support form prop", () => {
    const { getAllByRole } = renderGroup({ form: "test" });
    for (const checkbox of getAllByRole("checkbox")) {
      expect(checkbox).toHaveAttribute("form", "test");
    }
  });
});
