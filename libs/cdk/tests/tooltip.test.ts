// Ports of React Stately's useTooltipTriggerState.test.js and React Aria's useTooltip.test.js
// (Apache-2.0, © Adobe) onto `createTooltipTriggerState()` / `openTooltip()` / `closeTooltip()` and the
// trigger / tooltip handlers of @rivetjs/cdk/tooltip/behaviour. happy-dom stands in for jsdom; "render"
// = create the trigger (a button) and wire the `tooltipTriggerProps` handlers the component passes to it
// through FocusableProvider. The original renders the tooltip while `state.isOpen`: here "the tooltip is in
// the document" is `state.isOpen()`; `fireEvent.mouseEnter` / `mouseLeave` dispatch the pointer events
// a browser sends (pointerover + pointerenter / pointerout + pointerleave). Expected values are the
// original ones.
import { describe, it, expect, jest, beforeAll, beforeEach, afterEach } from "@rivetjs/testing/jest";
import { signal, untrack } from "@rivetjs/reactivity";
import { installDom } from "./install-dom.ts";

const dom = installDom();
const { createTooltipTriggerState, openTooltip, closeTooltip, _resetTooltips } = await import("../state/tooltip.ts");
const behaviour = await import("../tooltip/behaviour.tsx");
const { setupGlobalFocusEvents } = await import("../interactions/focus-visible.tsx");
type State = ReturnType<typeof createTooltipTriggerState>;
type Props = Parameters<typeof createTooltipTriggerState>[0] & { label?: string };

// Sync with TOOLTIP_COOLDOWN & TOOLTIP_DELAY in useTooltipTriggerState
const TOOLTIP_COOLDOWN = 500;
const TOOLTIP_DELAY = 1500;

const pointer = (type: string, target: Element, relatedTarget: EventTarget | null, bubbles = true) =>
  target.dispatchEvent(new PointerEvent(type, { bubbles, cancelable: true, pointerType: "mouse", relatedTarget } as PointerEventInit));
const fire = {
  mouseDown: (target: Element) => pointer("pointerdown", target, null),
  mouseUp: (target: Element) => pointer("pointerup", target, null),
  mouseMove: (target: Element) => pointer("pointermove", target, null),
  mouseEnter(target: Element) {
    pointer("pointerover", target, document.body);
    pointer("pointerenter", target, document.body, false);
  },
  mouseLeave(target: Element) {
    pointer("pointerout", target, document.body);
    pointer("pointerleave", target, document.body, false);
  },
};

const states: State[] = [];
/** `<TooltipTrigger>` of the original suites: a button with the trigger props; `tooltip()` is the open tooltip. */
function renderTrigger(props: Props = {}) {
  const state = createTooltipTriggerState(props);
  states.push(state);
  const options = { isDisabled: props.isDisabled, trigger: props.trigger, shouldCloseOnPress: props.shouldCloseOnPress };
  const button = document.createElement("button");
  button.setAttribute("aria-label", props.label ?? "trigger");
  document.body.append(button);
  // TooltipTrigger's FocusableProvider props on the trigger (tooltipTriggerProps).
  const { triggerProps } = behaviour.tooltipTriggerProps({ ...options, tooltipId: "t" }, state);
  for (const [name, handler] of Object.entries(triggerProps)) button.addEventListener(name.slice(2).toLowerCase(), handler as EventListener);
  // useTooltip(props, state): hovering the tooltip keeps it open. `withState: false`: useTooltip(tooltipProps).
  let element: HTMLElement | null = null;
  const tooltip = (withState = true) => {
    if (!untrack(state.isOpen)) return null;
    if (!element) {
      element = document.createElement("span");
      element.setAttribute("role", "tooltip");
      element.addEventListener("pointerenter", (e) => behaviour.tooltipPointerEnter(e as PointerEvent, {}, withState ? state : undefined));
      element.addEventListener("pointerleave", (e) => behaviour.tooltipPointerLeave(e as PointerEvent, {}, withState ? state : undefined));
      document.body.append(element);
    }
    return element;
  };
  return { state, button, tooltip, isOpen: () => untrack(state.isOpen) };
}

beforeAll(() => {
  setupGlobalFocusEvents(document.body);
});

beforeEach(() => {
  dom.reset();
});

afterEach(() => {
  // there's global state, so we need to make sure to run out the cooldown for every test
  for (const state of states.splice(0)) closeTooltip(state, true);
  if (jest.isFakeTimers()) jest.runAllTimers();
  _resetTooltips();
});

