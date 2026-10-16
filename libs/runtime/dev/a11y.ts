// Development-only accessibility checks (`development` condition through dev/dom.ts; production
// resolution never reaches this file, so it costs 0 B there). Started by the first client render in a
// browser (`mount`, a component, an event binding), or at load on resumed dev pages
// (`@rivetjs/runtime/dev/a11y`, imported by the router's entry.dev.tsx): audits the document once, then
// every added subtree and changed attribute, after the synchronous render that produced it (a microtask
// later). Each rule warns once per element (`Rivet a11y [rule]: …`) and is reported to the devtools
// hook as `a11y { rule, element, message }`. Opt out: `<html data-rivet-a11y="off">`.
// Compile-time versions of these rules for static markup are queued (docs/guides/aria.md); these catch what
// only exists at run time: spread / dynamic attributes, ids, rendered text.
import { DEV } from "./on.ts";
import { DOCS, locateElement } from "./where.ts";

export type A11yRule = "img-alt" | "click-events" | "tabindex-positive" | "label-control" | "accessible-name" | "aria-idref" | "duplicate-id";

const reported = new WeakMap<Element, Set<A11yRule>>();
/** Event types bound on an element through `_on` / `_listen` (client-rendered handlers). */
const events = new WeakMap<Element, Set<string>>();

/** Record a client-bound handler (dev `_on` / `_listen`). */
export function noteEvent(element: Element, type: string): void {
  let set = events.get(element);
  if (!set) events.set(element, (set = new Set()));
  set.add(type);
  start();
}

/** Short element description: `<div id="x" class="a b">`. */
function describe(element: Element): string {
  const id = element.getAttribute("id"),
    cls = element.getAttribute("class");
  return "<" + element.localName + (id ? ` id="${id}"` : "") + (cls ? ` class="${cls}"` : "") + ">";
}

function warn(element: Element, rule: A11yRule, message: string): void {
  let set = reported.get(element);
  if (!set) reported.set(element, (set = new Set()));
  if (set.has(rule)) return;
  set.add(rule);
  const text = "Rivet a11y [" + rule + "]: " + message;
  // The console line names where the element comes from (component chain, or server HTML + CSS path) and the docs.
  const where = locateElement(element);
  console.warn(text + where + "\n  docs: " + DOCS.a11y);
  DEV.emit("a11y", { rule, element, message: text, where: where.trim() });
}

const NATIVE_INTERACTIVE = new Set(["button", "input", "select", "textarea", "summary", "option", "label", "details", "dialog", "video", "audio"]);
const WIDGET_ROLES =
  /^(button|link|checkbox|switch|radio|menuitem|menuitemcheckbox|menuitemradio|option|tab|treeitem|gridcell|row|slider|spinbutton|textbox|combobox|searchbox|scrollbar)$/;
const COMPOSITE_ROLES = /^(listbox|grid|treegrid|tree|menu|menubar|tablist|radiogroup|toolbar)$/;
const NAMED_ROLES = /^(button|link|menuitem|tab|checkbox|switch|radio|option)$/;
const IDREFS = ["aria-labelledby", "aria-describedby", "aria-controls", "aria-owns", "aria-activedescendant", "aria-errormessage", "aria-details"];
const LABELABLE = "input:not([type=hidden]),select,textarea,button,meter,output,progress";

const interactive = (element: Element): boolean =>
  NATIVE_INTERACTIVE.has(element.localName) ||
  (element.localName === "a" && element.hasAttribute("href")) ||
  (element.localName === "area" && element.hasAttribute("href")) ||
  element.getAttribute("contenteditable") === "true";

