// Ported from react-aria-components test/Button.test.js (react-spectrum, Apache-2.0, © Adobe).
// Changes: `render` from `@rivetjs/runtime/testing` (Chromium); queries via `@testing-library/dom` `within`;
// `className` → `class`; render props are accessors (`isPressed()`); `jest.fn` → `vi.fn`; real timers;
// `useState` → signals; `<ButtonContext.Provider value>` → runtime `Provider`; default class `rv-Button`.
// "should support custom render function" lives in render-core.browser.test.tsx. Skipped: "should warn when rendering the wrong element type",
// "should warn when ref is not passed through" (dev check lives in ui `dom.*`, not cdk); "displays a spinner…" /
// "removes href…" render `<ProgressBar>` from `@rivetjs/cdk/progress-bar`; "disables press when in
// pending state for context" needs DialogTrigger / Modal (C1a lane) — ported with a PressResponder instead.
// Rivet additions: accessor `isDisabled` / `isPending`, ButtonContext `isPressed` accessor, PressResponder props + ref,
// accessor aria-expanded from context, data-* forwarding, zero render-time state (attributes from handlers).
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal } from "@rivetjs/reactivity";
import { Provider, ref as createRef } from "@rivetjs/runtime/dom";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { FocusableProvider } from "../focus/focusable.tsx";
import { Button, ButtonContext } from "../button/index.tsx";
import { PressResponder } from "../interactions/pressable.tsx";
import { ProgressBar } from "../progress-bar/index.tsx";
import { HiddenContext } from "../collections/hidden.ts";

afterEach(cleanup);

function renderUI(ui: () => unknown) {
  const { container } = render(ui as never);
  return within(container as HTMLElement);
}

