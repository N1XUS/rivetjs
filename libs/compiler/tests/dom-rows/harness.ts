// happy-dom loader for dom-rows.test.ts. A module hook compiles every `.tsx` / `.jsx` reached from a
// `?rivet-dom-rows` import with the committed compiler (`target: "dom"`) and propagates the marker to
// every non-`node_modules` import, so the fixture, runtime and reactivity form one graph of their own.
// The DOM globals point at one happy-dom window; snapshots are `normalizedHTML` (markers stripped).
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Window } from "happy-dom";
import { compile } from "../../index.ts";
import { normalizedHTML } from "../../../testing/html.ts";

const QUERY = "rivet-dom-rows";
const jsx = /\.[jt]sx$/;
const repo = fileURLToPath(new URL("../../../../", import.meta.url));

let hooked = false;
function installHook(): void {
  if (hooked) return;
  hooked = true;
  registerHooks({
    resolve(specifier, context, next) {
      const result = next(specifier, context);
      const parent = context.parentURL;
      if (!parent?.startsWith("file:") || !result.url.startsWith("file:") || !new URL(parent).searchParams.has(QUERY)) return result;
      const url = new URL(result.url);
      if (url.pathname.includes("/node_modules/") || url.searchParams.has(QUERY)) return result;
      url.searchParams.set(QUERY, "");
      return { ...result, url: url.href };
    },
    load(href, context, next) {
      if (!href.startsWith("file:")) return next(href, context);
      const url = new URL(href);
      if (!url.searchParams.has(QUERY) || !jsx.test(url.pathname)) return next(href, context);
      const filename = fileURLToPath(url);
      const result = compile(readFileSync(filename, "utf8"), { target: "dom", filename });
      if (result.diagnostics.length) throw new SyntaxError("Rivet compile failed: " + result.diagnostics.map((d) => d.message).join("; "));
      return { format: "module", source: result.code, shortCircuit: true };
    },
  });
}

const GLOBALS = [
  "window",
  "document",
  "navigator",
  "location",
  "history",
  "Node",
  "Element",
  "HTMLElement",
  "SVGElement",
  "Text",
  "Comment",
  "DocumentFragment",
  "HTMLInputElement",
  "HTMLButtonElement",
  "HTMLTextAreaElement",
  "HTMLSelectElement",
  "HTMLOptionElement",
  "HTMLAnchorElement",
  "HTMLFormElement",
  "HTMLTemplateElement",
  "HTMLDivElement",
  "HTMLLabelElement",
  "HTMLImageElement",
  "HTMLIFrameElement",
  "HTMLDialogElement",
  "ShadowRoot",
  "Event",
  "CustomEvent",
  "UIEvent",
  "KeyboardEvent",
  "MouseEvent",
  "PointerEvent",
  "FocusEvent",
  "InputEvent",
  "TouchEvent",
  "WheelEvent",
  "MutationObserver",
  "ResizeObserver",
  "IntersectionObserver",
  "getComputedStyle",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "matchMedia",
  "DOMRect",
  "NodeFilter",
  "DOMParser",
  "FormData",
  "localStorage",
  "sessionStorage",
  "getSelection",
  "CSS",
  "Range",
  "scrollTo",
  "innerWidth",
  "innerHeight",
  "devicePixelRatio",
];

/** Point the DOM globals at `window` (`navigator` etc. are getters on Node's global: redefined). */
function install(window: Window): void {
  const g = globalThis as Record<string, unknown>;
  for (const name of GLOBALS) {
    let value = name === "window" ? window : (window as unknown as Record<string, unknown>)[name];
    if (value === undefined) continue;
    if (typeof value === "function" && /^[a-z]/.test(name)) value = (value as (...a: unknown[]) => unknown).bind(window);
    Object.defineProperty(g, name, { value, configurable: true, writable: true });
  }
}

export interface Env {
  window: Window;
  runtime: { mount: (fn: () => unknown, host: Element) => () => void };
}

let env: Promise<Env> | undefined;
/** The shared happy-dom environment (window + compiled runtime graph), created once per process. */
export function environment(): Promise<Env> {
  return (env ??= (async () => {
    installHook();
    const window = new Window({ url: "http://localhost/", width: 1024, height: 768 });
    install(window);
    const runtime = await import(pathToFileURL(repo + "libs/runtime/dom.ts").href + `?${QUERY}`);
    return { window, runtime };
  })());
}

/** Import `file` (absolute path) into the compiled graph. */
export function load(file: string): Promise<Record<string, unknown>> {
  return import(pathToFileURL(file).href + `?${QUERY}`);
}

/** Let effects, microtasks and zero-delay timers run. */
export async function settle(): Promise<void> {
  for (let i = 0; i < 3; i++) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  for (let i = 0; i < 3; i++) await Promise.resolve();
}

export interface Mounted {
  host: Element;
  dispose: (() => void) | null;
  error: string | null;
}

export function mountIn(env: Env, component: (props: Record<string, unknown>) => unknown): Mounted {
  const doc = env.window.document as unknown as Document;
  const host = doc.createElement("div");
  doc.body.append(host);
  try {
    return { host, dispose: env.runtime.mount(() => component({}), host), error: null };
  } catch (e) {
    return { host, dispose: null, error: String((e as { message?: string })?.message ?? e) };
  }
}

/** Normalized content of a mounted host (markers stripped). */
export const snapshot = (m: Mounted): string => normalizedHTML(m.host);
