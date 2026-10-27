// Ported from react-spectrum (react-stately: selection/SelectionManager; RAC Menu.tsx GroupSelectionManager),
// Apache-2.0, © Adobe.
//
// Leaf of `collections.ts` (BIG-UI-2 2026-10-27): the selection manager and the DOM collection are built inside menu /
// listbox handlers only (`_adapters/selection.ts`). Out of `collections.ts`, a module every Select / ComboBox / Menu
// page loads for its list state and keyboard delegate, they ship only with their importers.
import { untrack } from "@rivetjs/reactivity";
import { ALL_SELECTED, IN_SELECTION, isSelectionEmpty, selectionOf } from "../selection/keyed.ts";
import { domKey } from "../collections/dom.ts";
import {
  COLLECTION_ATTR,
  ListCollection,
  makeNode,
  compareNodeOrder,
  getChildNodes,
  getFirstItem,
  readSelection,
  writeSelection,
  type Collection,
  type DisabledBehavior,
  type FocusStrategy,
  type Key,
  type LayoutDelegate,
  type MultipleSelectionState,
  type Node,
  type NodeProps,
  type Selection,
  type SelectionBehavior,
  type SelectionMode,
} from "./collections.ts";

const hidden = (el: Element, root: Element): boolean => {
  for (let node: Element | null = el; node && node !== root; node = node.parentElement) if ((node as HTMLElement).hidden) return true;
  return false;
};

/**
 * Collection over the DOM under `root`: items are `[data-key]` elements whose nearest collection root
 * (`[data-collection]`) is `root` and that are not `hidden`; sections are `[data-section]` elements
 * (their `data-key` is the section key). Text: `data-text`, else the text content. Disabled:
 * `aria-disabled="true"` or `data-disabled`. Links: `href` of `<a>` items.
 */
export function domCollection(root: Element): Collection {
  const nodes: Node[] = [];
  const sections = new Map<Element, Node & { childNodes: Node[] }>();
  const owner = (el: Element) => el.parentElement?.closest(`[${COLLECTION_ATTR}]`) ?? null;
  const rootId = root.getAttribute(COLLECTION_ATTR);
  const isOwn = (el: Element) => {
    const o = owner(el);
    return o === root || (rootId != null && o?.getAttribute(COLLECTION_ATTR) === rootId);
  };
  for (const el of root.querySelectorAll("[data-key]")) {
    if (!isOwn(el) || hidden(el, root)) continue;
    const key = domKey(el)!;
    if (el.hasAttribute("data-section")) {
      const section = makeNode("section", key, null, el.getAttribute("aria-label") ?? "", {}, []);
      sections.set(el, section as Node & { childNodes: Node[] });
      section.index = nodes.filter((n) => n.parentKey == null).length;
      nodes.push(section);
      continue;
    }
    const sectionEl = el.parentElement?.closest("[data-section]");
    const parent = sectionEl && root.contains(sectionEl) ? sections.get(sectionEl) : undefined;
    const props: NodeProps = { isDisabled: el.getAttribute("aria-disabled") === "true" || el.hasAttribute("data-disabled") };
    if (el.localName === "a" && el.hasAttribute("href")) {
      props.href = el.getAttribute("href")!;
      for (const name of ["target", "rel", "download"] as const) if (el.hasAttribute(name)) props[name] = el.getAttribute(name)!;
    }
    const text = el.getAttribute("data-text") ?? el.textContent?.trim() ?? "";
    const node = makeNode("item", key, parent?.key ?? null, text, props, []);
    if (parent) {
      node.index = parent.childNodes.length;
      parent.childNodes.push(node);
    } else node.index = nodes.filter((n) => n.parentKey == null).length;
    nodes.push(node);
  }
  return new FlatCollection(nodes);
}

