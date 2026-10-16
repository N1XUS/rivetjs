// happy-dom globals for the overlay suites (popover, tooltip, modal, drawer, toast, …): `installDom()` plus the window members
// the cdk overlay layer reads as globals (`NodeFilter` for aria-hide-outside, keyboard / focus / pointer events, layout + frame
// APIs, element constructors used in `instanceof` checks). Call before importing modules under test.
import { installDom } from "./install-dom.ts";

const EXTRA = [
  "NodeFilter",
  "KeyboardEvent",
  "FocusEvent",
  "PointerEvent",
  "InputEvent",
  "CustomEvent",
  "TouchEvent",
  "AnimationEvent",
  "TransitionEvent",
  "getComputedStyle",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "ResizeObserver",
  "IntersectionObserver",
  "HTMLInputElement",
  "HTMLTextAreaElement",
  "HTMLSelectElement",
  "HTMLButtonElement",
  "HTMLAnchorElement",
  "HTMLFormElement",
  "HTMLDialogElement",
  "HTMLIFrameElement",
  "ShadowRoot",
  "Range",
  "matchMedia",
  "visualViewport",
  "navigator",
  "location",
  "history",
  "innerWidth",
  "innerHeight",
  "scrollTo",
  "DOMRect",
] as const;

export function installOverlayDom(): ReturnType<typeof installDom> {
  const window = installDom();
  const g = globalThis as Record<string, unknown>;
  const w = window as unknown as Record<string, unknown>;
  for (const name of EXTRA) {
    if (g[name] !== undefined) continue;
    const value = w[name];
    if (value === undefined) continue;
    try {
      g[name] = typeof value === "function" && /^[a-z]/.test(name) ? (value as (...a: unknown[]) => unknown).bind(window) : value;
    } catch {
      Object.defineProperty(g, name, { value, configurable: true, writable: true });
    }
  }
  return window;
}