describe("Button", () => {
  let user: ReturnType<typeof userEvent.setup>;
  beforeAll(() => {
    user = userEvent.setup();
  });

  it("should render a button with default class", () => {
    const { getByRole } = renderUI(() => <Button>Test</Button>);
    expect(getByRole("button")).toHaveAttribute("class", "rv-Button");
  });

  it("should render a button with custom class", () => {
    const { getByRole } = renderUI(() => <Button class="test">Test</Button>);
    expect(getByRole("button")).toHaveAttribute("class", "test");
  });

  it("should support DOM props", () => {
    const { getByRole } = renderUI(() => <Button data-foo="bar">Test</Button>);
    expect(getByRole("button")).toHaveAttribute("data-foo", "bar");
  });

  it("should support form props", () => {
    const { getByRole } = renderUI(() => (
      <form id="foo">
        <Button form="foo" formMethod="post">
          Test
        </Button>
      </form>
    ));
    const button = getByRole("button");
    expect(button).toHaveAttribute("form", "foo");
    expect(button).toHaveAttribute("formMethod", "post");
  });

  it("should support accessibility props", () => {
    const { getByRole } = renderUI(() => <Button aria-current="page">Test</Button>);
    expect(getByRole("button")).toHaveAttribute("aria-current", "page");
  });

  it("should not have aria-disabled defined by default", () => {
    const { getByRole } = renderUI(() => <Button>Test</Button>);
    expect(getByRole("button")).not.toHaveAttribute("aria-disabled");
  });

  it("should support aria-disabled passthrough", () => {
    const { getByRole } = renderUI(() => <Button aria-disabled="true">Test</Button>);
    expect(getByRole("button")).toHaveAttribute("aria-disabled", "true");
  });

  it("should support slot", () => {
    const { getByRole } = renderUI(() => (
      <Provider token={ButtonContext} value={{ slots: { test: { "aria-label": "test" } } }}>
        <Button slot="test">Test</Button>
      </Provider>
    ));
    const button = getByRole("button");
    expect(button).toHaveAttribute("slot", "test");
    expect(button).toHaveAttribute("aria-label", "test");
  });

  it("should support hover", async () => {
    const hoverStartSpy = vi.fn();
    const hoverChangeSpy = vi.fn();
    const hoverEndSpy = vi.fn();
    const { getByRole } = renderUI(() => (
      <Button class={({ isHovered }) => (isHovered() ? "hover" : "")} onHoverStart={hoverStartSpy} onHoverChange={hoverChangeSpy} onHoverEnd={hoverEndSpy}>
        Test
      </Button>
    ));
    const button = getByRole("button");
    expect(button).not.toHaveAttribute("data-hovered");
    expect(button).not.toHaveClass("hover");
    await user.hover(button);
    expect(button).toHaveAttribute("data-hovered", "true");
    expect(button).toHaveClass("hover");
    expect(hoverStartSpy).toHaveBeenCalledTimes(1);
    expect(hoverChangeSpy).toHaveBeenCalledTimes(1);
    await user.unhover(button);
    expect(button).not.toHaveAttribute("data-hovered");
    expect(button).not.toHaveClass("hover");
    expect(hoverEndSpy).toHaveBeenCalledTimes(1);
    expect(hoverChangeSpy).toHaveBeenCalledTimes(2);
  });

  it("should support focus ring", async () => {
    const { getByRole } = renderUI(() => <Button class={({ isFocusVisible }) => (isFocusVisible() ? "focus" : "")}>Test</Button>);
    const button = getByRole("button");
    expect(button).not.toHaveAttribute("data-focus-visible");
    expect(button).not.toHaveClass("focus");
    await user.tab();
    expect(document.activeElement).toBe(button);
    expect(button).toHaveAttribute("data-focus-visible", "true");
    expect(button).toHaveAttribute("data-focused", "true");
    expect(button).toHaveClass("focus");
    await user.tab();
    expect(button).not.toHaveAttribute("data-focus-visible");
    expect(button).not.toHaveAttribute("data-focused");
    expect(button).not.toHaveClass("focus");
  });

  it("should support press state", async () => {
    const onPress = vi.fn();
    const onClick = vi.fn();
    const onClickCapture = vi.fn();
    const { getByRole } = renderUI(() => (
      <Button class={({ isPressed }) => (isPressed() ? "pressed" : "")} onPress={onPress} onClick={onClick} onClickCapture={onClickCapture}>
        Test
      </Button>
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
      <Button isDisabled class={({ isDisabled }) => (isDisabled() ? "disabled" : "")}>
        Test
      </Button>
    ));
    const button = getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveClass("disabled");
    expect(button).toHaveAttribute("data-disabled", "true");
  });

  it("should support render props", async () => {
    const { getByRole } = renderUI(() => <Button>{({ isPressed }) => (isPressed() ? "Pressed" : "Test")}</Button>);
    const button = getByRole("button");
    expect(button).toHaveTextContent("Test");
    await user.pointer({ target: button, keys: "[MouseLeft>]" });
    expect(button).toHaveTextContent("Pressed");
    await user.pointer({ target: button, keys: "[/MouseLeft]" });
    expect(button).toHaveTextContent("Test");
  });

  it("displays a spinner when isPending prop is true", async () => {
    const onPressSpy = vi.fn();
    const pending = signal(false);
    const { getByRole } = renderUI(() => (
      <Button
        onPress={() => {
          pending.set(true);
          onPressSpy();
        }}
        isPending={pending}
      >
        {({ isPending }) => (
          <>
            <span style={{ opacity: isPending() ? "0" : undefined }}>Test</span>
            <ProgressBar aria-label="loading" style={{ opacity: isPending() ? undefined : "0" }} isIndeterminate>
              loading
            </ProgressBar>
          </>
        )}
      </Button>
    ));
    const button = getByRole("button");
    expect(button).not.toHaveAttribute("aria-disabled");
    await user.click(button);
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAttribute("data-pending", "true");
    await user.click(button);
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(onPressSpy).toHaveBeenCalledTimes(1);
  });

  it("should prevent explicit mouse form submission when isPending", async () => {
    const onSubmitSpy = vi.fn((e: Event) => e.preventDefault());
    const pending = signal(false);
    const { getByRole } = renderUI(() => (
      <form onSubmit={onSubmitSpy}>
        <Button type="submit" onPress={() => setTimeout(() => pending.set(true), 0)} isPending={pending}>
          Test
        </Button>
      </form>
    ));
    const button = getByRole("button");
    await user.click(button);
    expect(onSubmitSpy).toHaveBeenCalled();
    onSubmitSpy.mockClear();
    await new Promise((r) => setTimeout(r, 10));
    await user.click(button);
    expect(onSubmitSpy).not.toHaveBeenCalled();
  });

  it("should prevent explicit keyboard form submission when isPending", async () => {
    const onSubmitSpy = vi.fn((e: Event) => e.preventDefault());
    const pending = signal(false);
    renderUI(() => (
      <form onSubmit={onSubmitSpy}>
        <Button type="submit" onPress={() => setTimeout(() => pending.set(true), 0)} isPending={pending}>
          Test
        </Button>
      </form>
    ));
    await user.tab();
    await user.keyboard("{Enter}");
    expect(onSubmitSpy).toHaveBeenCalled();
    onSubmitSpy.mockClear();
    await new Promise((r) => setTimeout(r, 10));
    await user.keyboard("{Enter}");
    expect(onSubmitSpy).not.toHaveBeenCalled();
  });

  it("should prevent implicit form submission when isPending", async () => {
    const onSubmitSpy = vi.fn((e: Event) => e.preventDefault());
    const pending = signal(false);
    renderUI(() => (
      <form
        onSubmit={(e) => onSubmitSpy(e)}
        onKeyDown={(e) => {
          if (e.key === "Enter") document.body.addEventListener("keyup", () => pending.set(true), { capture: true, once: true });
        }}
      >
        <label for="foo">Test</label>
        <input id="foo" type="text" />
        <input id="bar" type="text" />
        <Button type="submit" isPending={pending}>
          Test
        </Button>
      </form>
    ));
    await user.tab();
    await user.keyboard("{Enter}");
    expect(onSubmitSpy).toHaveBeenCalled();
    onSubmitSpy.mockClear();
    await user.keyboard("{Enter}");
    expect(onSubmitSpy).not.toHaveBeenCalled();
  });

  it("disables press when in pending state for context", async () => {
    // Upstream: inside a DialogTrigger; here the trigger's PressResponder (the same context channel).
    const onFocusSpy = vi.fn();
    const onBlurSpy = vi.fn();
    const onTriggerPress = vi.fn();
    const { getByRole } = renderUI(() => (
      <PressResponder onPress={onTriggerPress}>
        <Button isPending onFocus={onFocusSpy} onBlur={onBlurSpy}>
          Delete…
        </Button>
      </PressResponder>
    ));
    const button = getByRole("button");
    await user.click(button);
    expect(onFocusSpy).toHaveBeenCalled();
    expect(onBlurSpy).not.toHaveBeenCalled();
    expect(onTriggerPress).not.toHaveBeenCalled();
    await user.click(document.body);
    expect(onBlurSpy).toHaveBeenCalled();
  });
});