/** Collection over nodes in document order (sections followed by their items). */
class FlatCollection implements Collection {
  private keyMap = new Map<Key, Node>();
  private order: Key[] = [];
  readonly size: number;
  private nodes: Node[];
  constructor(nodes: Node[]) {
    this.nodes = nodes;
    for (const node of nodes) {
      this.keyMap.set(node.key, node);
      this.order.push(node.key);
    }
    for (let i = 0; i < nodes.length; i++) {
      nodes[i]!.prevKey = i > 0 ? nodes[i - 1]!.key : undefined;
      nodes[i]!.nextKey = i < nodes.length - 1 ? nodes[i + 1]!.key : undefined;
    }
    this.size = nodes.filter((n) => n.type === "item" || n.type === "section").length;
  }
  *[Symbol.iterator](): IterableIterator<Node> {
    for (const node of this.nodes) if (node.parentKey == null) yield node;
  }
  getKeys(): Iterable<Key> {
    return this.order;
  }
  getItem(key: Key): Node | null {
    return this.keyMap.get(key) ?? this.keyMap.get(String(key)) ?? null;
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
    return this.getItem(key)?.childNodes ?? [];
  }
}

// ---------------------------------------------------------------------------------------------
// SelectionManager (react-stately selection/SelectionManager)
// ---------------------------------------------------------------------------------------------

interface SelectionManagerOptions {
  allowsCellSelection?: boolean;
  layoutDelegate?: LayoutDelegate;
  fullCollection?: Collection;
}

export class SelectionManager {
  collection: Collection;
  private state: MultipleSelectionState;
  private allowsCellSelection: boolean;
  private layoutDelegate: LayoutDelegate | null;
  private fullCollection: Collection | null;

  constructor(collection: Collection, state: MultipleSelectionState, options?: SelectionManagerOptions) {
    this.collection = collection;
    this.state = state;
    this.allowsCellSelection = options?.allowsCellSelection ?? false;
    this.layoutDelegate = options?.layoutDelegate || null;
    this.fullCollection = options?.fullCollection || null;
  }

  get selectionMode(): SelectionMode {
    return this.state.selectionMode;
  }
  get disallowEmptySelection(): boolean {
    return this.state.disallowEmptySelection;
  }
  get selectionBehavior(): SelectionBehavior {
    return this.state.selectionBehavior();
  }
  setSelectionBehavior(selectionBehavior: SelectionBehavior): void {
    this.state.selectionBehavior.set(selectionBehavior);
  }
  get isFocused(): boolean {
    return this.state.isFocused();
  }
  setFocused(isFocused: boolean): void {
    this.state.isFocused.set(isFocused);
  }
  get focusedKey(): Key | null {
    return this.state.focusedKey();
  }
  get childFocusStrategy(): FocusStrategy | null {
    return this.state.childFocusStrategy();
  }
  setFocusedKey(key: Key | null, childFocusStrategy: FocusStrategy = "first"): void {
    if (key == null || this.collection.getItem(key)) {
      this.state.focusedKey.set(key == null ? null : (this.collection.getItem(key)?.key ?? key));
      this.state.childFocusStrategy.set(childFocusStrategy);
    }
  }
  private get raw(): Selection {
    return readSelection(this.state);
  }
  get selectedKeys(): Set<Key> {
    const raw = this.raw;
    return raw === "all" ? new Set(this.getSelectAllKeys()) : raw;
  }
  get rawSelection(): Selection {
    return this.raw;
  }
  isSelected(key: Key): boolean {
    if (this.state.selectionMode === "none") return false;
    const mapped = this.getKey(key);
    if (mapped == null) return false;
    // Keyed reads (`selection/keyed.ts`): bindings re-run only when this key's membership / emptiness changes.
    const selected = selectionOf(this.state, mapped);
    return selected === ALL_SELECTED ? this.canSelectItem(mapped) : selected === IN_SELECTION;
  }
  get isEmpty(): boolean {
    return isSelectionEmpty(this.state);
  }
  get isSelectAll(): boolean {
    if (this.isEmpty) return false;
    const raw = this.raw;
    if (raw === "all") return true;
    return this.getSelectAllKeys().every((k) => raw.has(k));
  }
  get firstSelectedKey(): Key | null {
    let first: Node | null = null;
    const raw = this.raw;
    if (raw === "all") return this.getSelectAllKeys()[0] ?? null;
    for (const key of raw) {
      const item = this.collection.getItem(key);
      if (!first || (item && compareNodeOrder(this.collection, item, first) < 0)) first = item;
    }
    return first?.key ?? null;
  }
  get lastSelectedKey(): Key | null {
    let last: Node | null = null;
    const raw = this.raw;
    if (raw === "all") return this.getSelectAllKeys().at(-1) ?? null;
    for (const key of raw) {
      const item = this.collection.getItem(key);
      if (!last || (item && compareNodeOrder(this.collection, item, last) > 0)) last = item;
    }
    return last?.key ?? null;
  }
  get disabledKeys(): Set<Key> {
    return this.state.disabledKeys;
  }
  get disabledBehavior(): DisabledBehavior {
    return this.state.disabledBehavior;
  }

