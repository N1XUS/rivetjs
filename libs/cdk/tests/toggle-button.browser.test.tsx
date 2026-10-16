// Ported from react-aria-components test/ToggleButton.test.js (react-spectrum, Apache-2.0, © Adobe).
// Changes: `render` from `@rivetjs/runtime/testing` (Chromium); queries via `@testing-library/dom` `within`;
// `className` → `class`; render props are accessors (`isSelected()`); `jest.fn` → `vi.fn`; real timers;
// `<ToggleButtonContext.Provider value>` → runtime `Provider`; default class `rv-ToggleButton`.
// Rivet additions: context props without a slot, two-way `isSelected` signal, render props + `render` inside a
// ToggleButtonGroup (group state), `state` render prop, data-* forwarding.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { ToggleButton, ToggleButtonContext } from "../toggle-button/index.tsx";
import { ToggleButtonGroup } from "../toggle-button-group/index.tsx";

afterEach(cleanup);

function renderUI(ui: () => unknown) {
  const { container } = render(ui as never);
  return within(container as HTMLElement);
}

describe("ToggleButton", () => {
  let user: ReturnType<typeof userEvent.setup>;
  beforeAll(() => {
    user = userEvent.setup();
  });

  it("should render a toggle button with default class", () => {
    const { getByRole } = renderUI(() => <ToggleButton>Test</ToggleButton>);
    expect(getByRole("button")).toHaveAttribute("class", "rv-ToggleButton");
  });

  it("should render a toggle button with custom class", () => {
    const { getByRole } = renderUI(() => <ToggleButton class="test">Test</ToggleButton>);
    expect(getByRole("button")).toHaveAttribute("class", "test");
  });

  it("should support DOM props", () => {
    const { getByRole } = renderUI(() => <ToggleButton data-foo="bar">Test</ToggleButton>);
    expect(getByRole("button")).toHaveAttribute("data-foo", "bar");
  });

  it("should support render props", async () => {
    const { getByRole } = renderUI(() => <ToggleButton>{({ isSelected }) => (isSelected() ? "On" : "Off")}</ToggleButton>);
    const button = getByRole("button");
    expect(button).toHaveTextContent("Off");
    await user.click(button);
    expect(button).toHaveTextContent("On");
  });

  it("should support custom render function", () => {
    const { getByRole } = renderUI(() => <ToggleButton render={(props) => <button {...(props as {})} data-custom="bar" />}>Test</ToggleButton>);
    const button = getByRole("button");
    expect(button).toHaveAttribute("data-custom", "bar");
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).toHaveTextContent("Test");
  });

  it("should support slot", () => {
    const { getByRole } = renderUI(() => (
      <Provider token={ToggleButtonContext} value={{ slots: { test: { "aria-label": "test" } } }}>
        <ToggleButton slot="test">Test</ToggleButton>
      </Provider>
    ));
    const button = getByRole("button");
    expect(button).toHaveAttribute("slot", "test");
    expect(button).toHaveAttribute("aria-label", "test");
  });

  it("should support hover", async () => {
    const { getByRole } = renderUI(() => <ToggleButton class={({ isHovered }) => (isHovered() ? "hover" : "")}>Test</ToggleButton>);
    const button = getByRole("button");
    expect(button).not.toHaveAttribute("data-hovered");
    expect(button).not.toHaveClass("hover");
    await user.hover(button);
    expect(button).toHaveAttribute("data-hovered", "true");
    expect(button).toHaveClass("hover");
    await user.unhover(button);
    expect(button).not.toHaveAttribute("data-hovered");
    expect(button).not.toHaveClass("hover");
  });

  it("should support focus ring", async () => {
    const { getByRole } = renderUI(() => <ToggleButton class={({ isFocusVisible }) => (isFocusVisible() ? "focus" : "")}>Test</ToggleButton>);
    const button = getByRole("button");
    expect(button).not.toHaveAttribute("data-focus-visible");
    expect(button).not.toHaveClass("focus");
    await user.tab();
    expect(document.activeElement).toBe(button);
    expect(button).toHaveAttribute("data-focus-visible", "true");
    expect(button).toHaveClass("focus");
    await user.tab();
    expect(button).not.toHaveAttribute("data-focus-visible");
    expect(button).not.toHaveClass("focus");
  });

  it("should support press state", async () => {
    const onPress = vi.fn();
    const onClick = vi.fn();
    const onClickCapture = vi.fn();
    const { getByRole } = renderUI(() => (
      <ToggleButton class={({ isPressed }) => (isPressed() ? "pressed" : "")} onPress={onPress} onClick={onClick} onClickCapture={onClickCapture}>
        Test
      </ToggleButton>
    ));
    const button = getByRole("button");
    expect(button).not.toHaveAttribute("data-pressed");
    expect(button).not.toHaveClass("pressed");
    await user.pointer({ target: button, keys: "[MouseLeft>]" });
    expect(button).toHaveAttribute("data-pressed", "true");
    expect(button).toHaveClass("pressed");
    await user.pointer({ target: button, keys: "[/MouseLeft]" });
    expect(button).not.toHaveAttribute("data-pressed");
    expect(button).not.toHaveClass("pressed");
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClickCapture).toHaveBeenCalledTimes(1);
  });

  it("should support disabled state", () => {
    const { getByRole } = renderUI(() => (
      <ToggleButton isDisabled class={({ isDisabled }) => (isDisabled() ? "disabled" : "")}>
        Test
      </ToggleButton>
    ));
    const button = getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveClass("disabled");
  });

  it("should support selected state", async () => {
    const onChange = vi.fn();
    const { getByRole } = renderUI(() => (
      <ToggleButton onChange={onChange} class={({ isSelected }) => (isSelected() ? "selected" : "")}>
        Test
      </ToggleButton>
    ));
    const button = getByRole("button");
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).not.toHaveClass("selected");
    await user.click(button);
    expect(onChange).toHaveBeenLastCalledWith(true);
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveClass("selected");
    await user.click(button);
    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).not.toHaveClass("selected");
  });
});

