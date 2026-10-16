// Testing toolkit regressions (round-2 review TK1–TK6) in Chromium, through `rivetTest()` (which also
// registers the auto-cleanup setup file and the snapshot serializer used below).
import { describe, expect, test, vi } from "vitest";
import { signal } from "@rivetjs/reactivity";
import { Async, clientEffect, For, Show } from "@rivetjs/runtime/dom";
import { createId } from "@rivetjs/runtime/id";
import { fire, flush, render } from "@rivetjs/runtime/testing";
import { act } from "../user/act.ts";
import { installPointerEvent } from "@rivetjs/testing/user";
import { jasmine, spyOnProperty } from "@rivetjs/testing/jasmine";
import "@rivetjs/testing/jest-dom";

const realTimeout = globalThis.setTimeout;
/** Rejects after `ms` of real time (a hang guard that fake timers can't stall). */
const within = <T,>(promise: Promise<T>, ms = 2000): Promise<T> =>
  Promise.race([promise, new Promise<never>((_, reject) => realTimeout(() => reject(new Error(`still pending after ${ms} ms`)), ms))]);

describe("TK1 flush()", () => {
  test("settles under fake timers instead of hanging", async () => {
    const ready = signal("pending");
    const view = render(() => {
      clientEffect(() => {
        ready.set("mounted");
      });
      return <p>{ready()}</p>;
    });
    vi.useFakeTimers();
    try {
      await within(flush());
      expect(view.html()).toBe("<p>mounted</p>");
      // The faked clock is not advanced by flush: timers stay the test's business.
      let fired = false;
      setTimeout(() => (fired = true), 0);
      await within(flush());
      expect(fired).toBe(false);
      vi.advanceTimersByTime(0);
      expect(fired).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  test("with real timers, zero-delay timeouts queued before it fire", async () => {
    let fired = false;
    setTimeout(() => (fired = true), 0);
    await flush();
    expect(fired).toBe(true);
  });
});

describe("TK2 act()", () => {
  const deep = async (depth: number, value: string): Promise<string> => {
    for (let i = 0; i < depth; i++) await Promise.resolve();
    return value;
  };

  test("an Async with many inner awaits has committed after await act()", async () => {
    const view = render(() => (
      <section>
        <Async load={() => deep(12, "deep")} fallback={() => <i>loading</i>}>
          {(text: string) => <b>{text}</b>}
        </Async>
      </section>
    ));
    expect(view.html()).toBe("<section><i>loading</i></section>");
    await act(async () => {});
    expect(view.html()).toBe("<section><b>deep</b></section>");
  });

  test("works under fake timers", async () => {
    vi.useFakeTimers();
    try {
      const view = render(() => (
        <Async load={() => deep(10, "faked")} fallback={() => <i>loading</i>}>
          {(text: string) => <b>{text}</b>}
        </Async>
      ));
      await within(act(async () => {}));
      expect(view.html()).toBe("<b>faked</b>");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("TK3 fire()", () => {
  test("browser defaults per type: focus / blur / mouseenter don't bubble, focus is composed", () => {
    const view = render(() => (
      <div>
        <input />
      </div>
    ));
    const seen: string[] = [];
    for (const type of ["focus", "blur", "mouseenter", "focusin", "click"]) view.container.addEventListener(type, () => seen.push(type));
    const input = view.find("input");
    let focus: Event | undefined;
    input.addEventListener("focus", (event) => (focus = event));
    fire(input, "focus");
    fire(input, "blur");
    fire(input, "mouseenter");
    fire(input, "focusin");
    fire(input, "click");
    expect(seen).toEqual(["focusin", "click"]);
    expect(focus).toBeInstanceOf(FocusEvent);
    expect([focus!.bubbles, focus!.cancelable, focus!.composed]).toEqual([false, false, true]);
  });

  test("constructors for touch, drag, animation, transition, composition, clipboard events", () => {
    const view = render(() => <div />);
    const target = view.container.firstElementChild!;
    const made: Record<string, string> = {};
    for (const type of ["touchstart", "dragstart", "animationend", "transitionend", "compositionstart", "paste", "pointerdown", "keydown", "wheel"]) {
      target.addEventListener(type, (event) => (made[type] = event.constructor.name));
      fire(target, type);
    }
    expect(made).toEqual({
      touchstart: "TouchEvent",
      dragstart: "DragEvent",
      animationend: "AnimationEvent",
      transitionend: "TransitionEvent",
      compositionstart: "CompositionEvent",
      paste: "ClipboardEvent",
      pointerdown: "PointerEvent",
      keydown: "KeyboardEvent",
      wheel: "WheelEvent",
    });
  });

  test("init overrides the defaults; unknown types are plain non-bubbling Events", () => {
    const view = render(() => (
      <div>
        <span />
      </div>
    ));
    const seen: string[] = [];
    view.container.addEventListener("focus", () => seen.push("focus"));
    view.container.addEventListener("rv-custom", () => seen.push("rv-custom"));
    const span = view.find("span");
    fire(span, "focus", { bubbles: true });
    fire(span, "rv-custom");
    expect(seen).toEqual(["focus"]);
    fire(span, "rv-custom", { bubbles: true });
    expect(seen).toEqual(["focus", "rv-custom"]);
  });
});

describe("TK4 auto-cleanup and ids", () => {
  test("A: renders, leaves the tree mounted, takes ids", () => {
    render(() => <p id="leftover">left</p>);
    expect(document.getElementById("leftover")).not.toBeNull();
    expect([createId(), createId()]).toEqual(["rvc0", "rvc1"]);
  });

  test("B: sees neither A's DOM nor A's id counter", () => {
    expect(document.getElementById("leftover")).toBeNull();
    expect(document.body.children.length).toBe(0);
    expect(createId()).toBe("rvc0");
  });
});

describe("TK5 snapshot serializer", () => {
  test("Show + For snapshots carry no runtime marker comments; the live DOM keeps them", () => {
    const items = signal(["a", "b"]);
    const view = render(() => (
      <ul>
        <Show when={() => true}>
          <For each={items} by={(item: string) => item}>
            {(item: () => string) => <li>{item()}</li>}
          </For>
        </Show>
      </ul>
    ));
    // DOM v1 leaves range comments here, v2 none: add one so the strip runs on either target.
    (view.container as Element).querySelector("ul")!.prepend(document.createComment("rivet:probe"));
    const live = (view.container as Element).innerHTML;
    expect(live).toContain("<!--rivet:probe-->");
    expect(view.container).toMatchInlineSnapshot(`
      <div>
        <ul>
          <li>
            a
          </li>
          <li>
            b
          </li>
        </ul>
      </div>
    `);
    expect((view.container as Element).innerHTML).toBe(live);
  });
});

describe("TK6 jasmine / jest shims", () => {
  test("jasmine.createSpy(name, fn) stubs; and.callThrough() calls fn", () => {
    const original = vi.fn(() => 42);
    const spy = jasmine.createSpy("s", original);
    expect(spy()).toBeUndefined();
    expect(original).not.toHaveBeenCalled();
    spy.and.callThrough();
    expect(spy()).toBe(42);
  });

  test("spyOnProperty stubs the getter until and.callThrough()", () => {
    const object = {
      get value() {
        return "real";
      },
    };
    const spy = spyOnProperty(object, "value");
    expect(object.value).toBeUndefined();
    spy.and.returnValue("stubbed");
    expect(object.value).toBe("stubbed");
    spy.and.callThrough();
    expect(object.value).toBe("real");
    vi.restoreAllMocks();
  });

  test("toHaveClass is jest-dom's whichever shim loaded last: several classes, regexes, { exact }", () => {
    const view = render(() => <b class="rv-A big" />);
    const b = view.find("b");
    expect(b).toHaveClass("rv-A", "big");
    expect(b).toHaveClass(/^rv-/);
    expect(b).not.toHaveClass("rv-A", { exact: true });
    expect(b).not.toHaveClass("rv-A", "missing");
  });

  describe("installPointerEvent", () => {
    const native = globalThis.PointerEvent;
    installPointerEvent();
    test("installs the fake while the suite runs", () => {
      expect(globalThis.PointerEvent).not.toBe(native);
    });
  });

  test("restores the environment's native PointerEvent afterwards", () => {
    expect(typeof globalThis.PointerEvent).toBe("function");
    expect(globalThis.PointerEvent.name).toBe("PointerEvent");
    expect(new PointerEvent("pointerdown", { pointerId: 3 }).pointerId).toBe(3);
  });
});