/** Approximate accessible name (enough to tell "none" from "some"). */
function hasName(element: Element): boolean {
  if (element.getAttribute("aria-label")?.trim() || element.getAttribute("title")?.trim()) return true;
  const ids = element.getAttribute("aria-labelledby");
  if (ids && ids.split(/\s+/).some((id) => element.ownerDocument.getElementById(id)?.textContent?.trim())) return true;
  if (element.textContent?.trim()) return true;
  for (const img of element.querySelectorAll("img[alt], [role=img][aria-label], svg title"))
    if ((img.getAttribute("alt") ?? img.getAttribute("aria-label") ?? img.textContent)?.trim()) return true;
  const id = element.getAttribute("id");
  if (id && element.ownerDocument.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent?.trim()) return true;
  // A labelable control nested in a <label> is named by the label's own text (`<label><input role="switch" /> Dark</label>`);
  // text inside the control itself or inside other controls of the label (`<option>`s of a `<select>`) does not count.
  const label = element.matches(LABELABLE) ? element.parentElement?.closest("label") : null;
  if (label && labelText(label, element)) return true;
  return false;
}

/** Text of `label` outside `control` and outside any other labelable control in it. */
function labelText(label: Element, control: Element): boolean {
  const walker = label.ownerDocument.createTreeWalker(label, 4 /* NodeFilter.SHOW_TEXT */);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (!node.nodeValue?.trim() || !parent || control.contains(node) || parent.closest(LABELABLE)) continue;
    return true;
  }
  return false;
}

/** Run every rule on one element. */
export function checkElement(element: Element): void {
  if (element.closest("[aria-hidden=true], [inert], template")) return;
  const name = element.localName,
    role = element.getAttribute("role"),
    doc = element.ownerDocument;
  if (name === "img" && !element.hasAttribute("alt") && role !== "presentation" && role !== "none")
    warn(element, "img-alt", `${describe(element)} has no alt attribute — describe the image (alt="…"), or mark it decorative with alt="".`);

  const tabindex = element.getAttribute("tabindex");
  if (tabindex !== null && Number(tabindex) > 0)
    warn(element, "tabindex-positive", `tabIndex={${tabindex}} on ${describe(element)} — a positive tabindex reorders the page's tab sequence; use 0 (or -1 for programmatic focus) and DOM order.`);

  const bound = events.get(element);
  // A composite widget (listbox, grid, menu, …) handles its items' clicks by delegation; its keyboard model is the
  // composite pattern (roving tabindex / aria-activedescendant on the items or a combobox input).
  if (bound?.has("click") && !interactive(element) && !(role && COMPOSITE_ROLES.test(role)) && !(role && WIDGET_ROLES.test(role) && tabindex !== null && (bound.has("keydown") || bound.has("keyup")))) {
    const missing = [!(role && WIDGET_ROLES.test(role)) && 'role="button"', tabindex === null && "tabIndex={0}", !(bound.has("keydown") || bound.has("keyup")) && "an onKeyDown handler for Enter / Space"].filter(Boolean);
    warn(element, "click-events", `onClick on ${describe(element)}, which is not focusable or keyboard-operable — use a <button> (or <a href>), or add ${missing.join(", ")}.`);
  }

  if (name === "label") {
    const target = element.getAttribute("for");
    const control = target !== null ? doc.getElementById(target) : element.querySelector(LABELABLE),
      id = element.getAttribute("id");
    // A label without `for` that names a control or group through `aria-labelledby` is associated (React Aria drops `for`
    // on group labels: Slider, RadioGroup, date fields).
    const labelling = target === null && !control && !!id && doc.querySelector(`[aria-labelledby~="${CSS.escape(id)}"]`) !== null;
    if (!labelling && (!control || (target !== null && !control.matches(LABELABLE))))
      warn(
        element,
        "label-control",
        target !== null
          ? `<label for="${target}"> points at ${control ? describe(control) + ", which is not a form control" : 'no element with id "' + target + '"'} — set for to the control's id (createId() keeps ids unique).`
          : `${describe(element)} is not associated with a control — nest the input inside it, or set for="<control id>".`,
      );
  }

  if ((name === "button" || (name === "a" && element.hasAttribute("href")) || (role && NAMED_ROLES.test(role))) && !hasName(element))
    warn(element, "accessible-name", `${describe(element)}${role ? ` (role="${role}")` : ""} has no accessible name — add text content, aria-label or aria-labelledby.`);

  if (IDREFS.some((attribute) => danglingIds(element, attribute).length)) queueIdrefs(element);

  const id = element.getAttribute("id");
  if (id) {
    const first = doc.getElementById(id);
    if (first && first !== element)
      warn(element, "duplicate-id", `duplicate id "${id}" (${describe(first)} and ${describe(element)}) — ids must be unique in the document; generate them with createId().`);
  }
}

