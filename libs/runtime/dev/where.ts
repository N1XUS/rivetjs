// Development only (imported by dev/dom.ts and dev/a11y.ts; production resolution never reaches it): where a dev
// warning comes from. Names the component chain that rendered something — `<Input> (libs/cdk/input.tsx:40:17) ←
// <Page> (src/routes/index.tsx:5:17)` — from the component owners dev/dom.ts records and the declaration sites the
// Vite plugin stamps into dev client modules (`globalThis[Symbol.for("rivet.sources")]`, `@rivetjs/compiler` hot.ts
// `sourceStamps`), and locates server-rendered elements that no client component owns (CSS path, page, resume site).
// Also installs `globalThis[Symbol.for("rivet.locate")]` (browser): other packages' dev warnings (cdk, reactivity)
// call it for the current component chain; the Vite plugin installs the server twin (an app stack frame).
import { getOwner } from "@rivetjs/reactivity";
import { _debug } from "@rivetjs/reactivity/debug";

/** Docs pages dev warnings link to (same placeholder origin as the RV code registry). */
export const DOCS = {
  a11y: "https://rivetjs.dev/guides/tooling/dev-server-and-hot-reload#accessibility-warnings",
  warnings: "https://rivetjs.dev/guides/tooling/dev-server-and-hot-reload#warnings-and-errors",
};

type Fn = (...args: never[]) => unknown;
type Source = readonly [name: string, at: string];

/** Component owner → component function (dev/dom.ts `component2`). */
export const components = new WeakMap<object, Fn>();
/** Structural built-ins (`For`, `Show`, `Provider`, …) left out of component chains. */
export const hidden = new WeakSet<Fn>();
// First owner that inserted a node (the innermost component: a child's root is checked before its parent inserts it).
const nodes = new WeakMap<Node, unknown>();

const sources = (): WeakMap<object, Source> | undefined => (globalThis as { [key: symbol]: WeakMap<object, Source> | undefined })[Symbol.for("rivet.sources")];

/** Display name of a component function: its declared name (dev stamps see through hot wrappers), else `fn.name`. */
export function nameOf(fn: Fn): string {
  return sources()?.get(fn)?.[0] ?? (fn.name || "anonymous component");
}
/** `<Name>` plus ` (file:line:col)` when the declaration site is known. */
export function label(fn: Fn): string {
  const at = sources()?.get(fn)?.[1];
  return "<" + nameOf(fn) + ">" + (at ? " (" + at + ")" : "");
}

/** Component chain of `owner`, innermost first, at most `max` components: `<A> (…) ← <B> (…)`; "" outside components. */
export function chain(owner: unknown, max = 4): string {
  const out: string[] = [];
  let more = false;
  for (let view = _debug(owner); view; view = view.parent()) {
    const fn = components.get(view.ref);
    if (!fn || hidden.has(fn)) continue;
    if (out.length === max) {
      more = true;
      break;
    }
    out.push(label(fn));
  }
  return out.join(" ← ") + (more ? " ← …" : "");
}

/** Record the owner that rendered `node` (first one wins). Fragments: their children (insertion empties a fragment). */
export function noteNode(node: Node, owner: unknown): void {
  if (owner == null) return;
  if (node.nodeType === 11) {
    for (const child of Array.from(node.childNodes)) if (!nodes.has(child)) nodes.set(child, owner);
  } else if (!nodes.has(node)) nodes.set(node, owner);
}

/** CSS path of `element` from `<body>` (ids stop the walk): `main > article.post > label.switch > input`. */
export function cssPath(element: Element): string {
  const parts: string[] = [];
  for (let at: Element | null = element; at && at.localName !== "body" && at.localName !== "html"; at = at.parentElement) {
    const id = at.getAttribute("id");
    if (id) {
      parts.unshift(at.localName + "#" + (typeof CSS !== "undefined" && CSS.escape ? CSS.escape(id) : id));
      break;
    }
    const cls = (at.getAttribute("class") ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
    parts.unshift(at.localName + cls.map((name) => "." + name).join(""));
  }
  return parts.join(" > ");
}

/**
 * Where `element` came from, as indented lines (each starting with `\n  `): the component chain that rendered it when a
 * client component did, else "server-rendered HTML" with the page path and the nearest resume site (`data-r`); always the
 * element's CSS path (paste into DevTools: `document.querySelector("…")`).
 */
export function locateElement(element: Element): string {
  let owner: unknown;
  for (let at: Node | null = element; at && owner === undefined; at = at.parentNode) owner = nodes.get(at);
  const rendered = owner === undefined ? "" : chain(owner);
  const site = element.closest("[data-r]")?.getAttribute("data-r");
  const page = typeof location !== "undefined" ? location.pathname : "";
  return (
    (rendered
      ? "\n  in " + rendered
      : "\n  in server-rendered HTML" + (page ? " of " + page : "") + (site ? ` (resume site data-r="${site}")` : "") + " — no client component rendered it") +
    "\n  element: " +
    cssPath(element)
  );
}

// Browser dev: other packages' dev warnings ask for the current component chain (cdk `devWarn`, reactivity dev.ts).
if (typeof document !== "undefined")
  (globalThis as { [key: symbol]: unknown })[Symbol.for("rivet.locate")] = (owner: unknown = getOwner()): string => {
    const text = chain(owner);
    return text ? "in " + text : "";
  };
