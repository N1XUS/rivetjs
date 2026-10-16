// DOM as collection: a react-stately `Collection` read from the server-rendered markup at event time,
// so handlers run the ported keyboard delegates and SelectionManager without any serialized item
// model. Plus react-aria's DOMLayoutDelegate and getItemElement (Apache-2.0, © Adobe):
// packages/react-aria/src/selection/{DOMLayoutDelegate,utils}.ts.
//
// LOCAL ADAPTER (aria-grid-tree) until cdk-collections publishes its DOM collection.
//
// Markup contract (rendered by the aria components, or by custom markup through `itemKeyAttrs`):
// - collection root: `data-collection="<id>"` (react-aria uses the same attribute to scope items);
// - every node: `data-key` (+ `data-key-type="number"` when the key is a number) and `data-collection="<id>"`;
// - node type from `data-type`, else from the role: row/option/tab/treeitem → item, gridcell /
//   rowheader → cell, columnheader → column, rowgroup / group → section;
// - hidden nodes (`hidden` or inside `[hidden]`) are not part of the collection (collapsed tree rows);
// - disabled: `aria-disabled="true"` or `data-disabled`; `data-disabled-behavior="selection"`;
// - links: `data-href` (+ `data-target`, `data-rel`, `data-download`), or the node is an `<a href>`;
// - text: `data-text`, else `aria-label`, else trimmed text content;
// - tree level: `aria-level` (1-based) → `level` (0-based); a row's parent is the nearest previous
//   row with a lower level (flat treegrid markup); DOM nesting gives the parent otherwise.
import type { Collection, Key, LayoutDelegate, Node, Rect, Size } from "./collection.ts";
import { domKey, keyAttrs } from "../collections/dom.ts";
import { cssEscape } from "../utils/dom.ts";

const ROLE_TYPES: Record<string, string> = {
  row: "item",
  option: "item",
  tab: "item",
  treeitem: "item",
  gridcell: "cell",
  rowheader: "cell",
  cell: "cell",
  columnheader: "column",
  rowgroup: "section",
  group: "section",
  presentation: "section",
};

/** Attributes identifying a collection node in markup. */
export function itemKeyAttrs(collectionId: string, key: Key): Record<string, string | undefined> {
  return { "data-collection": collectionId, ...keyAttrs(key) };
}

/** Key of a node element (number when rendered with `data-key-type="number"`; `../collections/dom.ts` `domKey`). */
export const elementKey = domKey;

const isHidden = (element: Element, root: Element): boolean => {
  for (let el: Element | null = element; el && el !== root; el = el.parentElement) if ((el as HTMLElement).hidden && !el.hasAttribute("popover")) return true;
  return false;
};

/** Node elements of the collection rooted at `root` (document order, hidden ones skipped). */
export function collectionElements(root: Element): HTMLElement[] {
  const id = root.getAttribute("data-collection");
  const selector = id ? `[data-collection="${cssEscape(id)}"][data-key]` : "[data-key]";
  return [...root.querySelectorAll<HTMLElement>(selector)].filter((el) => el !== root && !isHidden(el, root));
}

/** The node element for `key` inside `root` (react-aria getItemElement). */
export function getItemElement(root: Element | null | undefined, key: Key | null | undefined): HTMLElement | null {
  if (!root || key == null) return null;
  const id = root.getAttribute("data-collection");
  let selector = `[data-key="${cssEscape(String(key))}"]`;
  if (id) selector = `[data-collection="${cssEscape(id)}"]${selector}`;
  return root.querySelector<HTMLElement>(selector);
}

function nodeType(element: Element): string {
  const explicit = element.getAttribute("data-type");
  if (explicit) return explicit;
  const role = element.getAttribute("role") ?? "";
  if (role === "row" && element.closest("thead,[data-type=headergroup]")) return "headerrow";
  return ROLE_TYPES[role] ?? "item";
}

function textOf(element: Element): string {
  return element.getAttribute("data-text") ?? element.getAttribute("aria-label") ?? element.textContent?.trim() ?? "";
}

function propsOf(element: Element): Node["props"] {
  const props: NonNullable<Node["props"]> = {};
  if (element.getAttribute("aria-disabled") === "true" || element.hasAttribute("data-disabled")) props.isDisabled = true;
  const behaviour = element.getAttribute("data-disabled-behavior");
  if (behaviour === "selection" || behaviour === "all") props.disabledBehavior = behaviour;
  const href = element.getAttribute("data-href") ?? (element.localName === "a" ? element.getAttribute("href") : null);
  if (href != null) {
    props.href = href;
    const target = element.getAttribute("data-target") ?? (element.localName === "a" ? element.getAttribute("target") : null);
    if (target) props.target = target;
    const rel = element.getAttribute("data-rel");
    if (rel) props.rel = rel;
    const download = element.getAttribute("data-download");
    if (download != null) props.download = download === "" ? true : download;
  }
  return props;
}

/** A Collection over the DOM nodes of `root`. Built per event; never stored. */
export class DOMCollection implements Collection<Node> {
  readonly root: Element;
  private keyMap = new Map<Key, Node>();
  private order: Key[] = [];
  private children = new Map<Key | null, Node[]>();
  private _size = 0;

