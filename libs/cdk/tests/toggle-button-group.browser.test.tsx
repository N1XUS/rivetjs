// Ported from react-aria-components test/ToggleButtonGroup.test.js (react-spectrum, Apache-2.0, © Adobe).
// Changes: `render` from `@rivetjs/runtime/testing` (Chromium); `getByRole` / `getAllByRole` → `@testing-library/dom`
// `within(container)` queries; `className` → `class` (render props are accessors: `isDisabled()`); `jest.fn` →
// `vi.fn`; `installPointerEvent` dropped (real PointerEvent); `userEvent.setup({ delay: null, pointerMap })` →
// `userEvent.setup()`; default class `rv-ToggleButtonGroup`.
// Skipped: "should support custom render function" (now in the render-*.browser.test.tsx files).
// "should not show hover state when disabled": the group's `class` fn has no `isHovered` value upstream either
// (always ""), the `data-hovered` half checks ToggleButton.
// Rivet additions: two-way Signal selectedKeys, disallowEmptySelection, per-button isDisabled, render-prop `state`,
// slot via ToggleButtonGroupContext, live `isDisabled` / `orientation` props (in place, nodes kept; context fallback).
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal, untrack } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { ToggleButton } from "../toggle-button/index.tsx";
import { ToggleButtonGroup, ToggleButtonGroupContext, type ToggleButtonGroupProps } from "../toggle-button-group/index.tsx";
import type { Key } from "../collections/types.ts";

afterEach(cleanup);

function renderGroup(props: ToggleButtonGroupProps = {}) {
  const { container } = render(() => (
    <ToggleButtonGroup {...props}>
      <ToggleButton id="foo">Foo</ToggleButton>
      <ToggleButton id="bar">Bar</ToggleButton>
    </ToggleButtonGroup>
  ));
  return within(container as HTMLElement);
}

