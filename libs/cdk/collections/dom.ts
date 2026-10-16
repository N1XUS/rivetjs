// DOM as collection: the server-rendered items are the collection. Builds a react-aria-components
// style `BaseCollection` from elements carrying `data-key`, so selection managers and keyboard
// delegates work on resumed pages without serializing an item model.
//
// Element → node mapping:
//   key         `data-key` (+ `data-key-type="number"` for numeric keys, see `keyAttrs`)
//   type        `data-type`, else by role: option / menuitem* / treeitem / tab / row / radio /
//               checkbox / link / listitem → "item"; group → "section"; presentation heading
//               (`role=presentation` / `heading` inside a group) → "header"; separator →
//               "separator"; gridcell / cell / rowheader / columnheader → "cell"; else "item"
//   textValue   `data-text-value`, `data-text`, `aria-label`, else trimmed textContent
//   props       isDisabled (`aria-disabled="true"`, `disabled`, `data-disabled`, `data-rv-disabled`: the item's own
//               `isDisabled` prop, kept while `disabledBehavior="selection"` leaves it focusable), href (`href` or
//               `data-href`), target, rel, download, `data-*` passthrough is not attempted
//   parent      nearest ancestor (inside `root`) that is itself a collection node
//   hidden      `[hidden]` subtrees (not popovers) are left out, like RAC's hidden nodes
import { BaseCollection, buildCollection, type CollectionNodeSpec } from "./base.ts";
import type { Key, Node } from "./types.ts";
import { cssEscape } from "../utils/dom.ts";

/** Attributes that encode `key` for `domKey` (numeric keys keep their type). */
export function keyAttrs(key: Key): { "data-key": string; "data-key-type"?: "number" } {
  return typeof key === "number" ? { "data-key": String(key), "data-key-type": "number" } : { "data-key": key };
}

/** The key an element encodes (`keyAttrs`), or null. */
export function domKey(element: Element): Key | null {
  const raw = element.getAttribute("data-key");
  if (raw == null) return null;
  return element.getAttribute("data-key-type") === "number" ? Number(raw) : raw;
}

const ROLE_TYPES: Record<string, string> = {
  option: "item",
  menuitem: "item",
  menuitemcheckbox: "item",
  menuitemradio: "item",
  treeitem: "item",
  tab: "item",
  row: "item",
  radio: "item",
  checkbox: "item",
  link: "item",
  listitem: "item",
  button: "item",
  group: "section",
  presentation: "header",
  heading: "header",
  separator: "separator",
  gridcell: "cell",
  cell: "cell",
  rowheader: "cell",
  columnheader: "column",
};

/** Node type of a collection element. */
export function domNodeType(element: Element): string {
  return element.getAttribute("data-type") ?? ROLE_TYPES[element.getAttribute("role") ?? ""] ?? "item";
}

/** Typeahead text of a collection element. */
export function domTextValue(element: Element): string {
  return (
    element.getAttribute("data-text-value") ?? element.getAttribute("data-text") ?? element.getAttribute("aria-label") ?? element.textContent?.trim() ?? ""
  );
}

const isHidden = (element: Element, root: Element): boolean => {
  for (let el: Element | null = element; el && el !== root; el = el.parentElement) {
    if ((el as HTMLElement).hidden && !el.hasAttribute("popover")) return true;
  }
  return false;
};

export interface DomCollectionOptions {
  /** Selector of collection nodes (default `[data-key]`). */
  selector?: string;
  /**
   * Only nodes owned by this collection: elements whose closest `[data-collection]` is `root`'s
   * (nested collections, e.g. a tag group inside a table cell, are skipped). Default true when
   * `root` has `data-collection`.
   */
  scoped?: boolean;
}

/**
 * Build a frozen `BaseCollection` from the DOM under `root`. Cheap enough to run per handler call
 * (one `querySelectorAll` + one pass); cache per event if a handler needs it repeatedly.
 */
export function domCollection<T = unknown>(root: Element, options: DomCollectionOptions = {}): BaseCollection<T> {
  const selector = options.selector ?? "[data-key]";
  const collectionId = root.getAttribute("data-collection");
  const scoped = options.scoped ?? collectionId != null;
  const elements = [...root.querySelectorAll(selector)].filter(
    (el) => !isHidden(el, root) && (!scoped || el.closest("[data-collection]") === root || el.getAttribute("data-collection") === collectionId),
  );
  const specs = new Map<Element, CollectionNodeSpec<T> & { children: CollectionNodeSpec<T>[] }>();
  const top: CollectionNodeSpec<T>[] = [];
  for (const el of elements) {
    const key = domKey(el);
    if (key == null) continue;
    const disabled =
      el.getAttribute("aria-disabled") === "true" ||
      (el as HTMLButtonElement).disabled === true ||
      el.hasAttribute("data-disabled") ||
      el.hasAttribute("data-rv-disabled");
    const href = el.getAttribute("href") ?? el.getAttribute("data-href");
    const props: Record<string, unknown> = {};
    if (disabled) props.isDisabled = true;
    if (href != null) {
      props.href = href;
      for (const name of ["target", "rel", "download", "hreflang", "ping", "referrerpolicy"]) {
        const v = el.getAttribute(name);
        if (v != null) props[name === "hreflang" ? "hrefLang" : name === "referrerpolicy" ? "referrerPolicy" : name] = v;
      }
    }
    const colSpan = el.getAttribute("aria-colspan") ?? el.getAttribute("colspan");
    if (colSpan != null) props.colSpan = Number(colSpan);
    const spec = { type: domNodeType(el), id: key, textValue: domTextValue(el), props, children: [] as CollectionNodeSpec<T>[] };
    specs.set(el, spec);
    let parent: Element | null = el.parentElement;
    while (parent && parent !== root && !specs.has(parent)) parent = parent.parentElement;
    if (parent && parent !== root) specs.get(parent)!.children.push(spec);
    else top.push(spec);
  }
  return buildCollection<T>(top);
}

/** Element of `key` inside the collection element (react-aria `getItemElement`). */
export function getItemElement(collection: Element | null | undefined, key: Key): HTMLElement | null {
  if (!collection) return null;
  let selector = `[data-key="${cssEscape(String(key))}"]`;
  const id = (collection as HTMLElement).dataset?.collection;
  if (id) selector = `[data-collection="${cssEscape(id)}"]${selector}`;
  return collection.querySelector<HTMLElement>(selector);
}

/** Node of `element` in `collection`, if any. */
export function nodeOf<T>(collection: { getItem(key: Key): Node<T> | null }, element: Element): Node<T> | null {
  const key = domKey(element);
  return key == null ? null : collection.getItem(key);
}