  constructor(root: Element) {
    this.root = root;
    const elements = collectionElements(root);
    const byElement = new Map<Element, Node>();
    const lastAtLevel: Node[] = [];
    let previous: Node | null = null;
    for (const element of elements) {
      const key = elementKey(element)!;
      const type = nodeType(element);
      const levelAttr = element.getAttribute("aria-level");
      const level = levelAttr != null ? Number(levelAttr) - 1 : 0;
      // Parent: DOM nesting first (cells in rows, items in sections), then the flat-tree level rule.
      let parent: Node | null = null;
      for (let el = element.parentElement; el && el !== root; el = el.parentElement) {
        const found = byElement.get(el);
        if (found) {
          parent = found;
          break;
        }
      }
      if (!parent && levelAttr != null && level > 0 && type === "item") parent = lastAtLevel[level - 1] ?? null;
      const colSpan = element.getAttribute("aria-colspan");
      const colIndex = element.getAttribute("aria-colindex");
      const node: Node = {
        type,
        key,
        value: null,
        level: levelAttr != null ? level : parent ? parent.level + (parent.type === "section" ? 0 : 1) : 0,
        index: 0,
        hasChildNodes: element.getAttribute("aria-expanded") != null || element.hasAttribute("data-has-children"),
        childNodes: [],
        textValue: "",
        parentKey: parent?.key ?? null,
        props: propsOf(element),
        colSpan: colSpan != null ? Number(colSpan) : null,
        colIndex: colIndex != null ? Number(colIndex) - 1 : null,
        element,
      };
      Object.defineProperty(node, "textValue", { get: () => textOf(element), enumerable: true });
      const siblings = this.children.get(node.parentKey ?? null) ?? [];
      node.index = siblings.length;
      siblings.push(node);
      this.children.set(node.parentKey ?? null, siblings);
      if (parent) {
        parent.hasChildNodes = true;
        (parent.childNodes as Node[]).push(node);
      }
      if (previous) {
        previous.nextKey = key;
        node.prevKey = previous.key;
      }
      previous = node;
      if (type === "item" && levelAttr != null) {
        lastAtLevel[level] = node;
        lastAtLevel.length = level + 1;
      }
      byElement.set(element, node);
      this.keyMap.set(key, node);
      this.order.push(key);
      if (type === "item" || type === "section") this._size++;
    }
  }

  *[Symbol.iterator](): IterableIterator<Node> {
    yield* this.children.get(null) ?? [];
  }
  get size(): number {
    return this._size;
  }
  getKeys(): Iterable<Key> {
    return this.order;
  }
  getItem(key: Key): Node | null {
    return this.keyMap.get(key) ?? this.keyMap.get(typeof key === "number" ? String(key) : Number(key)) ?? null;
  }
  at(idx: number): Node | null {
    const key = this.order[idx];
    return key == null ? null : this.getItem(key);
  }
  getKeyBefore(key: Key): Key | null {
    return this.getItem(key)?.prevKey ?? null;
  }
  getKeyAfter(key: Key): Key | null {
    return this.getItem(key)?.nextKey ?? null;
  }
  getFirstKey(): Key | null {
    return this.order[0] ?? null;
  }
  getLastKey(): Key | null {
    return this.order[this.order.length - 1] ?? null;
  }
  getChildren(key: Key): Iterable<Node> {
    const node = this.getItem(key);
    return node ? (this.children.get(node.key) ?? []) : [];
  }
  getTextValue(key: Key): string {
    return this.getItem(key)?.textValue ?? "";
  }
  /** Element of a node. */
  getElement(key: Key): HTMLElement | null {
    return (this.getItem(key)?.element as HTMLElement | undefined) ?? null;
  }
}

/** react-aria DOMLayoutDelegate: item rects relative to the scroll container. */
export class DOMLayoutDelegate implements LayoutDelegate {
  private root: () => HTMLElement | null;
  constructor(root: HTMLElement | (() => HTMLElement | null)) {
    this.root = typeof root === "function" ? root : () => root;
  }
  getItemRect(key: Key): Rect | null {
    const container = this.root();
    if (!container) return null;
    const item = key != null ? getItemElement(container, key) : null;
    if (!item) return null;
    const containerRect = container.getBoundingClientRect(),
      itemRect = item.getBoundingClientRect();
    return {
      x: itemRect.left - containerRect.left - container.clientLeft + container.scrollLeft,
      y: itemRect.top - containerRect.top - container.clientTop + container.scrollTop,
      width: itemRect.width,
      height: itemRect.height,
    };
  }
  getContentSize(): Size {
    const container = this.root();
    return { width: container?.scrollWidth ?? 0, height: container?.scrollHeight ?? 0 };
  }
  getVisibleRect(): Rect {
    const container = this.root();
    return { x: container?.scrollLeft ?? 0, y: container?.scrollTop ?? 0, width: container?.clientWidth ?? 0, height: container?.clientHeight ?? 0 };
  }
}

/** Whether `element` scrolls (react-aria isScrollable). */
export function isScrollable(element: Element | null, checkForOverflow?: boolean): boolean {
  if (!element || typeof getComputedStyle !== "function") return false;
  const style = getComputedStyle(element);
  let scrollable = /(auto|scroll)/.test(style.overflow + style.overflowX + style.overflowY);
  if (scrollable && checkForOverflow) scrollable = element.scrollHeight !== element.clientHeight || element.scrollWidth !== element.clientWidth;
  return scrollable;
}
