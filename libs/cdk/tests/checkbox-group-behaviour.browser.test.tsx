// Ported from react-aria test/checkbox/useCheckboxGroup.test.tsx (react-spectrum, Apache-2.0, © Adobe).
// Changes: `useCheckboxGroupState` / `useCheckboxGroup` / `useCheckboxGroupItem` → `createCheckboxGroupState` /
// `checkboxGroupProps` / `checkboxGroupItemProps`; `render` from `@rivetjs/runtime/testing` (Chromium); queries via
// `@testing-library/dom` `within`; `useRef` → `ref()`; `isInvalid` is an accessor; `jest.fn` → `vi.fn`; the item
// label/input bags are spread as returned (accessor values are read by the spread bindings).
import { beforeAll, afterEach, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { ref as createRef } from "@rivetjs/runtime/dom";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { createCheckboxGroupState, type CheckboxGroupState } from "../state/checkbox-group.ts";
import { checkboxGroupItemProps, checkboxGroupProps, type AriaCheckboxGroupItemProps, type AriaCheckboxGroupProps } from "../checkbox/behaviour.tsx";

afterEach(cleanup);

type ItemProps = AriaCheckboxGroupItemProps & { children?: string };

function Checkbox(props: ItemProps & { checkboxGroupState: CheckboxGroupState }) {
  const { checkboxGroupState, ...rest } = props;
  const inputRef = createRef<HTMLInputElement>();
  const { children } = rest;
  rest.validationBehavior ??= "native";
  const { inputProps, labelProps } = checkboxGroupItemProps(rest, checkboxGroupState, inputRef);
  return (
    <label {...labelProps}>
      <input {...inputProps} ref={inputRef} />
      {children}
    </label>
  );
}

function CheckboxGroup(props: { groupProps: AriaCheckboxGroupProps & Record<string, unknown>; checkboxProps: ItemProps[] }) {
  const { groupProps, checkboxProps } = props;
  const state = createCheckboxGroupState(groupProps);
  const { groupProps: checkboxGroupAttrs, labelProps, isInvalid } = checkboxGroupProps(groupProps, state);
  const label = groupProps.label as string | undefined;
  return (
    <div {...checkboxGroupAttrs} data-invalid={isInvalid() || undefined}>
      {label ? <span {...labelProps}>{label}</span> : null}
      <Checkbox checkboxGroupState={state} {...checkboxProps[0]} />
      <Checkbox checkboxGroupState={state} {...checkboxProps[1]} />
      <Checkbox checkboxGroupState={state} {...checkboxProps[2]} />
    </div>
  );
}

function renderUI(ui: () => unknown) {
  const result = render(ui as never);
  return within(result.container as HTMLElement);
}

const pets = (): ItemProps[] => [
  { value: "dogs", children: "Dogs" },
  { value: "cats", children: "Cats" },
  { value: "dragons", children: "Dragons" },
];

describe("useCheckboxGroup", () => {
  let user: ReturnType<typeof userEvent.setup>;
  beforeAll(() => {
    user = userEvent.setup();
  });

  it("handles defaults", async () => {
    const onChangeSpy = vi.fn();
    const { getByRole, getAllByRole, getByLabelText } = renderUI(() => (
      <CheckboxGroup groupProps={{ label: "Favorite Pet", onChange: onChangeSpy }} checkboxProps={pets()} />
    ));

    const checkboxGroup = getByRole("group");
    const checkboxes = getAllByRole("checkbox") as HTMLInputElement[];
    expect(checkboxGroup).toBeInTheDocument();
    expect(checkboxes.length).toBe(3);

    for (const c of checkboxes) expect(c).not.toHaveAttribute("name");

    expect(checkboxes[0].value).toBe("dogs");
    expect(checkboxes[1].value).toBe("cats");
    expect(checkboxes[2].value).toBe("dragons");

    for (const c of checkboxes) expect(c.checked).toBeFalsy();

    await user.click(getByLabelText("Dragons"));
    expect(onChangeSpy).toHaveBeenCalledTimes(1);
    expect(onChangeSpy).toHaveBeenCalledWith(["dragons"]);

    expect(checkboxes[0].checked).toBeFalsy();
    expect(checkboxes[1].checked).toBeFalsy();
    expect(checkboxes[2].checked).toBeTruthy();
  });

  it("can have a default value", () => {
    const { getByLabelText } = renderUI(() => <CheckboxGroup groupProps={{ label: "Favorite Pet", value: ["cats"] }} checkboxProps={pets()} />);
    expect((getByLabelText("Cats") as HTMLInputElement).checked).toBe(true);
  });

  it("name can be controlled", () => {
    const { getAllByRole } = renderUI(() => <CheckboxGroup groupProps={{ name: "awesome-react-aria", label: "Favorite Pet" }} checkboxProps={pets()} />);
    for (const c of getAllByRole("checkbox")) expect(c).toHaveAttribute("name", "awesome-react-aria");
  });

  it("supports labeling", () => {
    const { getByRole } = renderUI(() => <CheckboxGroup groupProps={{ label: "Favorite Pet" }} checkboxProps={pets()} />);
    const labelId = getByRole("group").getAttribute("aria-labelledby");
    expect(labelId).toBeTruthy();
    expect(document.getElementById(labelId!)).toHaveTextContent("Favorite Pet");
  });

  it("supports aria-label", () => {
    const { getByRole } = renderUI(() => <CheckboxGroup groupProps={{ "aria-label": "My Favorite Pet" }} checkboxProps={pets()} />);
    expect(getByRole("group")).toHaveAttribute("aria-label", "My Favorite Pet");
  });

  it("supports custom props", () => {
    const { getByRole } = renderUI(() => <CheckboxGroup groupProps={{ label: "Favorite Pet", "data-testid": "favorite-pet" }} checkboxProps={pets()} />);
    expect(getByRole("group")).toHaveAttribute("data-testid", "favorite-pet");
  });

  it("sets aria-disabled and makes checkboxes disabled when isDisabled is true", async () => {
    const groupOnChangeSpy = vi.fn();
    const checkboxOnChangeSpy = vi.fn();
    const items = pets();
    items[2].onChange = checkboxOnChangeSpy;
    const { getAllByRole, getByRole, getByLabelText } = renderUI(() => (
      <CheckboxGroup groupProps={{ label: "Favorite Pet", isDisabled: true, onChange: groupOnChangeSpy }} checkboxProps={items} />
    ));

    expect(getByRole("group")).toHaveAttribute("aria-disabled", "true");
    const checkboxes = getAllByRole("checkbox") as HTMLInputElement[];
    for (const c of checkboxes) expect(c).toHaveAttribute("disabled");

    await user.click(getByLabelText("Dragons"));
    expect(groupOnChangeSpy).toHaveBeenCalledTimes(0);
    expect(checkboxOnChangeSpy).toHaveBeenCalledTimes(0);
    expect(checkboxes[2].checked).toBeFalsy();
  });

  it("doesn't set aria-disabled or make checkboxes disabled by default", () => {
    const { getAllByRole, getByRole } = renderUI(() => <CheckboxGroup groupProps={{ label: "Favorite Pet" }} checkboxProps={pets()} />);
    expect(getByRole("group")).not.toHaveAttribute("aria-disabled");
    for (const c of getAllByRole("checkbox")) expect(c).not.toHaveAttribute("disabled");
  });

  it("doesn't set aria-disabled or make checkboxes disabled when isDisabled is false", () => {
    const { getAllByRole, getByRole } = renderUI(() => <CheckboxGroup groupProps={{ label: "Favorite Pet", isDisabled: false }} checkboxProps={pets()} />);
    expect(getByRole("group")).not.toHaveAttribute("aria-disabled");
    for (const c of getAllByRole("checkbox")) expect(c).not.toHaveAttribute("disabled");
  });

  it('sets aria-readonly="true" on each checkbox', async () => {
    const groupOnChangeSpy = vi.fn();
    const checkboxOnChangeSpy = vi.fn();
    const items = pets();
    items[2].onChange = checkboxOnChangeSpy;
    const { getAllByRole, getByLabelText } = renderUI(() => (
      <CheckboxGroup groupProps={{ label: "Favorite Pet", isReadOnly: true, onChange: groupOnChangeSpy }} checkboxProps={items} />
    ));

    const checkboxes = getAllByRole("checkbox") as HTMLInputElement[];
    for (const c of checkboxes) expect(c).toHaveAttribute("aria-readonly", "true");
    expect(checkboxes[2].checked).toBeFalsy();

    await user.click(getByLabelText("Dragons"));
    expect(groupOnChangeSpy).toHaveBeenCalledTimes(0);
    expect(checkboxOnChangeSpy).toHaveBeenCalledTimes(0);
    expect(checkboxes[2].checked).toBeFalsy();
  });

  it("should not update state for readonly checkbox", async () => {
    const groupOnChangeSpy = vi.fn();
    const checkboxOnChangeSpy = vi.fn();
    const items = pets();
    items[2].isReadOnly = true;
    items[2].onChange = checkboxOnChangeSpy;
    const { getAllByRole, getByLabelText } = renderUI(() => (
      <CheckboxGroup groupProps={{ label: "Favorite Pet", onChange: groupOnChangeSpy }} checkboxProps={items} />
    ));

    const checkboxes = getAllByRole("checkbox") as HTMLInputElement[];
    await user.click(getByLabelText("Dragons"));
    expect(groupOnChangeSpy).toHaveBeenCalledTimes(0);
    expect(checkboxOnChangeSpy).toHaveBeenCalledTimes(0);
    expect(checkboxes[2].checked).toBeFalsy();
  });

  it("should re-validate in realtime", async () => {
    const { getByRole, getByLabelText } = renderUI(() => <CheckboxGroup groupProps={{ label: "Favorite Pet", isRequired: true }} checkboxProps={pets()} />);
    const checkboxGroup = getByRole("group");
    const dragons = getByLabelText("Dragons");

    await user.click(dragons);
    expect(checkboxGroup).not.toHaveAttribute("data-invalid");

    await user.click(dragons);
    expect(checkboxGroup).toHaveAttribute("data-invalid", "true");

    await user.click(dragons);
    expect(checkboxGroup).not.toHaveAttribute("data-invalid");
  });
});