  extendSelection(toKey: Key): void {
    if (this.selectionMode === "none") return;
    if (this.selectionMode === "single") return this.replaceSelection(toKey);
    const mappedToKey = this.getKey(toKey);
    if (mappedToKey == null) return;
    let selection: Set<Key>, anchor: Key, current: Key;
    if (this.raw === "all") {
      selection = new Set([mappedToKey]);
      anchor = current = mappedToKey;
    } else {
      const selectedKeys = this.raw as Set<Key>;
      const anchorKey = untrack(this.state.anchorKey) ?? mappedToKey;
      selection = new Set(selectedKeys);
      for (const key of this.getKeyRange(anchorKey, untrack(this.state.currentKey) ?? mappedToKey)) selection.delete(key);
      for (const key of this.getKeyRange(mappedToKey, anchorKey)) if (this.canSelectItem(key)) selection.add(key);
      anchor = anchorKey;
      current = mappedToKey;
    }
    writeSelection(this.state, selection, anchor, current);
  }

  private getKeyRange(from: Key, to: Key): Key[] {
    const fromItem = this.collection.getItem(from),
      toItem = this.collection.getItem(to);
    if (fromItem && toItem) {
      return compareNodeOrder(this.collection, fromItem, toItem) <= 0
        ? this.getKeyRangeInternal(fromItem.key, toItem.key)
        : this.getKeyRangeInternal(toItem.key, fromItem.key);
    }
    return [];
  }

  private getKeyRangeInternal(from: Key, to: Key): Key[] {
    if (this.layoutDelegate?.getKeyRange) return this.layoutDelegate.getKeyRange(from, to);
    const keys: Key[] = [];
    let key: Key | null = from;
    while (key != null) {
      const item = this.collection.getItem(key);
      if (item && (item.type === "item" || ((item.type as string) === "cell" && this.allowsCellSelection))) keys.push(key);
      if (key === to) return keys;
      key = this.collection.getKeyAfter(key);
    }
    return [];
  }

  private getKey(key: Key): Key | null {
    let item = this.collection.getItem(key);
    if (!item) return key;
    while (item && item.type !== "item" && item.parentKey != null) item = this.collection.getItem(item.parentKey);
    if (!item || item.type !== "item") return null;
    return item.key;
  }

  toggleSelection(key: Key): void {
    if (this.selectionMode === "none") return;
    if (this.selectionMode === "single" && !this.isSelected(key)) return this.replaceSelection(key);
    const mappedKey = this.getKey(key);
    if (mappedKey == null) return;
    const raw = this.raw;
    const keys = new Set(raw === "all" ? this.getSelectAllKeys() : raw);
    let anchor: Key | null | undefined, current: Key | null | undefined;
    if (keys.has(mappedKey)) keys.delete(mappedKey);
    else if (this.canSelectItem(mappedKey)) {
      keys.add(mappedKey);
      anchor = current = mappedKey;
    }
    if (this.disallowEmptySelection && keys.size === 0) return;
    writeSelection(this.state, keys, anchor, current);
  }

  replaceSelection(key: Key): void {
    if (this.selectionMode === "none") return;
    const mappedKey = this.getKey(key);
    if (mappedKey == null) return;
    if (this.canSelectItem(mappedKey)) writeSelection(this.state, new Set([mappedKey]), mappedKey, mappedKey);
    else writeSelection(this.state, new Set(), null, null);
  }

  setSelectedKeys(keys: Iterable<Key>): void {
    if (this.selectionMode === "none") return;
    const selection = new Set<Key>();
    for (const key of keys) {
      const mappedKey = this.getKey(key);
      if (mappedKey != null) {
        selection.add(mappedKey);
        if (this.selectionMode === "single") break;
      }
    }
    writeSelection(this.state, selection);
  }

