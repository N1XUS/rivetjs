// happy-dom globals for the `ui` DOM-target suites (node environment). Call `installDom()` before importing modules
// under test (dynamic `await import(…)` after the call): the runtime reads `document` / `Node` at import time.
import { Window } from "happy-dom";

const names = [
  "document",
  "Node",
  "Element",
  "HTMLElement",
  "SVGElement",
  "Text",
  "Comment",
  "DocumentFragment",
  "MutationObserver",
  "Event",
  "MouseEvent",
] as const;

let installed: Window | undefined;

export function installDom(url = "http://localhost/"): Window {
  if (installed) return installed;
  const window = new Window({ url });
  const g = globalThis as Record<string, unknown>;
  for (const name of names) g[name] = (window as unknown as Record<string, unknown>)[name];
  g.window = window;
  return (installed = window);
}