describe("ToggleButtonGroup", () => {
  let user: ReturnType<typeof userEvent.setup>;
  beforeAll(() => {
    user = userEvent.setup();
  });

  it("should render a toggle button group with default class", () => {
    const { getByRole } = renderGroup();
    const group = getByRole("radiogroup");
    expect(group).toHaveAttribute("class", "rv-ToggleButtonGroup");
  });

  it("should render a toggle button group with a custom class", () => {
    const { getByRole } = renderGroup({ class: "custom" });
    const group = getByRole("radiogroup");
    expect(group).toHaveAttribute("class", "custom");
  });

  it("should support render props", () => {
    const { getByRole } = renderGroup({ "data-foo": "bar" });
    const group = getByRole("radiogroup");
    expect(group).toHaveAttribute("data-foo", "bar");
  });

  // RAC custom render function: covered in the render-*.browser.test.tsx files.

  it("should support disabled state", () => {
    const { getByRole, getAllByRole } = renderGroup({
      isDisabled: true,
      class: ({ isDisabled }) => (isDisabled() ? "disabled" : "enabled"),
    });
    const group = getByRole("radiogroup");
    expect(group).toHaveAttribute("class", "disabled");
    expect(group).toHaveAttribute("data-disabled", "true");
    expect(group).toHaveAttribute("aria-disabled", "true");
    for (const radio of getAllByRole("radio")) {
      expect(radio).toBeDisabled();
    }
  });

  it("should not show hover state when disabled", async () => {
    const { getAllByRole } = renderGroup({ isDisabled: true });
    const radios = getAllByRole("radio");
    await user.hover(radios[0]!);
    expect(radios[0]).not.toHaveAttribute("data-hovered");
    await user.hover(radios[1]!);
    expect(radios[1]).not.toHaveAttribute("data-hovered");
  });

  it("should support uncontrolled single selection", async () => {
    const onSelectionChange = vi.fn();
    const { getByRole, getAllByRole } = renderGroup({ selectionMode: "single", onSelectionChange });
    expect(getByRole("radiogroup")).toBeInTheDocument();
    const radios = getAllByRole("radio");
    for (const radio of radios) {
      expect(radio).toHaveAttribute("aria-checked", "false");
      expect(radio).not.toHaveAttribute("aria-pressed");
    }

    await user.click(radios[1]!);
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(onSelectionChange).toHaveBeenLastCalledWith(new Set(["bar"]));
    expect(radios[0]).toHaveAttribute("aria-checked", "false");
    expect(radios[0]).not.toHaveAttribute("aria-pressed");
    expect(radios[1]).toHaveAttribute("aria-checked", "true");
    expect(radios[1]).not.toHaveAttribute("aria-pressed");

    await user.click(radios[0]!);
    expect(onSelectionChange).toHaveBeenCalledTimes(2);
    expect(onSelectionChange).toHaveBeenLastCalledWith(new Set(["foo"]));
    expect(radios[0]).toHaveAttribute("aria-checked", "true");
    expect(radios[0]).not.toHaveAttribute("aria-pressed");
    expect(radios[1]).toHaveAttribute("aria-checked", "false");
    expect(radios[1]).not.toHaveAttribute("aria-pressed");
  });

  it("should support controlled single selection", async () => {
    const onSelectionChange = vi.fn();
    const { getByRole, getAllByRole } = renderGroup({ selectionMode: "single", selectedKeys: [], onSelectionChange });
    expect(getByRole("radiogroup")).toBeInTheDocument();
    const radios = getAllByRole("radio");
    for (const radio of radios) {
      expect(radio).toHaveAttribute("aria-checked", "false");
      expect(radio).not.toHaveAttribute("aria-pressed");
    }

    await user.click(radios[1]!);
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(onSelectionChange).toHaveBeenLastCalledWith(new Set(["bar"]));
    expect(radios[0]).toHaveAttribute("aria-checked", "false");
    expect(radios[0]).not.toHaveAttribute("aria-pressed");
    expect(radios[1]).toHaveAttribute("aria-checked", "false");
    expect(radios[1]).not.toHaveAttribute("aria-pressed");
  });

  it("should support uncontrolled multiple selection", async () => {
    const onSelectionChange = vi.fn();
    const { getByRole, getAllByRole } = renderGroup({ selectionMode: "multiple", onSelectionChange });
    expect(getByRole("toolbar")).toBeInTheDocument();
    const buttons = getAllByRole("button");
    for (const button of buttons) {
      expect(button).toHaveAttribute("aria-pressed", "false");
    }

    await user.click(buttons[1]!);
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(onSelectionChange).toHaveBeenLastCalledWith(new Set(["bar"]));
    expect(buttons[0]).toHaveAttribute("aria-pressed", "false");
    expect(buttons[1]).toHaveAttribute("aria-pressed", "true");

    await user.click(buttons[0]!);
    expect(onSelectionChange).toHaveBeenCalledTimes(2);
    expect(onSelectionChange).toHaveBeenLastCalledWith(new Set(["bar", "foo"]));
    expect(buttons[0]).toHaveAttribute("aria-pressed", "true");
    expect(buttons[1]).toHaveAttribute("aria-pressed", "true");
  });

  it("should support controlled multiple selection", async () => {
    const onSelectionChange = vi.fn();
    const { getAllByRole } = renderGroup({ selectionMode: "multiple", selectedKeys: ["foo"], onSelectionChange });
    const buttons = getAllByRole("button");
    expect(buttons[0]).toHaveAttribute("aria-pressed", "true");
    expect(buttons[1]).toHaveAttribute("aria-pressed", "false");

    await user.click(buttons[1]!);
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(onSelectionChange).toHaveBeenLastCalledWith(new Set(["foo", "bar"]));
    expect(buttons[0]).toHaveAttribute("aria-pressed", "true");
    expect(buttons[1]).toHaveAttribute("aria-pressed", "false");
  });

  it("should support horizontal keyboard navigation", async () => {
    const { getAllByRole, getByRole } = renderGroup();
    expect(getByRole("radiogroup")).toHaveAttribute("aria-orientation", "horizontal");
    const radios = getAllByRole("radio");
    await user.tab();
    expect(document.activeElement).toBe(radios[0]);

    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(radios[1]);

    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(radios[0]);
  });

  it("should support vertical keyboard navigation", async () => {
    const { getAllByRole, getByRole } = renderGroup({ orientation: "vertical" });
    expect(getByRole("radiogroup")).toHaveAttribute("aria-orientation", "vertical");
    const radios = getAllByRole("radio");
    await user.tab();
    expect(document.activeElement).toBe(radios[0]);

    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(radios[1]);

    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(radios[0]);
  });

  it("supports aria labeling", () => {
    let { getByRole } = renderGroup({ "aria-label": "Test" });
    const radiogroup = getByRole("radiogroup");
    expect(radiogroup).toHaveAttribute("aria-label", "Test");
    cleanup();

    ({ getByRole } = renderGroup({ selectionMode: "multiple", "aria-label": "Test" }));
    const toolbar = getByRole("toolbar");
    expect(toolbar).toHaveAttribute("aria-label", "Test");
  });
});

