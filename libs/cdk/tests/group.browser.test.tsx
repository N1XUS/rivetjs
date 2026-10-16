// Ported from react-aria-components test/Group.test.tsx (react-spectrum, Apache-2.0, © Adobe).
// Changes: `render` from `@rivetjs/runtime/testing` (Chromium); queries via `@testing-library/dom` `within`;
// `className` → `class`; render props are accessors (`isHovered()`); `jest.fn` → `vi.fn`; real timers;
// `<GroupContext.Provider value>` → runtime `Provider`; default class `rv-Group`.
// Skipped: "should support custom render function" (now in the render-*.browser.test.tsx files).
// Rivet additions: zero render-time interaction state, data-focus-within, accessor isDisabled / isInvalid /
// isReadOnly (from props and GroupContext), aria-disabled / aria-invalid fallbacks, context ref + handler chaining.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal } from "@rivetjs/reactivity";
import { Provider, ref as createRef } from "@rivetjs/runtime/dom";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { Group, GroupContext } from "../group/index.tsx";

afterEach(cleanup);

function renderUI(ui: () => unknown) {
  const { container } = render(ui as never);
  return within(container as HTMLElement);
}

describe("Group", () => {
  let user: ReturnType<typeof userEvent.setup>;
  beforeAll(() => {
    user = userEvent.setup();
  });

  it("should render a group with default class", () => {
    const { getByRole } = renderUI(() => <Group>Test</Group>);
    expect(getByRole("group")).toHaveAttribute("class", "rv-Group");
  });

  it("should render a group with custom class", () => {
    const { getByRole } = renderUI(() => <Group class="test">Test</Group>);
    expect(getByRole("group")).toHaveAttribute("class", "test");
  });

  it("should support DOM props", () => {
    const { getByRole } = renderUI(() => <Group data-foo="bar">Test</Group>);
    expect(getByRole("group")).toHaveAttribute("data-foo", "bar");
  });

  it("should support slot", () => {
    const { getByRole } = renderUI(() => (
      <Provider token={GroupContext} value={{ slots: { test: { "aria-label": "test" } } }}>
        <Group slot="test">Test</Group>
      </Provider>
    ));
    const group = getByRole("group");
    expect(group).toHaveAttribute("slot", "test");
    expect(group).toHaveAttribute("aria-label", "test");
  });

  it("should support hover", async () => {
    const hoverStartSpy = vi.fn();
    const hoverChangeSpy = vi.fn();
    const hoverEndSpy = vi.fn();
    const { getByRole } = renderUI(() => (
      <Group class={({ isHovered }) => (isHovered() ? "hover" : "")} onHoverStart={hoverStartSpy} onHoverChange={hoverChangeSpy} onHoverEnd={hoverEndSpy}>
        Test
      </Group>
    ));
    const group = getByRole("group");
    expect(group).not.toHaveAttribute("data-hovered");
    expect(group).not.toHaveClass("hover");

    await user.hover(group);
    expect(group).toHaveAttribute("data-hovered", "true");
    expect(group).toHaveClass("hover");
    expect(hoverStartSpy).toHaveBeenCalledTimes(1);
    expect(hoverChangeSpy).toHaveBeenCalledTimes(1);

    await user.unhover(group);
    expect(group).not.toHaveAttribute("data-hovered");
    expect(group).not.toHaveClass("hover");
    expect(hoverEndSpy).toHaveBeenCalledTimes(1);
    expect(hoverChangeSpy).toHaveBeenCalledTimes(2);
  });

  it("should support focus ring", async () => {
    const { getByRole } = renderUI(() => (
      <Group class={({ isFocusVisible }) => (isFocusVisible() ? "focus" : "")}>
        <input type="text" />
      </Group>
    ));
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

  it("should not show focus ring when typing in pointer modality", async () => {
    const { getByRole } = renderUI(() => (
      <Group class={({ isFocusVisible }) => (isFocusVisible() ? "focus" : "")}>
        <input type="text" />
      </Group>
    ));
    const group = getByRole("group");
    const input = getByRole("textbox");
    expect(group).not.toHaveAttribute("data-focus-visible");

    await user.click(input);
    await user.keyboard("a");
    expect(document.activeElement).toBe(input);
    expect(input).toHaveValue("a");
    expect(group).not.toHaveAttribute("data-focus-visible");
    expect(group).not.toHaveClass("focus");
  });

  it("should support disabled state", () => {
    const { getByRole } = renderUI(() => (
      <Group isDisabled class={({ isDisabled }) => (isDisabled() ? "disabled" : "")}>
        Test
      </Group>
    ));
    const group = getByRole("group");
    expect(group).toHaveAttribute("data-disabled", "true");
    expect(group).toHaveClass("disabled");
  });

  it("should support render props", async () => {
    const { getByRole } = renderUI(() => <Group>{({ isHovered }) => (isHovered() ? "Hovered" : "Group")}</Group>);
    const group = getByRole("group");
    expect(group).toHaveTextContent("Group");
    await user.hover(group);
    expect(group).toHaveTextContent("Hovered");
    await user.unhover(group);
    expect(group).toHaveTextContent("Group");
  });
});

describe("Group (Rivet)", () => {
  let user: ReturnType<typeof userEvent.setup>;
  beforeAll(() => {
    user = userEvent.setup();
  });

  it("renders no interaction state before interaction; data-focus-within on focus inside", async () => {
    const { getByRole } = renderUI(() => (
      <Group>
        <input type="text" />
      </Group>
    ));
    const group = getByRole("group");
    for (const name of ["data-hovered", "data-focus-within", "data-focus-visible", "data-focused"]) expect(group).not.toHaveAttribute(name);
    await user.click(getByRole("textbox"));
    expect(group).toHaveAttribute("data-focus-within", "true");
    expect(group).not.toHaveAttribute("data-focused");
    await user.click(document.body);
    expect(group).not.toHaveAttribute("data-focus-within");
  });

  it("isFocusWithin render prop", async () => {
    const { getByRole } = renderUI(() => (
      <Group class={({ isFocusWithin }) => (isFocusWithin() ? "within" : "")}>
        <input type="text" />
      </Group>
    ));
    await user.click(getByRole("textbox"));
    expect(getByRole("group")).toHaveClass("within");
  });

  it("accessor isDisabled / isInvalid / isReadOnly update without re-creating the group", () => {
    const disabled = signal(false);
    const invalid = signal(false);
    const readOnly = signal(false);
    let runs = 0;
    const { getByRole } = renderUI(() => (
      <Group isDisabled={disabled} isInvalid={() => invalid()} isReadOnly={readOnly}>
        {() => {
          runs++;
          return "x";
        }}
      </Group>
    ));
    const group = getByRole("group");
    expect(group).not.toHaveAttribute("data-disabled");
    disabled.set(true);
    invalid.set(true);
    readOnly.set(true);
    expect(group).toHaveAttribute("data-disabled", "true");
    expect(group).toHaveAttribute("data-invalid", "true");
    expect(group).toHaveAttribute("data-readonly", "true");
    expect(runs).toBe(1);
  });

  it("GroupContext accessors (NumberField-style): aria-disabled / aria-invalid fall back into isDisabled / isInvalid", () => {
    const invalid = signal(false);
    const { getByRole } = renderUI(() => (
      <Provider token={GroupContext} value={{ "aria-disabled": "true", "aria-invalid": () => invalid() || undefined }}>
        <Group>Test</Group>
      </Provider>
    ));
    const group = getByRole("group");
    expect(group).toHaveAttribute("aria-disabled", "true");
    expect(group).toHaveAttribute("data-disabled", "true");
    expect(group).not.toHaveAttribute("aria-invalid");
    invalid.set(true);
    expect(group).toHaveAttribute("aria-invalid", "true");
    expect(group).toHaveAttribute("data-invalid", "true");
  });

  it('aria-disabled="false" is not disabled; role prop', () => {
    const { getByRole } = renderUI(() => (
      <Group role="region" aria-label="r" aria-disabled="false">
        Test
      </Group>
    ));
    const group = getByRole("region");
    expect(group).toHaveAttribute("aria-disabled", "false");
    expect(group).not.toHaveAttribute("data-disabled");
  });

  it("disabled group does not hover", async () => {
    const onHoverStart = vi.fn();
    const { getByRole } = renderUI(() => (
      <Group isDisabled onHoverStart={onHoverStart}>
        Test
      </Group>
    ));
    await user.hover(getByRole("group"));
    expect(onHoverStart).not.toHaveBeenCalled();
    expect(getByRole("group")).not.toHaveAttribute("data-hovered");
  });

  it("context ref + focus handlers chain with the group's own", async () => {
    const el = createRef<HTMLDivElement>();
    const calls: string[] = [];
    const { getByRole } = renderUI(() => (
      <Provider token={GroupContext} value={{ ref: el, onFocusIn: () => calls.push("ctx") }}>
        <Group onFocusIn={() => calls.push("own")} onPointerEnter={() => calls.push("enter")}>
          <input type="text" />
        </Group>
      </Provider>
    ));
    expect(el()).toBe(getByRole("group"));
    await user.click(getByRole("textbox"));
    expect(calls).toEqual(["enter", "ctx", "own"]);
    expect(getByRole("group")).toHaveAttribute("data-focus-within", "true");
  });
});
