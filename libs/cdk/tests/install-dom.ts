// happy-dom globals for DOM tests in the node environment (the role jsdom plays in the React Aria suites).
// Call `installDom()` before importing modules under test; `dom.reset()` empties the body.
import { Window } from "happy-dom";

const names = [
  "window", "document", "Node", "Element", "HTMLElement", "HTMLDivElement", "HTMLButtonElement", "HTMLInputElement",
  "HTMLTextAreaElement", "HTMLDialogElement", "SVGElement", "ShadowRoot", "Event", "CustomEvent", "KeyboardEvent", "MouseEvent",
  "PointerEvent", "FocusEvent", "TouchEvent", "MutationObserver", "ResizeObserver", "getComputedStyle", "requestAnimationFrame",
  "cancelAnimationFrame", "DOMRect", "NodeFilter",
] as const;

export interface TestDom {
  window: Window;
  reset(): void;
}

let installed: TestDom | undefined;

export function installDom(url = "http://localhost/"): TestDom {
  if (installed) return installed;
  const window = new Window({ url, width: 1024, height: 768 });
  const g = globalThis as Record<string, unknown>;
  for (const name of names) {
    const value = name === "window" ? window : (window as unknown as Record<string, unknown>)[name];
    Object.defineProperty(g, name, { value: typeof value === "function" && name !== "window" && /^[a-z]/.test(name) ? (value as Function).bind(window) : value, configurable: true, writable: true });
  }
  installed = {
    window,
    reset() {
      window.document.body.innerHTML = "";
      window.document.body.removeAttribute("style");
      window.document.documentElement.removeAttribute("style");
    },
  };
  return installed;
}

/** Mock layout of `element` (happy-dom does none): rect, offset / scroll / client sizes. */
export function mockLayout(element: Element, d: { top?: number; left?: number; width?: number; height?: number; scrollTop?: number; scrollLeft?: number; scrollWidth?: number; scrollHeight?: number }): void {
  const width = d.width ?? 0,
    height = d.height ?? 0,
    top = d.top ?? 0,
    left = d.left ?? 0;
  element.getBoundingClientRect = () => ({ top, left, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() {} }) as DOMRect;
  const define = (key: string, value: number) => Object.defineProperty(element, key, { configurable: true, get: () => value, set() {} });
  define("offsetWidth", width);
  define("offsetHeight", height);
  define("clientWidth", width);
  define("clientHeight", height);
  define("scrollWidth", d.scrollWidth ?? width);
  define("scrollHeight", d.scrollHeight ?? height);
  define("scrollTop", d.scrollTop ?? 0);
  define("scrollLeft", d.scrollLeft ?? 0);
}

/** Drop own-property `undefined` values (Jest `toEqual` semantics) for deepStrictEqual. */
export function defined<T>(value: T): T {
  if (Array.isArray(value)) return value.map(defined) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) if (v !== undefined) out[key] = defined(v);
    return out as T;
  }
  return value;
}
