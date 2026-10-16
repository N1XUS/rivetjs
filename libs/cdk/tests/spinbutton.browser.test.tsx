// Ported from react-aria test/spinbutton/useSpinButton.test.js (react-spectrum, Apache-2.0, © Adobe).
// Changes: `render` from `@rivetjs/runtime/testing` (Chromium); `useSpinButton(props)` → `spinButtonProps(props)` +
// the free handlers `spinButtonKeyDown` / `KeyUp` / `Focus` / `Blur` over `createSpinButtonState()`; `jest.fn` →
// `vi.fn`; `jest.mock(LiveAnnouncer)` → `vi.mock("../announcer/live-announcer.ts", { spy: true })`; `rerender` → signal
// props (`value`, `textValue`); `act(...)` dropped (handlers run batched, effects flush synchronously).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal } from "@rivetjs/reactivity";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { announce } from "../announcer/live-announcer.ts";
import {
  createSpinButtonState,
  spinButtonBlur,
  spinButtonFocus,
  spinButtonKeyDown,
  spinButtonKeyUp,
  spinButtonProps,
  type SpinButtonProps,
} from "../spinbutton/behaviour.tsx";

vi.mock("../announcer/live-announcer.ts", { spy: true });

afterEach(cleanup);
beforeEach(() => {
  vi.mocked(announce).mockClear();
});

function Example(props: SpinButtonProps) {
  const state = createSpinButtonState();
  const { spinButtonProps: attrs } = spinButtonProps(props);
  return (
    <div
      {...attrs}
      tabIndex={-1}
      data-testid="test"
      onKeyDown={(e: KeyboardEvent) => spinButtonKeyDown(e, props, state)}
      onKeyUp={(e: KeyboardEvent) => spinButtonKeyUp(e, props, state)}
      onFocus={(e: FocusEvent) => spinButtonFocus(e, props, state)}
      onBlur={(e: FocusEvent) => spinButtonBlur(e, props, state)}
    />
  );
}

const renderExample = (props: SpinButtonProps) => within(render(() => <Example {...props} />).container as HTMLElement);

describe("useSpinButton", () => {
  it('should have role="spinbutton" and aria props', () => {
    const el = renderExample({ value: 2, textValue: "2 items", minValue: 1, maxValue: 3 }).getByTestId("test");
    expect(el).toHaveAttribute("role", "spinbutton");
    expect(el).toHaveAttribute("aria-valuenow", "2");
    expect(el).toHaveAttribute("aria-valuemin", "1");
    expect(el).toHaveAttribute("aria-valuemax", "3");
    expect(el).toHaveAttribute("aria-valuetext", "2 items");
    expect(el).not.toHaveAttribute("aria-disabled");
    expect(el).not.toHaveAttribute("aria-readonly");
  });

  it("should have aria-disabled if isDisabled is set", () => {
    const el = renderExample({ value: 2, textValue: "2 items", minValue: 1, maxValue: 3, isDisabled: true }).getByTestId("test");
    expect(el).toHaveAttribute("aria-disabled", "true");
  });

  it("should have aria-readonly if isReadOnly is set", () => {
    const el = renderExample({ value: 2, textValue: "2 items", minValue: 1, maxValue: 3, isReadOnly: true }).getByTestId("test");
    expect(el).toHaveAttribute("aria-readonly", "true");
  });

  it("should trigger onIncrement on arrow up", async () => {
    const user = userEvent.setup();
    const onIncrement = vi.fn();
    renderExample({ value: 2, onIncrement }).getByTestId("test").focus();
    await user.keyboard("{ArrowUp}");
    expect(onIncrement).toHaveBeenCalledTimes(1);
  });

  it("should trigger onDecrement on arrow down", async () => {
    const user = userEvent.setup();
    const onDecrement = vi.fn();
    renderExample({ value: 2, onDecrement }).getByTestId("test").focus();
    await user.keyboard("{ArrowDown}");
    expect(onDecrement).toHaveBeenCalledTimes(1);
  });

  it("should trigger onIncrementPage on page up", async () => {
    const user = userEvent.setup();
    const onIncrementPage = vi.fn();
    renderExample({ value: 2, onIncrementPage }).getByTestId("test").focus();
    await user.keyboard("{PageUp}");
    expect(onIncrementPage).toHaveBeenCalledTimes(1);
  });

  it("should fall back to onIncrement on page up if onIncrementPage is not available", async () => {
    const user = userEvent.setup();
    const onIncrement = vi.fn();
    renderExample({ value: 2, onIncrement }).getByTestId("test").focus();
    await user.keyboard("{PageUp}");
    expect(onIncrement).toHaveBeenCalledTimes(1);
  });

  it("should trigger onDecrementPage on page up", async () => {
    const user = userEvent.setup();
    const onDecrementPage = vi.fn();
    renderExample({ value: 2, onDecrementPage }).getByTestId("test").focus();
    await user.keyboard("{PageDown}");
    expect(onDecrementPage).toHaveBeenCalledTimes(1);
  });

  it("should fall back to onDecrement on page up if onDecrementPage is not available", async () => {
    const user = userEvent.setup();
    const onDecrement = vi.fn();
    renderExample({ value: 2, onDecrement }).getByTestId("test").focus();
    await user.keyboard("{PageDown}");
    expect(onDecrement).toHaveBeenCalledTimes(1);
  });

  it("should trigger onDecrementToMin on home key", async () => {
    const user = userEvent.setup();
    const onDecrementToMin = vi.fn();
    renderExample({ value: 2, onDecrementToMin, minValue: 1 }).getByTestId("test").focus();
    await user.keyboard("{Home}");
    expect(onDecrementToMin).toHaveBeenCalledTimes(1);
  });

  it("should trigger onIncrementToMax on end key", async () => {
    const user = userEvent.setup();
    const onIncrementToMax = vi.fn();
    renderExample({ value: 2, onIncrementToMax, maxValue: 1 }).getByTestId("test").focus();
    await user.keyboard("{End}");
    expect(onIncrementToMax).toHaveBeenCalledTimes(1);
  });

  it("should announce on value change while focused", () => {
    const value = signal(2);
    const el = renderExample({ value }).getByTestId("test");
    el.focus();

    value.set(3);
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith("3", "assertive");

    el.blur();

    value.set(4);
    expect(announce).toHaveBeenCalledTimes(1);
  });

  it("should announce on textValue change while focused", () => {
    const value = signal(2);
    const textValue = signal("2 items");
    const el = renderExample({ value, textValue }).getByTestId("test");
    el.focus();

    value.set(3);
    textValue.set("3 items");
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith("3 items", "assertive");
  });

  it("should substitute a minus sign for hyphen in the textValue for negative values", () => {
    const value = signal(-2);
    const textValue = signal("-2 items");
    const el = renderExample({ value, textValue }).getByTestId("test");
    expect(el).toHaveAttribute("aria-valuenow", "-2");
    expect(el).toHaveAttribute("aria-valuetext", "−2 items");
    el.focus();

    value.set(-3);
    textValue.set("-3 items");
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith("−3 items", "assertive");
    expect(el).toHaveAttribute("aria-valuenow", "-3");
    expect(el).toHaveAttribute("aria-valuetext", "−3 items");
  });
});
