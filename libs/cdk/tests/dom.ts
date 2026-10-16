// happy-dom window as the global DOM for node-environment suites of browser-side ports.
import { Window } from "happy-dom";

export const window = new Window({ url: "http://localhost/" });
const g = globalThis as Record<string, unknown>;
for (const key of ["document", "Node", "Element", "HTMLElement", "HTMLInputElement", "HTMLButtonElement", "HTMLTextAreaElement", "HTMLSelectElement", "ShadowRoot", "MutationObserver", "KeyboardEvent", "MouseEvent", "FocusEvent", "PointerEvent", "TouchEvent", "Event", "getComputedStyle", "requestAnimationFrame", "navigator"]) {
  if (key === "navigator" && "navigator" in globalThis) continue;
  g[key] = (window as unknown as Record<string, unknown>)[key];
}
g.window = window;
export const document = window.document as unknown as Document;

const define = (event: Event, key: string, value: unknown) => Object.defineProperty(event, key, { get: () => value, configurable: true });
let touchIds = 0;

/** @angular/cdk/testing createMouseEvent: detail 1, buttons 1 (not a screen-reader fake). */
export function createMouseEvent(type: string, init: MouseEventInit = {}): MouseEvent {
  const event = new (window.MouseEvent as unknown as typeof MouseEvent)(type, { bubbles: true, cancelable: true, composed: true, detail: 1, buttons: 1, ...init });
  define(event, "detail", init.detail ?? 1);
  define(event, "buttons", init.buttons ?? 1);
  return event;
}

/** @angular/cdk/testing createTouchEvent: a UIEvent carrying one touch with a unique identifier. */
export function createTouchEvent(type: string): TouchEvent {
  const event = new (window.Event as unknown as typeof Event)(type, { bubbles: true, cancelable: true, composed: true });
  const touch = { pageX: 0, pageY: 0, clientX: 0, clientY: 0, identifier: touchIds++ };
  define(event, "touches", [touch]);
  define(event, "targetTouches", [touch]);
  define(event, "changedTouches", [touch]);
  return event as TouchEvent;
}

/** @angular/cdk/testing createKeyboardEvent: keyCode + key + modifiers. */
export function createKeyboardEvent(type: string, keyCode = 0, key = "", modifiers: { control?: boolean; alt?: boolean; shift?: boolean; meta?: boolean } = {}): KeyboardEvent {
  const event = new (window.KeyboardEvent as unknown as typeof KeyboardEvent)(type, { bubbles: true, cancelable: true, composed: true, key, ctrlKey: !!modifiers.control, altKey: !!modifiers.alt, shiftKey: !!modifiers.shift, metaKey: !!modifiers.meta });
  define(event, "keyCode", keyCode);
  return event;
}

export function dispatch<E extends Event>(target: EventTarget, event: E): E {
  target.dispatchEvent(event);
  return event;
}