describe("Button (Rivet)", () => {
  let user: ReturnType<typeof userEvent.setup>;
  beforeAll(() => {
    user = userEvent.setup();
  });

  it("no interaction attributes before interaction; handlers write them without a render prop", async () => {
    const { getByRole } = renderUI(() => <Button>Test</Button>);
    const button = getByRole("button");
    for (const name of ["data-hovered", "data-pressed", "data-focused", "data-focus-visible"]) expect(button).not.toHaveAttribute(name);
    await user.hover(button);
    expect(button).toHaveAttribute("data-hovered", "true");
    await user.pointer({ target: button, keys: "[MouseLeft>]" });
    expect(button).toHaveAttribute("data-pressed", "true");
    expect(button).toHaveAttribute("data-focused", "true");
    expect(button).not.toHaveAttribute("data-focus-visible");
    await user.pointer({ target: button, keys: "[/MouseLeft]" });
    expect(button).not.toHaveAttribute("data-pressed");
  });

  it("isDisabled accessor flips without re-creating the button", async () => {
    const disabled = signal(true);
    const onPress = vi.fn();
    const { getByRole } = renderUI(() => (
      <Button isDisabled={disabled} onPress={onPress}>
        Step
      </Button>
    ));
    const button = getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("data-disabled", "true");
    disabled.set(false);
    expect(getByRole("button")).toBe(button);
    expect(button).not.toBeDisabled();
    expect(button).not.toHaveAttribute("data-disabled");
    await user.click(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("allowFocusWhenDisabled: tabIndex -1 while disabled", () => {
    const disabled = signal(true);
    const { getByRole } = renderUI(() => (
      <Button isDisabled={disabled} allowFocusWhenDisabled>
        +
      </Button>
    ));
    const button = getByRole("button");
    expect(button).toHaveAttribute("tabindex", "-1");
    disabled.set(false);
    expect(button).not.toHaveAttribute("tabindex");
  });

  it("PressResponder: trigger props (accessor aria-expanded, id), isPressed accessor, onPress chain, ref", async () => {
    const open = signal(false);
    const buttonRef = createRef<HTMLButtonElement>();
    const order: string[] = [];
    const { getByRole } = renderUI(() => (
      <PressResponder
        // RA spreads trigger props (MenuTrigger `menuTriggerProps`) into PressResponder; its type lists press props only.
        {...({ id: "trigger", "aria-haspopup": "dialog", "aria-expanded": () => open() } as {})}
        isPressed={() => open()}
        ref={buttonRef}
        onPress={() => (order.push("responder"), open.set(!open()))}
      >
        <Button onPress={() => order.push("button")}>Open</Button>
      </PressResponder>
    ));
    const button = getByRole("button");
    expect(button).toHaveAttribute("id", "trigger");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
    expect(buttonRef()).toBe(button);
    await user.click(button);
    expect(order).toEqual(["responder", "button"]);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(button).toHaveAttribute("data-pressed", "true");
    open.set(false);
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).not.toHaveAttribute("data-pressed");
  });

  it("ButtonContext slots: onPress from the provider chains with the button's own", async () => {
    const calls: string[] = [];
    const { getByRole } = renderUI(() => (
      <Provider token={ButtonContext} value={{ slots: { close: { onPress: () => calls.push("ctx") } } }}>
        <Button slot="close" onPress={() => calls.push("own")}>
          Close
        </Button>
      </Provider>
    ));
    await user.click(getByRole("button"));
    expect(calls).toEqual(["ctx", "own"]);
  });

  it("pending: id auto-created; aria-label + pending → aria-labelledby `<id> <id>-progress`", () => {
    const { getByRole } = renderUI(() => (
      <Button aria-label="Save" isPending>
        Save
      </Button>
    ));
    const button = getByRole("button");
    const id = button.id;
    expect(id).toBeTruthy();
    expect(button).toHaveAttribute("aria-labelledby", `${id} ${id}-progress`);
  });

  it("pending: provides ProgressBarContext `{ id: <id>-progress }` so the progress bar names the button", () => {
    const { getByRole } = renderUI(() => (
      <Button aria-label="Save" isPending>
        <ProgressBar aria-label="Saving" isIndeterminate />
      </Button>
    ));
    const button = getByRole("button");
    const progress = getByRole("progressbar");
    expect(progress.id).toBe(`${button.id}-progress`);
    expect(button).toHaveAttribute("aria-labelledby", `${button.id} ${progress.id}`);
    expect(button).toHaveAccessibleName("Save Saving");
  });

  it("provides ProgressBarContext on every button (RAC)", () => {
    const { getByRole } = renderUI(() => (
      <Button>
        <ProgressBar aria-label="Saving" isIndeterminate />
      </Button>
    ));
    expect(getByRole("progressbar").id).toBe(`${getByRole("button").id}-progress`);
  });

  it("accessor aria-label / aria-labelledby update without re-creating the button (Tree chevron)", () => {
    const expanded = signal(false);
    const labelledBy = signal<string | undefined>(undefined);
    let runs = 0;
    const { getByRole } = renderUI(() => (
      <Button aria-label={() => (expanded() ? "Collapse" : "Expand")} aria-labelledby={() => labelledBy()}>
        {() => {
          runs++;
          return "chevron";
        }}
      </Button>
    ));
    const button = getByRole("button");
    expect(button).toHaveAttribute("aria-label", "Expand");
    expect(button).not.toHaveAttribute("aria-labelledby");
    expanded.set(true);
    labelledBy.set("x");
    expect(getByRole("button")).toBe(button);
    expect(button).toHaveAttribute("aria-label", "Collapse");
    expect(button).toHaveAttribute("aria-labelledby", "x");
    expect(runs).toBe(1);
  });

  it("accessor aria-label from a ButtonContext slot; pending name follows it", () => {
    const label = signal<string | undefined>(undefined);
    const { getByRole } = renderUI(() => (
      <Provider token={ButtonContext} value={{ slots: { chevron: { "aria-label": () => label() } } }}>
        <Button slot="chevron" isPending>
          x
        </Button>
      </Provider>
    ));
    const button = getByRole("button");
    expect(button).not.toHaveAttribute("aria-labelledby");
    label.set("Expand");
    expect(button).toHaveAttribute("aria-label", "Expand");
    expect(button).toHaveAttribute("aria-labelledby", `${button.id} ${button.id}-progress`);
  });

  it("forwards data-rv-prevent-focus (own props and ButtonContext slot props)", () => {
    const { getAllByRole } = renderUI(() => (
      <>
        <Button data-rv-prevent-focus>own</Button>
        <Provider token={ButtonContext} value={{ slots: { chevron: { "data-rv-prevent-focus": true } } }}>
          <Button slot="chevron">slot</Button>
        </Provider>
      </>
    ));
    const [own, slotted] = getAllByRole("button");
    expect(own!.hasAttribute("data-rv-prevent-focus")).toBe(true);
    expect(slotted!.hasAttribute("data-rv-prevent-focus")).toBe(true);
  });

  it("FocusableContext (TooltipTrigger): focus / blur / keyboard handlers chain after the own, attributes fill in, ref synced", async () => {
    const calls: string[] = [];
    const el = createRef<Element>();
    const { getByRole } = renderUI(() => (
      <FocusableProvider
        ref={el}
        aria-describedby="tip"
        onFocus={() => calls.push("ctx-focus")}
        onBlur={() => calls.push("ctx-blur")}
        onKeyDown={(e: KeyboardEvent) => calls.push("ctx-key:" + e.key)}
        onPointerEnter={() => calls.push("ctx-enter")}
      >
        <Button onFocus={() => calls.push("own-focus")}>Trigger</Button>
      </FocusableProvider>
    ));
    const target = getByRole("button");
    expect(el()).toBe(target);
    expect(target).toHaveAttribute("aria-describedby", "tip");
    await user.hover(target);
    await user.tab();
    expect(document.activeElement).toBe(target);
    await user.keyboard("a");
    await user.tab();
    expect(calls).toEqual(["ctx-enter", "own-focus", "ctx-focus", "ctx-key:a", "ctx-key:Tab", "ctx-blur"]);
  });

  it("FocusableContext: a disabled button takes no context props", () => {
    const { getByRole } = renderUI(() => (
      <FocusableProvider aria-describedby="tip">
        <Button isDisabled>Trigger</Button>
      </FocusableProvider>
    ));
    expect(getByRole("button")).not.toHaveAttribute("aria-describedby");
  });

  it("FocusableContext: an accessor / live isDisabled gates the context props at event time (same element, never read at render)", async () => {
    for (const form of ["accessor", "live"] as const) {
      const disabled = signal(true);
      const calls: string[] = [];
      const { getByRole } = renderUI(() => (
        <FocusableProvider aria-describedby="tip" onFocus={() => calls.push("ctx-focus")} onPointerEnter={() => calls.push("ctx-enter")}>
          {form === "accessor" ? <Button isDisabled={() => disabled()}>Trigger</Button> : <Button isDisabled={disabled()}>Trigger</Button>}
        </FocusableProvider>
      ));
      const target = getByRole("button");
      expect(target).not.toHaveAttribute("aria-describedby");
      disabled.set(false);
      expect(getByRole("button")).toBe(target);
      expect(target).toHaveAttribute("aria-describedby", "tip");
      await user.hover(target);
      target.focus();
      expect(calls).toEqual(["ctx-enter", "ctx-focus"]);
      target.blur();
      await user.unhover(target);
      disabled.set(true);
      expect(target).not.toHaveAttribute("aria-describedby");
      target.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
      expect(calls).toEqual(["ctx-enter", "ctx-focus"]);
      cleanup();
    }
  });

  it("FocusableContext DOM attributes: aria-haspopup, accessor aria-expanded, aria-controls, data-*; own props win", () => {
    const open = signal(false);
    const { getByRole } = renderUI(() => (
      <FocusableProvider aria-haspopup="dialog" aria-expanded={() => open()} aria-controls="pop" aria-describedby="ctx" data-trigger="preview">
        <Button aria-describedby="own">Trigger</Button>
      </FocusableProvider>
    ));
    const el = getByRole("button");
    expect(el).toHaveAttribute("aria-haspopup", "dialog");
    expect(el).toHaveAttribute("aria-expanded", "false");
    expect(el).toHaveAttribute("aria-controls", "pop");
    expect(el).toHaveAttribute("data-trigger", "preview");
    expect(el).toHaveAttribute("aria-describedby", "own");
    open.set(true);
    expect(el).toHaveAttribute("aria-expanded", "true");
  });

  it("isDisabled turning true while pressed cancels the press (RA usePress isDisabled effect)", async () => {
    const disabled = signal(false);
    const events: string[] = [];
    const user = userEvent.setup();
    const { getByRole } = renderUI(() => (
      <Button
        isDisabled={disabled}
        onPressStart={() => events.push("start")}
        onPressEnd={() => events.push("end")}
        onPress={() => events.push("press")}
        onPressChange={(p) => events.push("change:" + p)}
      >
        Spin
      </Button>
    ));
    const button = getByRole("button");
    await user.pointer({ keys: "[MouseLeft>]", target: button });
    expect(button).toHaveAttribute("data-pressed", "true");
    disabled.set(true);
    expect(events).toEqual(["start", "change:true", "end", "change:false"]);
    expect(button).not.toHaveAttribute("data-pressed");
    await user.pointer({ keys: "[/MouseLeft]", target: button });
    expect(events).not.toContain("press");
  });

  it("renders nothing in the collection build pass (RAC createHideableComponent)", () => {
    const { container } = render((() => (
      <Provider token={HiddenContext} value={true}>
        <Button>Hidden</Button>
      </Provider>
    )) as never);
    expect((container as HTMLElement).querySelector("button")).toBeNull();
  });
});
