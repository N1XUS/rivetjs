// Rivet-only (no upstream suite): delegated interaction dispatch (IMPL-INTERACT 2026-10-09). The cdk hook bags carry
// only bubbling handlers (one document listener per event type, shadow roots included); React Aria's non-bubbling
// events bind on the element for the interaction only (press enter / leave / dragstart, hover leave, focus blur).
// Edge cases: listener counts, shadow roots, nested pressables, portals, an element removed mid-press, a user
// handler stopping propagation, user enter / leave pass-through.
import { afterEach, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { mount } from "@rivetjs/runtime/dom";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { Button } from "../button/index.tsx";
import { pressProps } from "../interactions/press.tsx";
import { Portal } from "../portal/index.tsx";
import { focusProps } from "../interactions/focus.tsx";
import { mergeProps } from "../interactions/merge-props.tsx";
import { Focusable, FocusableProvider } from "../focus/focusable.tsx";
import { TextField } from "../text-field/index.tsx";
import { Input } from "../input/index.tsx";
import { hoverProps } from "../interactions/hover.tsx";
import { Checkbox } from "../checkbox/index.tsx";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const pointer = (type: string, init: PointerEventInit = {}) =>
  new PointerEvent(type, {
    bubbles: !type.endsWith("enter") && !type.endsWith("leave"),
    cancelable: true,
    composed: true,
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true,
    button: 0,
    ...init,
  });

/** Records `addEventListener` calls on elements (not document / window) while `fn` runs. */
function countElementListeners(fn: () => void): string[] {
  const types: string[] = [];
  const add = EventTarget.prototype.addEventListener;
  vi.spyOn(EventTarget.prototype, "addEventListener").mockImplementation(function (
    this: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ) {
    if (this instanceof Element) types.push(type);
    return add.call(this, type, listener, options);
  });
  try {
    fn();
  } finally {
    vi.mocked(EventTarget.prototype.addEventListener).mockRestore();
  }
  return types;
}

describe("delegated interactions", () => {
  it("mounts a Button without element listeners", () => {
    const types = countElementListeners(() => {
      render(() => (
        <Button onPress={() => {}} onHoverStart={() => {}} onFocusChange={() => {}}>
          Go
        </Button>
      ));
    });
    expect(types).toEqual([]);
  });

  it("binds a user onPointerEnter / onPointerLeave natively and runs it", () => {
    const enter = vi.fn();
    const leave = vi.fn();
    const { container } = render(() => (
      <Button onPointerEnter={() => enter()} onPointerLeave={() => leave()}>
        Go
      </Button>
    ));
    const button = container.querySelector("button")!;
    button.dispatchEvent(pointer("pointerover", { relatedTarget: document.body }));
    button.dispatchEvent(pointer("pointerenter", { relatedTarget: document.body }));
    expect(enter).toHaveBeenCalledTimes(1);
    expect(button).toHaveAttribute("data-hovered", "true");
    button.dispatchEvent(pointer("pointerleave", { relatedTarget: document.body }));
    expect(leave).toHaveBeenCalledTimes(1);
    expect(button).not.toHaveAttribute("data-hovered");
  });

  it("starts hover once while the pointer moves between descendants (pointerenter emulation)", () => {
    const onHoverStart = vi.fn();
    const onHoverEnd = vi.fn();
    const { container } = render(() => (
      <Button onHoverStart={() => onHoverStart()} onHoverEnd={() => onHoverEnd()}>
        <span id="a">A</span>
        <span id="b">B</span>
      </Button>
    ));
    const button = container.querySelector("button")!;
    const a = container.querySelector("#a")!;
    const b = container.querySelector("#b")!;
    a.dispatchEvent(pointer("pointerover", { relatedTarget: document.body }));
    b.dispatchEvent(pointer("pointerover", { relatedTarget: a }));
    button.dispatchEvent(pointer("pointerover", { relatedTarget: b }));
    expect(onHoverStart).toHaveBeenCalledTimes(1);
    button.dispatchEvent(pointer("pointerleave", { relatedTarget: document.body }));
    expect(onHoverEnd).toHaveBeenCalledTimes(1);
    // The transient leave listener is gone: another leave does nothing.
    button.dispatchEvent(pointer("pointerleave", { relatedTarget: document.body }));
    expect(onHoverEnd).toHaveBeenCalledTimes(1);
  });

  it("hovers, focuses and presses a Button inside a shadow root", async () => {
    const onPress = vi.fn();
    const onHoverStart = vi.fn();
    const onFocusChange = vi.fn();
    const host = document.body.appendChild(document.createElement("div"));
    const root = host.attachShadow({ mode: "open" });
    const dispose = mount(
      () => (
        <Button onPress={() => onPress()} onHoverStart={() => onHoverStart()} onFocusChange={(f) => onFocusChange(f)}>
          Go
        </Button>
      ),
      root as unknown as DocumentFragment,
    );
    try {
      const button = root.querySelector("button")!;
      button.dispatchEvent(pointer("pointerover", { relatedTarget: document.body }));
      expect(onHoverStart).toHaveBeenCalledTimes(1);
      expect(button).toHaveAttribute("data-hovered", "true");
      button.focus();
      expect(onFocusChange).toHaveBeenLastCalledWith(true);
      expect(button).toHaveAttribute("data-focused", "true");
      button.blur();
      expect(onFocusChange).toHaveBeenLastCalledWith(false);
      expect(button).not.toHaveAttribute("data-focused");
      button.dispatchEvent(pointer("pointerdown"));
      button.dispatchEvent(pointer("pointerup"));
      button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, composed: true, detail: 1 }));
      await flush();
      expect(onPress).toHaveBeenCalledTimes(1);
    } finally {
      dispose();
      host.remove();
    }
  });

  it("presses only the innermost pressable unless it continues propagation", () => {
    const outer = vi.fn();
    const inner = vi.fn();
    let carry = false;
    const { container } = render(() => {
      const o = pressProps({ onPressStart: () => outer() });
      const i = pressProps({
        onPressStart: (e) => {
          inner();
          if (carry) e.continuePropagation();
        },
      });
      return (
        <div id="outer" {...o.pressProps}>
          <div id="inner" {...i.pressProps}>
            in
          </div>
        </div>
      );
    });
    const target = container.querySelector("#inner")!;
    target.dispatchEvent(pointer("pointerdown"));
    target.dispatchEvent(pointer("pointerup"));
    target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 }));
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
    carry = true;
    target.dispatchEvent(pointer("pointerdown"));
    target.dispatchEvent(pointer("pointerup"));
    target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 }));
    expect(inner).toHaveBeenCalledTimes(2);
    expect(outer).toHaveBeenCalledTimes(1);
  });

  it("tracks press leave / re-enter and drag only during the press", () => {
    const onPressStart = vi.fn();
    const onPressEnd = vi.fn();
    const { container } = render(() => {
      const p = pressProps({ onPressStart: () => onPressStart(), onPressEnd: () => onPressEnd() });
      return (
        <div id="t" {...p.pressProps}>
          t
        </div>
      );
    });
    const t = container.querySelector("#t")!;
    // No press: enter / leave / dragstart do nothing (no listener bound).
    t.dispatchEvent(pointer("pointerleave"));
    t.dispatchEvent(new DragEvent("dragstart", { bubbles: true }));
    expect(onPressEnd).not.toHaveBeenCalled();
    t.dispatchEvent(pointer("pointerdown"));
    expect(onPressStart).toHaveBeenCalledTimes(1);
    t.dispatchEvent(pointer("pointerleave"));
    expect(onPressEnd).toHaveBeenCalledTimes(1);
    t.dispatchEvent(pointer("pointerenter"));
    expect(onPressStart).toHaveBeenCalledTimes(2);
    t.dispatchEvent(new DragEvent("dragstart", { bubbles: true }));
    expect(onPressEnd).toHaveBeenCalledTimes(2);
    // The drag cancelled the press: its listeners are gone.
    t.dispatchEvent(pointer("pointerenter"));
    expect(onPressStart).toHaveBeenCalledTimes(2);
  });

  it("does not press a Button removed during the press", async () => {
    const onPress = vi.fn();
    const onPressEnd = vi.fn();
    const result = render(() => (
      <Button onPress={() => onPress()} onPressEnd={() => onPressEnd()}>
        Go
      </Button>
    ));
    const button = result.container.querySelector("button")!;
    button.dispatchEvent(pointer("pointerdown"));
    expect(button).toHaveAttribute("data-pressed", "true");
    result.unmount();
    expect(() => document.dispatchEvent(pointer("pointerup"))).not.toThrow();
    await flush();
    expect(onPress).not.toHaveBeenCalled();
  });

  it("does not start a press when a descendant's handler stops propagation", () => {
    const onPressStart = vi.fn();
    const { container } = render(() => (
      <Button onPressStart={() => onPressStart()}>
        <span id="child" onPointerDown={(e) => e.stopPropagation()}>
          x
        </span>
      </Button>
    ));
    const child = container.querySelector("#child")!;
    child.dispatchEvent(pointer("pointerdown"));
    expect(onPressStart).not.toHaveBeenCalled();
    expect(container.querySelector("button")).not.toHaveAttribute("data-pressed");
  });

  it("presses and hovers a Button inside a portal", async () => {
    const onPress = vi.fn();
    const onHoverStart = vi.fn();
    render(() => (
      <Portal>
        <Button id="portaled" onPress={() => onPress()} onHoverStart={() => onHoverStart()}>
          Go
        </Button>
      </Portal>
    ));
    await flush();
    const button = document.getElementById("portaled")!;
    expect(button.closest("[data-rivet-portal]")?.parentNode).toBe(document.body);
    button.dispatchEvent(pointer("pointerover", { relatedTarget: document.body }));
    expect(onHoverStart).toHaveBeenCalledTimes(1);
    button.dispatchEvent(pointer("pointerdown"));
    button.dispatchEvent(pointer("pointerup"));
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 }));
    await flush();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  // React Aria order (mergeProps chain order): the user callbacks of a hook run where the hook's bag sits in the chain;
  // a handler merged after the bag runs after them (RA: `mergeProps(focusProps, { onFocus })`).
  describe("React Aria handler order", () => {
    it("focusProps callbacks run before a later merged onFocus / onBlur", () => {
      const log: string[] = [];
      const { container } = render(() => {
        const focus = focusProps({
          onFocus: () => log.push("hook:focus"),
          onBlur: () => log.push("hook:blur"),
          onFocusChange: (f) => log.push(`hook:change:${f}`),
        });
        const props = mergeProps(focus.focusProps, { onFocus: () => log.push("user:focus"), onBlur: () => log.push("user:blur") });
        return <div id="f" tabIndex={0} {...props} />;
      });
      const el = container.querySelector<HTMLElement>("#f")!;
      el.focus();
      el.blur();
      expect(log).toEqual(["hook:focus", "hook:change:true", "user:focus", "hook:blur", "hook:change:false", "user:blur"]);
    });

    it("Focusable: own callbacks, then the FocusableProvider's handlers (RA useFocusable)", () => {
      const log: string[] = [];
      const { container } = render(() => (
        <FocusableProvider onFocus={() => log.push("ctx:focus")} onBlur={() => log.push("ctx:blur")}>
          <Focusable onFocus={() => log.push("own:focus")} onBlur={() => log.push("own:blur")} onFocusChange={(f) => log.push(`own:change:${f}`)}>
            {(p) => <span {...p} ref={p.ref as never} id="t" role="button" tabIndex={0} />}
          </Focusable>
        </FocusableProvider>
      ));
      const el = container.querySelector<HTMLElement>("#t")!;
      el.focus();
      el.blur();
      expect(log).toEqual(["own:focus", "own:change:true", "ctx:focus", "own:blur", "own:change:false", "ctx:blur"]);
    });

    it("TextField callbacks run before the Input's own onFocus / onBlur (RAC useContextProps merge)", () => {
      const log: string[] = [];
      const { container } = render(() => (
        <TextField
          aria-label="t"
          onFocus={() => log.push("field:focus")}
          onBlur={() => log.push("field:blur")}
          onFocusChange={(f) => log.push(`field:change:${f}`)}
        >
          <Input onFocus={() => log.push("input:focus")} onBlur={() => log.push("input:blur")} />
        </TextField>
      ));
      const input = container.querySelector("input")!;
      input.focus();
      input.blur();
      expect(log).toEqual(["field:focus", "field:change:true", "input:focus", "field:blur", "field:change:false", "input:blur"]);
    });

    it("Button: onFocus / onFocusChange run before data-focused is written; onBlur sees it still set", () => {
      const log: string[] = [];
      const { container } = render(() => (
        <Button
          onFocus={(e) => log.push(`focus:${(e.target as Element).getAttribute("data-focused")}`)}
          onFocusChange={(f) => log.push(`change:${f}`)}
          onBlur={(e) => log.push(`blur:${(e.target as Element).getAttribute("data-focused")}`)}
        >
          Go
        </Button>
      ));
      const button = container.querySelector("button")!;
      button.focus();
      expect(button).toHaveAttribute("data-focused", "true");
      button.blur();
      expect(log).toEqual(["focus:null", "change:true", "blur:true", "change:false"]);
    });

    it("hoverProps callbacks run after an onPointerEnter merged before the bag, before one merged after", () => {
      const log: string[] = [];
      const { container } = render(() => {
        const hover = hoverProps({ onHoverStart: () => log.push("hover:start"), onHoverEnd: () => log.push("hover:end") });
        const props = mergeProps({ onPointerEnter: () => log.push("before:enter"), onPointerLeave: () => log.push("before:leave") }, hover.hoverProps, {
          onPointerEnter: () => log.push("after:enter"),
          onPointerLeave: () => log.push("after:leave"),
        });
        return <div id="h" {...props} />;
      });
      const el = container.querySelector("#h")!;
      el.dispatchEvent(pointer("pointerover", { relatedTarget: document.body }));
      el.dispatchEvent(pointer("pointerenter", { relatedTarget: document.body }));
      el.dispatchEvent(pointer("pointerleave", { relatedTarget: document.body }));
      expect(log).toEqual(["before:enter", "hover:start", "after:enter", "before:leave", "hover:end", "after:leave"]);
    });

    it("Checkbox: a user onPointerEnter runs before onHoverStart and sees no data-hovered (RAC DOMProps first)", async () => {
      const log: string[] = [];
      const { container } = render(() => (
        <Checkbox
          onPointerEnter={(e) => log.push(`enter:${(e.currentTarget as Element).getAttribute("data-hovered")}`)}
          onHoverStart={() => log.push("hover:start")}
        >
          Box
        </Checkbox>
      ));
      const label = container.querySelector("label")!;
      label.dispatchEvent(pointer("pointerover", { relatedTarget: document.body }));
      label.dispatchEvent(pointer("pointerenter", { relatedTarget: document.body }));
      await flush();
      expect(log).toEqual(["enter:null", "hover:start"]);
      expect(label).toHaveAttribute("data-hovered", "true");
    });

    it("Checkbox without hover callbacks: a user onPointerEnter still sees no data-hovered", async () => {
      const log: string[] = [];
      const { container } = render(() => (
        <Checkbox onPointerEnter={(e) => log.push(`enter:${(e.currentTarget as Element).getAttribute("data-hovered")}`)}>Box</Checkbox>
      ));
      const label = container.querySelector("label")!;
      label.dispatchEvent(pointer("pointerover", { relatedTarget: document.body }));
      await flush();
      label.dispatchEvent(pointer("pointerenter", { relatedTarget: document.body }));
      await flush();
      expect(log).toEqual(["enter:null"]);
      expect(label).toHaveAttribute("data-hovered", "true");
    });

    it("Button: a user onPointerOver runs before the hover starts (RA: hover starts on pointerenter)", () => {
      const log: string[] = [];
      const { container } = render(() => (
        <Button
          onPointerOver={(e) => log.push(`over:${(e.currentTarget as Element).getAttribute("data-hovered")}`)}
          onHoverStart={() => log.push("hover:start")}
        >
          Go
        </Button>
      ));
      const button = container.querySelector("button")!;
      button.dispatchEvent(pointer("pointerover", { relatedTarget: document.body }));
      expect(log).toEqual(["over:null", "hover:start"]);
    });
  });
});
