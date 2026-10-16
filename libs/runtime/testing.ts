// Component testing helpers for the DOM target (`@rivetjs/runtime/testing`). Nothing in the runtime
// imports this entry. DOM-implementation-agnostic: a default container comes from
// `globalThis.document` (happy-dom, jsdom or a real browser); events use the element's own window.
// Test-runner-agnostic: auto-cleanup hooks into a global `afterEach` when the runner defines one
// (Jest, Vitest `globals`, Mocha); `rivetTest()` from `@rivetjs/testing/vite` registers it for Vitest.
import { _settle } from "@rivetjs/reactivity";
import { mount, type DOMValue } from "@rivetjs/runtime/dom";
import { _resetIds } from "@rivetjs/runtime/id";
import { eventMap } from "./testing-events.ts";

export interface RenderOptions {
  /** Mount target; default a fresh `<div>` appended to `document.body` (removed by `unmount`/`cleanup`). */
  container?: Element | DocumentFragment;
}
export interface RenderResult<C extends Element | DocumentFragment = Element | DocumentFragment> {
  container: C;
  /** Dispose the mounted tree (owners, effects, listeners) and remove an auto-created container. Idempotent. */
  unmount(): void;
  /** Container markup without the runtime's range marker comments. */
  html(): string;
  /** First match of `selector` inside the container; throws when nothing matches. */
  find<E extends Element = HTMLElement>(selector: string): E;
}

const mounted = new Set<() => void>();

/** Mount `factory` (`() => <App/>`) like `mount`; registered for `cleanup()`. */
export function render(factory: () => DOMValue, options: RenderOptions = {}): RenderResult {
  let container = options.container;
  let owned: Element | undefined;
  if (!container) {
    const doc = (globalThis as { document?: Document }).document;
    if (!doc)
      throw Error("render() needs a container or a global document (install happy-dom, jsdom or run in a browser)");
    container = owned = doc.body.appendChild(doc.createElement("div"));
  }
  const dispose = mount(factory, container);
  const unmount = () => {
    if (!mounted.delete(unmount)) return;
    try {
      dispose();
    } finally {
      owned?.remove();
    }
  };
  mounted.add(unmount);
  const root = container;
  return {
    container: root,
    unmount,
    html: () => markup(root),
    find<E extends Element = HTMLElement>(selector: string): E {
      const found = root.querySelector(selector);
      if (!found) throw Error(`find(${JSON.stringify(selector)}): no match in ${markup(root)}`);
      return found as E;
    },
  };
}

/**
 * Unmount everything `render` mounted and restart the `@rivetjs/runtime/id` counter, so ids
 * (`rvc0`, …) do not depend on test order. Every tree is disposed even if one throws. Runs after
 * each test automatically (see the module comment); opt out with `rivetTest({ cleanup: false })`
 * or, for a global `afterEach`, `RIVET_SKIP_AUTO_CLEANUP=1` (then call it from your own `afterEach`).
 */
export function cleanup(): void {
  const failures: unknown[] = [];
  for (const unmount of [...mounted]) {
    try {
      unmount();
    } catch (error) {
      failures.push(error);
    }
  }
  _resetIds();
  if (failures.length) throw failures[0];
}

const runner = globalThis as { afterEach?: (fn: () => void) => void; process?: { env?: Record<string, string | undefined> } };
if (typeof runner.afterEach === "function" && !runner.process?.env?.RIVET_SKIP_AUTO_CLEANUP) runner.afterEach(() => cleanup());

// Captured at import, before a test can install fake timers (`vi.useFakeTimers()` / `jest.useFakeTimers()`
// replace the global and tag it with `.clock`).
const nativeTimeout = globalThis.setTimeout;
const faked = (): boolean => globalThis.setTimeout !== nativeTimeout || "clock" in globalThis.setTimeout;
// One task turn: every queued microtask chain (however many `await`s deep) runs before it. Real
// timers: a zero-delay timeout, so zero-delay timers queued before it fire too. Fake timers: a
// MessageChannel message (fake timers don't intercept it), so the turn never waits for a clock
// nobody advances; advance timers yourself (`vi.advanceTimersByTime`).
const turn = (): Promise<void> =>
  new Promise((resolve) => {
    if (!faked() || typeof MessageChannel !== "function") return void nativeTimeout(resolve, 0);
    const channel = new MessageChannel();
    channel.port1.onmessage = () => (channel.port1.close(), resolve());
    channel.port2.postMessage(0);
  });

/**
 * Let queued work settle: microtasks (`clientEffect`, Async commits of resolved promises, any depth)
 * and two task turns (real timers: zero-delay timeouts queued before the call fire too). Safe under
 * fake timers: it never waits on the faked clock.
 */
export async function flush(): Promise<void> {
  // A trusted mouse click's deferred DOM flush (`_dispatch`) lands first, whatever the task order.
  _settle();
  await turn();
  await turn();
  _settle();
}

type EventCtor = new (type: string, init?: EventInit) => Event;

/**
 * Dispatch a real `type` event on `target`, like `@testing-library/dom`'s `fireEvent`: the
 * constructor and `bubbles` / `cancelable` / `composed` defaults of a browser-dispatched event of
 * that type (MouseEvent for click, FocusEvent that doesn't bubble for focus / blur, TouchEvent,
 * DragEvent, AnimationEvent, CompositionEvent, …; `testing-events.ts`), from the target's window
 * (falling back to `Event` when it lacks the constructor); `init` overrides them. An unknown type
 * (custom events) is a plain `Event` with `init` only, as `new Event(type, init)`. Rivet handlers run
 * batched, so the DOM is updated on return. Returns `dispatchEvent`'s result (false when a handler
 * called `preventDefault`).
 */
export function fire(target: EventTarget, type: string, init: EventInit & Record<string, unknown> = {}): boolean {
  const view = ((target as Node).ownerDocument?.defaultView ??
    (target as Document).defaultView ??
    (target as Window).window ??
    globalThis) as unknown as Record<string, EventCtor | undefined>;
  const known = eventMap.get(type);
  const Ctor = (known && view[known[0]]) || view.Event || Event;
  return target.dispatchEvent(new Ctor(type, known ? { ...known[1], ...init } : init));
}

const markup = (root: Element | DocumentFragment): string => {
  const copy = root.cloneNode(true) as Element | DocumentFragment;
  const doc = root.ownerDocument!;
  const walker = doc.createTreeWalker(copy, 128 /* NodeFilter.SHOW_COMMENT */);
  const comments: Node[] = [];
  while (walker.nextNode()) comments.push(walker.currentNode);
  for (const comment of comments) comment.parentNode!.removeChild(comment);
  if ("innerHTML" in copy) return copy.innerHTML;
  const host = doc.createElement("div");
  host.append(copy);
  return host.innerHTML;
};