describe("useTooltipTriggerState", () => {
  const onOpenChange = jest.fn();

  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    onOpenChange.mockClear();
  });

  describe("custom close delay", () => {
    it("closes with a custom close delay less than the default", () => {
      const closeDelay = 100;
      const { button, isOpen } = renderTrigger({ onOpenChange, closeDelay });
      fire.mouseDown(document.body);
      fire.mouseUp(document.body);

      fire.mouseEnter(button);
      fire.mouseMove(button);

      expect(onOpenChange).not.toHaveBeenCalled();
      expect(isOpen()).toBe(false);

      // run through open timer and confirm that it has opened
      jest.advanceTimersByTime(TOOLTIP_DELAY);
      expect(onOpenChange).toHaveBeenCalledWith(true);
      expect(isOpen()).toBe(true);

      fire.mouseLeave(button);
      fire.mouseMove(button);

      // run half of the way through the timer and confirm that it is still open
      jest.advanceTimersByTime(closeDelay / 2);
      expect(onOpenChange).toHaveBeenCalledWith(true);
      expect(onOpenChange).not.toHaveBeenCalledWith(false);

      // run the rest of the way through the timer and confirm that it has closed
      // Note that closeDelay is less than the default close time of 500ms
      jest.advanceTimersByTime(closeDelay / 2);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("closes with a custom close delay more than the default", () => {
      const closeDelay = 650;
      const delay = 350;
      const { button, isOpen } = renderTrigger({ onOpenChange, closeDelay, delay });
      fire.mouseDown(document.body);
      fire.mouseUp(document.body);

      fire.mouseEnter(button);
      fire.mouseMove(button);

      expect(onOpenChange).not.toHaveBeenCalled();
      expect(isOpen()).toBe(false);

      // run through open timer and confirm that it has opened
      jest.advanceTimersByTime(delay);
      expect(onOpenChange).toHaveBeenCalledWith(true);
      expect(isOpen()).toBe(true);

      fire.mouseLeave(button);

      // run the timer to the default close time to make sure it hasn't closed
      jest.advanceTimersByTime(TOOLTIP_COOLDOWN);
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
      expect(isOpen()).toBe(true);

      // run the rest of the way through the timer and confirm that it has closed
      // Note that closeDelay is more than the default close time of 500ms
      jest.advanceTimersByTime(closeDelay - TOOLTIP_COOLDOWN);
      expect(onOpenChange).toHaveBeenLastCalledWith(false);
    });

    it("closes immediately with a close delay less than zero", () => {
      const { button, isOpen } = renderTrigger({ onOpenChange, closeDelay: -50 });
      fire.mouseDown(document.body);
      fire.mouseUp(document.body);

      fire.mouseEnter(button);
      fire.mouseMove(button);

      expect(onOpenChange).not.toHaveBeenCalled();
      expect(isOpen()).toBe(false);

      // run through open timer and confirm that it has opened
      jest.advanceTimersByTime(TOOLTIP_DELAY);
      expect(onOpenChange).toHaveBeenCalledWith(true);
      expect(isOpen()).toBe(true);

      fire.mouseLeave(button);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("closes immediately with a close delay of zero", () => {
      const { button, isOpen } = renderTrigger({ onOpenChange, closeDelay: 0 });
      fire.mouseDown(document.body);
      fire.mouseUp(document.body);

      fire.mouseEnter(button);
      fire.mouseMove(button);

      expect(onOpenChange).not.toHaveBeenCalled();
      expect(isOpen()).toBe(false);

      // run through open timer and confirm that it has opened
      jest.advanceTimersByTime(TOOLTIP_DELAY);
      expect(onOpenChange).toHaveBeenCalledWith(true);
      expect(isOpen()).toBe(true);

      fire.mouseLeave(button);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe("warmup delay", () => {
    it("clears previous warmup timeout when open is called multiple times rapidly", () => {
      const delay = 1000;
      // ManualTriggerComponent: "Manual Open" calls state.open(false), "Manual Close" state.close(true).
      const { state, isOpen } = renderTrigger({ onOpenChange, delay });
      fire.mouseDown(document.body);
      fire.mouseUp(document.body);

      // First call to open() - starts a warmup timer
      openTooltip(state, false);
      expect(isOpen()).toBe(false);

      // Run 60% through the delay
      jest.advanceTimersByTime(delay * 0.6);
      expect(isOpen()).toBe(false);

      // Second call to open() - should clear previous timeout and start a new one
      openTooltip(state, false);

      // If the old timeout wasn't cleared, the tooltip would open after just 400ms more
      // But since it was cleared and restarted, we need the full 1000ms from the second call
      jest.advanceTimersByTime(delay * 0.4);
      expect(isOpen()).toBe(false);
      expect(onOpenChange).not.toHaveBeenCalled();

      // Advancing the remaining 600ms from the second trigger should open it
      jest.advanceTimersByTime(delay * 0.6);
      expect(onOpenChange).toHaveBeenCalledWith(true);
      expect(isOpen()).toBe(true);
    });

    it("does not open immediately when open() is called twice during warmup", () => {
      const delay = 1000;
      // TooltipTriggerWithDoubleOpen: onMouseEnter runs the trigger's hover and then state.open(false).
      const { state, button, isOpen } = renderTrigger({ onOpenChange, delay });
      button.addEventListener("pointerover", () => openTooltip(state, false));
      fire.mouseDown(document.body);
      fire.mouseUp(document.body);

      fire.mouseEnter(button);
      fire.mouseMove(button);

      expect(onOpenChange).not.toHaveBeenCalled();
      expect(isOpen()).toBe(false);

      // run halfway through the delay timer and confirm that it is still closed
      jest.advanceTimersByTime(delay / 2);
      expect(isOpen()).toBe(false);

      // run through the rest of the delay timer and confirm that it has opened
      jest.advanceTimersByTime(delay / 2);
      expect(onOpenChange).toHaveBeenCalledWith(true);
      expect(isOpen()).toBe(true);
    });
  });

  describe("instant warmup", () => {
    it("animates the first, swaps subsequent instantly, and animates out the last", () => {
      const first = renderTrigger({ label: "trigger1" });
      const second = renderTrigger({ label: "trigger2" });
      const instant = (state: State) => String(untrack(state.shouldSkipAnimation));
      fire.mouseDown(document.body);
      fire.mouseUp(document.body);

      // First tooltip opens after the warmup delay and should animate in (not instant).
      fire.mouseEnter(first.button);
      fire.mouseMove(first.button);
      jest.advanceTimersByTime(TOOLTIP_DELAY);
      expect(first.isOpen()).toBe(true);
      expect(instant(first.state)).toBe("false");

      // Moving to the second trigger while warm: the first closes instantly (no exit animation)
      // and the second opens instantly (no entry animation).
      fire.mouseLeave(first.button);
      fire.mouseEnter(second.button);
      fire.mouseMove(second.button);
      expect(first.isOpen()).toBe(false);
      expect(second.isOpen()).toBe(true);
      expect(instant(first.state)).toBe("true");
      expect(instant(second.state)).toBe("true");

      // Leaving the last tooltip animates out (not instant).
      fire.mouseLeave(second.button);
      expect(instant(second.state)).toBe("false");
      expect(second.isOpen()).toBe(true);
      jest.advanceTimersByTime(TOOLTIP_COOLDOWN);
      expect(second.isOpen()).toBe(false);
    });
  });

  describe("multiple controlled tooltips", () => {
    it("closes previus tooltip when opening a new one", () => {
      const secondOnOpenChange = jest.fn();
      // ManualTooltipTrigger: controlled `isOpen` plus `onOpenChange`.
      const first = renderTrigger({ label: "trigger1", isOpen: signal(false), onOpenChange });
      const second = renderTrigger({ label: "trigger2", isOpen: signal(false), onOpenChange: secondOnOpenChange });
      fire.mouseDown(document.body);
      fire.mouseUp(document.body);

      fire.mouseEnter(first.button);
      fire.mouseMove(first.button);

      // run through open timer and confirm that it has opened
      jest.advanceTimersByTime(TOOLTIP_DELAY);

      expect(onOpenChange).toHaveBeenCalledWith(true);
      expect(first.isOpen()).toBe(true);

      fire.mouseEnter(second.button);
      fire.mouseMove(second.button);

      // run through open timer and confirm that it has opened
      jest.advanceTimersByTime(TOOLTIP_DELAY);

      expect(onOpenChange).toHaveBeenCalledTimes(2);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});

describe("useTooltip", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("opens tooltip on hover after delay", () => {
    jest.useFakeTimers();
    const { button, tooltip } = renderTrigger();

    // trigger pointer modality
    fire.mouseMove(document.body);

    fire.mouseEnter(button);

    expect(tooltip()).toBeNull();
    jest.runAllTimers();
    expect(tooltip()).not.toBeNull();
  });

  it("opens tooltip immediately on hover with `delay: 0`", () => {
    const { button, tooltip } = renderTrigger({ delay: 0 });

    // trigger pointer modality
    fire.mouseMove(document.body);

    fire.mouseEnter(button);

    expect(tooltip()).not.toBeNull();
  });

  it("hides tooltip when hover leaves the trigger", () => {
    jest.useFakeTimers();
    const { button, tooltip } = renderTrigger({ delay: 0 });

    // trigger pointer modality
    fire.mouseMove(document.body);

    fire.mouseEnter(button);
    expect(tooltip(false)).not.toBeNull();

    fire.mouseLeave(button);
    jest.runAllTimers();
    expect(tooltip(false)).toBeNull();
  });

  it("keeps tooltip open when it gets hovered", () => {
    jest.useFakeTimers();
    const { button, tooltip } = renderTrigger({ delay: 0 });

    // trigger pointer modality
    fire.mouseMove(document.body);

    fire.mouseEnter(button);

    const tooltipElement = tooltip()!;
    fire.mouseLeave(button);
    fire.mouseEnter(tooltipElement);
    expect(tooltip()).not.toBeNull();

    jest.runAllTimers();
    expect(tooltip()).not.toBeNull();
  });

  it("hides tooltip when hover leaves", () => {
    jest.useFakeTimers();
    const { button, tooltip } = renderTrigger({ delay: 0 });

    // trigger pointer modality
    fire.mouseMove(document.body);

    fire.mouseEnter(button);

    const tooltipElement = tooltip()!;
    fire.mouseLeave(button);
    fire.mouseEnter(tooltipElement);
    expect(tooltip()).not.toBeNull();

    fire.mouseLeave(tooltipElement);
    jest.runAllTimers();
    expect(tooltip()).toBeNull();
  });

  it("keeps tooltip open when hover returns to trigger from the tooltip", () => {
    jest.useFakeTimers();
    const { button, tooltip } = renderTrigger({ delay: 0 });

    // trigger pointer modality
    fire.mouseMove(document.body);

    fire.mouseEnter(button);

    const tooltipElement = tooltip()!;
    fire.mouseLeave(button);
    fire.mouseEnter(tooltipElement);
    expect(tooltip()).not.toBeNull();

    fire.mouseLeave(tooltipElement);
    fire.mouseEnter(button);
    jest.runAllTimers();
    expect(tooltip()).not.toBeNull();
  });
});

// useTooltipTrigger behaviour covered by the RAC / React Spectrum suites (TooltipTrigger.test.js) at the
// hook level: focus-visible only, `trigger="focus"`, `isDisabled`, press closes, Escape, aria-describedby.
describe("useTooltipTrigger", () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });

  it("opens immediately on keyboard focus, not on pointer focus; blur closes immediately", () => {
    const { button, isOpen } = renderTrigger();
    // Keyboard modality.
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    button.focus();
    expect(isOpen()).toBe(true);
    button.blur();
    expect(isOpen()).toBe(false);
    // Pointer modality: focus does not open.
    fire.mouseDown(document.body);
    button.focus();
    expect(isOpen()).toBe(false);
    button.blur();
  });

  it('trigger="focus" ignores hover; isDisabled ignores hover and focus', () => {
    const focusOnly = renderTrigger({ trigger: "focus", delay: 0, label: "focus" });
    const disabled = renderTrigger({ isDisabled: true, delay: 0, label: "disabled" });
    fire.mouseMove(document.body);
    fire.mouseEnter(focusOnly.button);
    fire.mouseEnter(disabled.button);
    expect(focusOnly.isOpen()).toBe(false);
    expect(disabled.isOpen()).toBe(false);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    focusOnly.button.focus();
    expect(focusOnly.isOpen()).toBe(true);
    disabled.button.focus();
    expect(disabled.isOpen()).toBe(false);
  });

  it("closes on press (pointerdown / keydown on the trigger) unless shouldCloseOnPress is false", () => {
    const closing = renderTrigger({ delay: 0, label: "closing" });
    const keeping = renderTrigger({ delay: 0, shouldCloseOnPress: false, label: "keeping" });
    fire.mouseMove(document.body);
    fire.mouseEnter(closing.button);
    expect(closing.isOpen()).toBe(true);
    fire.mouseDown(closing.button);
    expect(closing.isOpen()).toBe(false);
    fire.mouseLeave(closing.button);
    fire.mouseEnter(keeping.button);
    expect(keeping.isOpen()).toBe(true);
    fire.mouseDown(keeping.button);
    keeping.button.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
    expect(keeping.isOpen()).toBe(true);
  });

  it("press during the warmup cancels the pending open", () => {
    const { button, isOpen } = renderTrigger();
    fire.mouseMove(document.body);
    fire.mouseEnter(button);
    jest.advanceTimersByTime(TOOLTIP_DELAY / 2);
    fire.mouseDown(button);
    jest.advanceTimersByTime(TOOLTIP_DELAY);
    expect(isOpen()).toBe(false);
  });

  it("while open: aria-describedby on the trigger, Escape closes, positioned (default placement top)", () => {
    const { state, button, isOpen } = renderTrigger({ delay: 0 });
    button.setAttribute("aria-describedby", "own");
    const element = document.createElement("div");
    element.id = "t";
    document.body.append(element);
    fire.mouseMove(document.body);
    fire.mouseEnter(button);
    const release = behaviour.attachTooltip(element, state, { triggerRef: button });
    expect(button.getAttribute("aria-describedby")).toBe("own t");
    expect(element.style.position).toBe("absolute");
    expect(element.getAttribute("data-placement")).toBe("top");
    button.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(isOpen()).toBe(false);
    release?.();
    expect(button.getAttribute("aria-describedby")).toBe("own");
  });
});