function danglingIds(element: Element, attribute: string): string[] {
  const value = element.getAttribute(attribute);
  return value ? value.split(/\s+/).filter((id) => id && !element.ownerDocument.getElementById(id)) : [];
}
/**
 * IDREFs are judged once the document settles (no audited mutation for `SETTLE` ms, at most `SETTLE_MAX` ms after the
 * first candidate): a part that may not render keeps its id for the first render and the owner drops it once the part
 * proved absent (React Aria `useSlotId`, cdk `createSlotId`: a microtask after mount), and an owner may point at
 * content that mounts a moment later (a combobox's `aria-controls` while the opening popover's chunk loads) — only an
 * IDREF still dangling then is a bug.
 */
const SETTLE = 100,
  SETTLE_MAX = 2000;
const idrefs = new Set<Element>();
let idrefTimer: ReturnType<typeof setTimeout> | null = null,
  idrefsSince = 0;
function queueIdrefs(element: Element): void {
  idrefs.add(element);
  settleIdrefs();
}
/** (Re)arm the IDREF verdict: called for every candidate and every audited mutation batch. */
function settleIdrefs(): void {
  if (idrefs.size === 0) return;
  const now = Date.now();
  if (idrefTimer === null) idrefsSince = now;
  else if (now - idrefsSince < SETTLE_MAX) clearTimeout(idrefTimer);
  else return;
  idrefTimer = setTimeout(checkIdrefs, SETTLE);
}
function checkIdrefs(): void {
  idrefTimer = null;
  const list = [...idrefs];
  idrefs.clear();
  for (const element of list) {
    if (!element.isConnected || element.closest("[aria-hidden=true], [inert], template")) continue;
    for (const attribute of IDREFS) {
      const missing = danglingIds(element, attribute);
      if (missing.length)
        warn(
          element,
          "aria-idref",
          `${attribute}="${element.getAttribute(attribute)}" on ${describe(element)} points at no element with id ${missing.map((id) => `"${id}"`).join(", ")} — render the referenced element, or fix the id.`,
        );
    }
  }
}

/** Check `root` and its descendant elements. */
export function checkTree(root: Element): void {
  checkElement(root);
  for (const element of root.querySelectorAll("*")) checkElement(element);
}

let started = false;
const trees = new Set<Element>(),
  elements = new Set<Element>();
let queued = false;
function flush(): void {
  queued = false;
  const roots = [...trees],
    changed = [...elements];
  trees.clear();
  elements.clear();
  for (const root of roots) if (root.isConnected) checkTree(root);
  for (const element of changed) if (element.isConnected) checkElement(element);
  settleIdrefs();
}
function queue(set: Set<Element>, element: Element): void {
  set.add(element);
  if (!queued) {
    queued = true;
    queueMicrotask(flush);
  }
}

/** Start the document audit (idempotent; no-op without a DOM or when opted out). */
export function start(): void {
  if (started || typeof document === "undefined" || typeof MutationObserver === "undefined") return;
  started = true;
  const root = document.documentElement;
  if (!root || root.getAttribute("data-rivet-a11y") === "off") return;
  new MutationObserver((records) => {
    if (root.getAttribute("data-rivet-a11y") === "off") return;
    for (const record of records) {
      if (record.type === "attributes") queue(elements, record.target as Element);
      else for (const node of record.addedNodes) if (node.nodeType === 1) queue(trees, node as Element);
    }
  }).observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["alt", "tabindex", "role", "for", "id", "href", "aria-label", "aria-labelledby", ...IDREFS] });
  queue(trees, root);
}