describe("ToggleButton (Rivet)", () => {
  let user: ReturnType<typeof userEvent.setup>;
  beforeAll(() => {
    user = userEvent.setup();
  });

  it("ToggleButtonContext without slots: props merge under the button's own (handlers chain)", async () => {
    const fromContext = vi.fn();
    const own = vi.fn();
    const { getByRole } = renderUI(() => (
      <Provider token={ToggleButtonContext} value={{ "aria-label": "ctx", class: "ctx", onPress: fromContext }}>
        <ToggleButton onPress={own}>Test</ToggleButton>
      </Provider>
    ));
    const button = getByRole("button");
    expect(button).toHaveAttribute("aria-label", "ctx");
    expect(button).toHaveAttribute("class", "ctx");
    await user.click(button);
    expect(fromContext).toHaveBeenCalledTimes(1);
    expect(own).toHaveBeenCalledTimes(1);
  });

  it("two-way isSelected signal: external set and press both update", async () => {
    const selected = signal(false);
    const { getByRole } = renderUI(() => <ToggleButton isSelected={selected}>Test</ToggleButton>);
    const button = getByRole("button");
    selected.set(true);
    await Promise.resolve();
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveAttribute("data-selected", "true");
    await user.click(button);
    expect(selected()).toBe(false);
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("state render prop: `state.selected()` follows the selection", async () => {
    const { getByRole } = renderUI(() => <ToggleButton>{({ state }) => (state.selected() ? "yes" : "no")}</ToggleButton>);
    const button = getByRole("button");
    expect(button).toHaveTextContent("no");
    await user.click(button);
    expect(button).toHaveTextContent("yes");
  });

  it("inside a ToggleButtonGroup: render props + `render` read the group selection (single = radio)", async () => {
    const { getAllByRole } = renderUI(() => (
      <ToggleButtonGroup selectionMode="single">
        <ToggleButton id="a" class={({ isSelected }) => (isSelected() ? "on" : "off")}>
          A
        </ToggleButton>
        <ToggleButton id="b" render={(props, rp) => <button {...(props as {})} data-sel={rp.isSelected() ? "y" : "n"} />}>
          B
        </ToggleButton>
      </ToggleButtonGroup>
    ));
    const [a, b] = getAllByRole("radio");
    expect(a).toHaveClass("off");
    expect(b).toHaveAttribute("data-sel", "n");
    await user.click(a!);
    expect(a).toHaveClass("on");
    expect(a).toHaveAttribute("aria-checked", "true");
    await user.click(b!);
    expect(a).toHaveClass("off");
    expect(b).toHaveAttribute("data-sel", "y");
    expect(b).toHaveAttribute("aria-checked", "true");
  });

  it("no interaction attributes before interaction; a static class keeps no state signals", async () => {
    const { getByRole } = renderUI(() => <ToggleButton class="plain">Test</ToggleButton>);
    const button = getByRole("button");
    for (const name of ["data-hovered", "data-focused", "data-focus-visible", "data-pressed"]) expect(button).not.toHaveAttribute(name);
    await user.hover(button);
    expect(button).toHaveAttribute("data-hovered", "true");
    expect(button).toHaveAttribute("class", "plain");
  });
});