describe("ToggleButtonGroup (Rivet additions)", () => {
  let user: ReturnType<typeof userEvent.setup>;
  beforeAll(() => {
    user = userEvent.setup();
  });

  it("two-way Signal selectedKeys", async () => {
    const selected = signal<Iterable<Key>>(new Set(["foo"]));
    const { getAllByRole } = renderGroup({ selectionMode: "multiple", selectedKeys: selected });
    const buttons = getAllByRole("button");
    expect(buttons[0]).toHaveAttribute("aria-pressed", "true");
    await user.click(buttons[1]!);
    expect([...untrack(selected)]).toEqual(["foo", "bar"]);
    expect(buttons[1]).toHaveAttribute("aria-pressed", "true");
    expect(buttons[1]).toHaveAttribute("data-selected", "true");
    selected.set(new Set());
    expect(buttons[0]).toHaveAttribute("aria-pressed", "false");
  });

  it("disallowEmptySelection keeps the selected radio", async () => {
    const { getAllByRole } = renderGroup({ defaultSelectedKeys: ["foo"], disallowEmptySelection: true });
    const radios = getAllByRole("radio");
    await user.click(radios[0]!);
    expect(radios[0]).toHaveAttribute("aria-checked", "true");
  });

  it("per-button isDisabled; buttons render no DOM id from their key", async () => {
    const onSelectionChange = vi.fn();
    const { container } = render(() => (
      <ToggleButtonGroup selectionMode="multiple" onSelectionChange={onSelectionChange}>
        <ToggleButton id="a">A</ToggleButton>
        <ToggleButton id="b" isDisabled>
          B
        </ToggleButton>
      </ToggleButtonGroup>
    ));
    const buttons = within(container as HTMLElement).getAllByRole("button");
    expect(buttons[1]).toBeDisabled();
    expect(buttons[0]).not.toHaveAttribute("id");
    await user.click(buttons[1]!);
    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it("render-prop state and orientation", () => {
    const { container } = render(() => (
      <ToggleButtonGroup
        defaultSelectedKeys={["b"]}
        orientation="vertical"
        class={({ state, orientation }) => `${orientation()} ${[...state.selectedKeys()].join(",")}`}
      >
        <ToggleButton id="a">A</ToggleButton>
        <ToggleButton id="b">B</ToggleButton>
      </ToggleButtonGroup>
    ));
    const group = within(container as HTMLElement).getByRole("radiogroup");
    expect(group).toHaveAttribute("class", "vertical b");
    expect(group).toHaveAttribute("data-orientation", "vertical");
  });

  it("takes props from ToggleButtonGroupContext slots", () => {
    const { container } = render(() => (
      <Provider token={ToggleButtonGroupContext} value={{ slots: { tools: { "aria-label": "Tools", selectionMode: "multiple" } } }}>
        <ToggleButtonGroup slot="tools">
          <ToggleButton id="a">A</ToggleButton>
        </ToggleButtonGroup>
      </Provider>
    ));
    const toolbar = within(container as HTMLElement).getByRole("toolbar");
    expect(toolbar).toHaveAttribute("aria-label", "Tools");
    expect(toolbar).toHaveAttribute("slot", "tools");
  });

  it("live isDisabled: group + every ToggleButton follow in place (state, ARIA, render props, presses)", async () => {
    const disabled = signal(false);
    const onSelectionChange = vi.fn();
    const { container } = render(() => (
      <ToggleButtonGroup
        selectionMode="multiple"
        isDisabled={disabled()}
        onSelectionChange={onSelectionChange}
        class={({ isDisabled }) => (isDisabled() ? "off" : "on")}
      >
        <ToggleButton id="a" class={({ isDisabled }) => (isDisabled() ? "b-off" : "b-on")}>
          A
        </ToggleButton>
        <ToggleButton id="b">B</ToggleButton>
      </ToggleButtonGroup>
    ));
    const group = within(container as HTMLElement).getByRole("toolbar");
    const buttons = within(container as HTMLElement).getAllByRole("button");
    expect(group).not.toHaveAttribute("data-disabled");
    expect(group).not.toHaveAttribute("aria-disabled");
    for (const round of [1, 2, 3]) {
      disabled.set(round % 2 === 1);
      const want = round % 2 === 1;
      expect(group).toHaveAttribute("class", want ? "off" : "on");
      if (want) {
        expect(group).toHaveAttribute("data-disabled", "true");
        expect(group).toHaveAttribute("aria-disabled", "true");
      } else {
        expect(group).not.toHaveAttribute("data-disabled");
        expect(group).not.toHaveAttribute("aria-disabled");
      }
      for (const button of buttons) {
        if (want) expect(button).toBeDisabled();
        else expect(button).not.toBeDisabled();
        expect(button.hasAttribute("data-disabled")).toBe(want);
      }
      expect(buttons[0]).toHaveAttribute("class", want ? "b-off" : "b-on");
      expect(within(container as HTMLElement).getByRole("toolbar")).toBe(group);
      expect(within(container as HTMLElement).getAllByRole("button")).toEqual(buttons);
    }
    expect(onSelectionChange).not.toHaveBeenCalled();
    disabled.set(false);
    await user.click(buttons[1]!);
    expect(onSelectionChange).toHaveBeenLastCalledWith(new Set(["b"]));
    expect(buttons[1]).toHaveAttribute("aria-pressed", "true");
  });

  it("live isDisabled: a disabled button's press handler reads the group state at event time (keyboard)", async () => {
    const disabled = signal(false);
    const onSelectionChange = vi.fn();
    const { container } = render(() => (
      <ToggleButtonGroup isDisabled={disabled()} onSelectionChange={onSelectionChange}>
        <ToggleButton id="a">A</ToggleButton>
        <ToggleButton id="b">B</ToggleButton>
      </ToggleButtonGroup>
    ));
    const radios = within(container as HTMLElement).getAllByRole("radio");
    radios[0]!.focus();
    disabled.set(true);
    radios[0]!.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
    radios[0]!.dispatchEvent(new KeyboardEvent("keyup", { key: " ", bubbles: true, cancelable: true }));
    expect(onSelectionChange).not.toHaveBeenCalled();
    expect(radios[0]).toHaveAttribute("aria-checked", "false");
  });

  it("live orientation: data / aria orientation, toolbar keys and arrow-key navigation follow in place", async () => {
    const orientation = signal<"horizontal" | "vertical">("horizontal");
    const { container } = render(() => (
      <ToggleButtonGroup orientation={orientation()} class={({ orientation }) => orientation()}>
        <ToggleButton id="a">A</ToggleButton>
        <ToggleButton id="b">B</ToggleButton>
      </ToggleButtonGroup>
    ));
    const group = within(container as HTMLElement).getByRole("radiogroup");
    const radios = within(container as HTMLElement).getAllByRole("radio");
    expect(group).toHaveAttribute("data-orientation", "horizontal");
    expect(group).toHaveAttribute("data-rk", "ArrowLeft ArrowRight");
    orientation.set("vertical");
    expect(within(container as HTMLElement).getByRole("radiogroup")).toBe(group);
    expect(group).toHaveAttribute("data-orientation", "vertical");
    expect(group).toHaveAttribute("aria-orientation", "vertical");
    expect(group).toHaveAttribute("data-rk", "ArrowUp ArrowDown");
    expect(group).toHaveAttribute("class", "vertical");
    await user.tab();
    expect(document.activeElement).toBe(radios[0]);
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(radios[0]);
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(radios[1]);
    orientation.set("horizontal");
    expect(group).toHaveAttribute("aria-orientation", "horizontal");
    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(radios[0]);
  });

  it("isDisabled / orientation from ToggleButtonGroupContext when the own prop is undefined", () => {
    const { container } = render(() => (
      <Provider token={ToggleButtonGroupContext} value={{ isDisabled: true, orientation: "vertical" }}>
        <ToggleButtonGroup>
          <ToggleButton id="a">A</ToggleButton>
        </ToggleButtonGroup>
      </Provider>
    ));
    const group = within(container as HTMLElement).getByRole("radiogroup");
    expect(group).toHaveAttribute("data-disabled", "true");
    expect(group).toHaveAttribute("data-orientation", "vertical");
    expect(within(container as HTMLElement).getByRole("radio")).toBeDisabled();
  });

  it("a standalone ToggleButton keeps its id as the DOM id", () => {
    const { container } = render(() => <ToggleButton id="solo">Solo</ToggleButton>);
    const button = within(container as HTMLElement).getByRole("button");
    expect(button).toHaveAttribute("id", "solo");
    expect(button).toHaveAttribute("aria-pressed", "false");
  });
});