  private getSelectAllKeys(): Key[] {
    const collection = this.fullCollection ?? this.collection;
    const keys: Key[] = [];
    const addKeys = (key: Key | null) => {
      while (key != null) {
        if (this.canSelectItemIn(key, collection)) {
          const item = collection.getItem(key);
          if (item?.type === "item") keys.push(key);
          if (item?.hasChildNodes && (this.allowsCellSelection || item.type !== "item")) addKeys(getFirstItem(getChildNodes(item, collection))?.key ?? null);
        }
        key = collection.getKeyAfter(key);
      }
    };
    // Flat collections list section children after the section: walk top-level only.
    const first = collection.getFirstKey();
    if (collection instanceof ListCollection) addKeys(first);
    else for (const key of collection.getKeys()) if (collection.getItem(key)?.type === "item" && this.canSelectItemIn(key, collection)) keys.push(key);
    return keys;
  }

  selectAll(): void {
    if (!this.isSelectAll && this.selectionMode === "multiple") writeSelection(this.state, "all");
  }

  clearSelection(): void {
    const raw = this.raw;
    if (!this.disallowEmptySelection && (raw === "all" || raw.size > 0)) writeSelection(this.state, new Set(), null, null);
  }

  toggleSelectAll(): void {
    if (this.isSelectAll) this.clearSelection();
    else this.selectAll();
  }

  select(key: Key, e?: { pointerType?: string }): void {
    if (this.selectionMode === "none") return;
    if (this.selectionMode === "single") {
      if (this.isSelected(key) && !this.disallowEmptySelection) this.toggleSelection(key);
      else this.replaceSelection(key);
    } else if (this.selectionBehavior === "toggle" || (e && (e.pointerType === "touch" || e.pointerType === "virtual"))) {
      // Touch / virtual (VO) toggle: no modifier keys to multi-select otherwise.
      this.toggleSelection(key);
    } else this.replaceSelection(key);
  }

  isSelectionEqual(selection: Set<Key>): boolean {
    if (selection === this.raw) return true;
    const selectedKeys = this.selectedKeys;
    if (selection.size !== selectedKeys.size) return false;
    for (const key of selection) if (!selectedKeys.has(key)) return false;
    for (const key of selectedKeys) if (!selection.has(key)) return false;
    return true;
  }

  canSelectItem(key: Key): boolean {
    return this.canSelectItemIn(key, this.collection);
  }

  private canSelectItemIn(key: Key, collection: Collection): boolean {
    if (this.state.selectionMode === "none" || this.state.disabledKeys.has(key)) return false;
    const item = collection.getItem(key);
    if (!item || item.props?.isDisabled || ((item.type as string) === "cell" && !this.allowsCellSelection)) return false;
    return true;
  }

  isDisabled(key: Key): boolean {
    const item = this.collection.getItem(key);
    return (
      this.state.disabledBehavior === "all" && (this.state.disabledKeys.has(key) || !!item?.props?.isDisabled) && item?.props?.disabledBehavior !== "selection"
    );
  }

  isLink(key: Key): boolean {
    return !!this.collection.getItem(key)?.props?.href;
  }

  getItemProps(key: Key): NodeProps | undefined {
    return this.collection.getItem(key)?.props;
  }

  withCollection(collection: Collection): SelectionManager {
    return new SelectionManager(collection, this.state, {
      allowsCellSelection: this.allowsCellSelection,
      ...(this.layoutDelegate ? { layoutDelegate: this.layoutDelegate } : {}),
      fullCollection: this.fullCollection ?? this.collection,
    });
  }
}

/**
 * RAC `GroupSelectionManager` (Menu.tsx): a section with its own selection (`MenuSection
 * selectionMode`) — local selection state, focus forwarded to the parent collection's manager.
 */
export class GroupSelectionManager extends SelectionManager {
  private parent: SelectionManager;
  constructor(parent: SelectionManager, state: MultipleSelectionState) {
    super(parent.collection, state);
    this.parent = parent;
  }
  override get focusedKey(): Key | null {
    return this.parent.focusedKey;
  }
  override get isFocused(): boolean {
    return this.parent.isFocused;
  }
  override setFocusedKey(key: Key | null, childFocusStrategy?: FocusStrategy): void {
    this.parent.setFocusedKey(key, childFocusStrategy);
  }
  override setFocused(isFocused: boolean): void {
    this.parent.setFocused(isFocused);
  }
  override get childFocusStrategy(): FocusStrategy | null {
    return this.parent.childFocusStrategy;
  }
}
