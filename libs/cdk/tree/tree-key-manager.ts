// Ported from Angular CDK a11y (src/cdk/a11y/key-manager/tree-key-manager.ts,
// tree-key-manager-strategy.ts), MIT, © Google LLC.
//
// TreeKeyManager: keyboard navigation of a tree — Up / Down move, Right / Left expand / collapse or
// move to the first child / parent (swapped in RTL), Home / End, Enter / Space activate, `*` expands
// all siblings of the active item, debounced typeahead, Tab returns early, `change` stream.
// Rivet:
// - `QueryList` / `Observable<T[]>` items → an array, an accessor / signal (QueryList semantics:
//   tracked with an effect, later runs = `changes`), or a subscribable (`{ subscribe(fn) }`).
// - `getChildren()` may return an array or a subscribable; RxJS `take(1)` → first emission only.
// - `TREE_KEY_MANAGER` InjectionToken → `TREE_KEY_MANAGER` default factory constant (no DI).
// - Instances are browser-side objects: create them in a handler or client effect.
import { effect, type Disposer } from "@rivetjs/reactivity";
import { Subject, Typeahead, type Subscription } from "../a11y/key-manager.ts";

/** Anything with an RxJS-style `subscribe` (Rivet `Subject`, an RxJS Observable…). */
export interface Subscribable<T> {
  subscribe(next: (value: T) => void): Subscription | { unsubscribe(): void } | (() => void) | void;
}

/** Represents an item within a tree that can be passed to a TreeKeyManager. */
export interface TreeKeyManagerItem {
  /** Whether the item is disabled. */
  isDisabled?: (() => boolean) | boolean;
  /** The user-facing label for this item. */
  getLabel?(): string;
  /** Perform the main action (i.e. selection) for this item. */
  activate(): void;
  /** Retrieves the parent for this item. This is `null` if there is no parent. */
  getParent(): TreeKeyManagerItem | null;
  /** Retrieves the children for this item. */
  getChildren(): TreeKeyManagerItem[] | Subscribable<TreeKeyManagerItem[]>;
  /** Determines if the item is currently expanded. */
  isExpanded: (() => boolean) | boolean;
  /** Collapses the item, hiding its children. */
  collapse(): void;
  /** Expands the item, showing its children. */
  expand(): void;
  /** Focuses the item. This should provide some indication to the user that this item is focused. */
  focus(): void;
  /** Unfocus the item. This should remove the focus state. */
  unfocus(): void;
  /** Sets the item to be focusable without actually focusing it. */
  makeFocusable?(): void;
}

/** Configuration for the TreeKeyManager. */
export interface TreeKeyManagerOptions<T extends TreeKeyManagerItem> {
  /** If true, the key manager calls `activate` in addition to `focus` when an item is focused. */
  shouldActivationFollowFocus?: boolean;
  /** The direction in which the tree items are laid out horizontally (which key expands / collapses). */
  horizontalOrientation?: "rtl" | "ltr";
  /** If provided, navigation "skips" over items that pass the given predicate. */
  skipPredicate?: (item: T) => boolean;
  /** Determines how the key manager decides whether two items are equivalent. */
  trackBy?: (treeItem: T) => unknown;
  /** Enables typeahead; a number is the debounce interval, `true` the default (200 ms). */
  typeAheadDebounceInterval?: true | number;
}

export interface TreeKeyManagerStrategy<T extends TreeKeyManagerItem> {
  /** Stream that emits any time the focused item changes. */
  readonly change: Subject<T | null>;
  /** Cleans up the key manager. */
  destroy(): void;
  /** Handles a keyboard event on the tree. */
  onKeydown(event: KeyboardEvent): void;
  /** Index of the currently active item. */
  getActiveItemIndex(): number | null;
  /** The currently active item. */
  getActiveItem(): T | null;
  /** Focus the provided item (by index, or by `trackBy` equality). */
  focusItem(index: number, options?: { emitChangeEvent?: boolean }): void;
  focusItem(item: T, options?: { emitChangeEvent?: boolean }): void;
  focusItem(itemOrIndex: number | T, options?: { emitChangeEvent?: boolean }): void;
}

export type TreeKeyManagerItems<T> = T[] | readonly T[] | (() => T[] | readonly T[]) | Subscribable<T[]>;

export type TreeKeyManagerFactory<T extends TreeKeyManagerItem> = (
  items: TreeKeyManagerItems<T>,
  options: TreeKeyManagerOptions<T>,
) => TreeKeyManagerStrategy<T>;

const isSubscribable = <T>(value: unknown): value is Subscribable<T> =>
  value != null && typeof value === "object" && typeof (value as Subscribable<T>).subscribe === "function";

/** First emission of an array or subscribable (RxJS `coerceObservable(x).pipe(take(1))`). */
function takeFirst<T>(value: T[] | Subscribable<T[]>, next: (items: T[]) => void): void {
  if (!isSubscribable<T[]>(value)) return next(value);
  let done = false;
  let sync = true;
  let subscription: ReturnType<Subscribable<T[]>["subscribe"]> = undefined;
  const unsubscribe = () => {
    if (typeof subscription === "function") subscription();
    else subscription?.unsubscribe();
  };
  subscription = value.subscribe((items) => {
    if (done) return;
    done = true;
    if (!sync) unsubscribe();
    next(items);
  });
  sync = false;
  if (done) unsubscribe();
}

/**
 * Manages keyboard events for trees: given a list of tree items, sets the active item, focus,
 * handles expansion and typeahead when keyboard events occur.
 */
export class TreeKeyManager<T extends TreeKeyManagerItem> implements TreeKeyManagerStrategy<T> {
  /** The index of the currently active (focused) item. */
  private _activeItemIndex = -1;
  /** The currently active (focused) item. */
  private _activeItem: T | null = null;
  /** Whether or not we activate the item when it's focused. */
  private _shouldActivationFollowFocus = false;
  /** In `rtl` mode, the behavior of Left and Right arrow are switched. */
  private _horizontalOrientation: "ltr" | "rtl" = "ltr";
  /**
   * Skips nothing by default, to keep tree items focusable when disabled (ARIA guidelines:
   * focusability of disabled controls).
   */
  private _skipPredicateFn = (_item: T): boolean => false;
  /** Function to determine equivalent items. */
  private _trackByFn: (item: T) => unknown = (item: T) => item;
  /** Synchronous cache of the items to manage. */
  private _items: T[] = [];
  private _typeahead?: Typeahead<T>;
  private _typeaheadSubscription: { unsubscribe(): void } = { unsubscribe() {} };
  private _hasInitialFocused = false;
  private _effect: Disposer | undefined;
  private _itemsSubscription: ReturnType<Subscribable<T[]>["subscribe"]> = undefined;

  private _initializeFocus(): void {
    if (this._hasInitialFocused || this._items.length === 0) return;

    let activeIndex = 0;
    for (let i = 0; i < this._items.length; i++) {
      if (!this._skipPredicateFn(this._items[i]!) && !this._isItemDisabled(this._items[i]!)) {
        activeIndex = i;
        break;
      }
    }

    const activeItem = this._items[activeIndex]!;

    // `makeFocusable`: the item only becomes focusable, it doesn't capture focus (#29628).
    if (activeItem.makeFocusable) {
      this._activeItem?.unfocus();
      this._activeItemIndex = activeIndex;
      this._activeItem = activeItem;
      this._typeahead?.setCurrentSelectedItemIndex(activeIndex);
      activeItem.makeFocusable();
    } else {
      // Backwards compatibility for items that don't implement `makeFocusable`.
      this.focusItem(activeIndex);
    }

    this._hasInitialFocused = true;
  }

  /**
   * @param items Items to manage: an array, an accessor / signal of one, or a subscribable.
   * @param config By default 'ltr', skips nothing, only calls `focus` (not `activate`) on focus;
   * `typeAheadDebounceInterval: true` uses a 200 ms interval.
   */
  constructor(items: TreeKeyManagerItems<T>, config: TreeKeyManagerOptions<T>) {
    // Items may be an array or a live source because the consumer may not have a QueryList of them.
    if (typeof items === "function") {
      // QueryList: the current items now, `_itemsChanged` on every later change.
      let first = true;
      this._effect = effect(() => {
        const next = [...items()];
        if (first) {
          first = false;
          this._items = next;
        } else this._itemsChanged(next);
      });
    } else if (isSubscribable<T[]>(items)) {
      this._itemsSubscription = items.subscribe((newItems) => this._itemsChanged(newItems));
    } else {
      this._items = items as T[];
      this._initializeFocus();
    }

    if (typeof config.shouldActivationFollowFocus === "boolean") this._shouldActivationFollowFocus = config.shouldActivationFollowFocus;
    if (config.horizontalOrientation) this._horizontalOrientation = config.horizontalOrientation;
    if (config.skipPredicate) this._skipPredicateFn = config.skipPredicate;
    if (config.trackBy) this._trackByFn = config.trackBy;
    if (typeof config.typeAheadDebounceInterval !== "undefined") this._setTypeAhead(config.typeAheadDebounceInterval);
  }

  /** Stream that emits any time the focused item changes. */
  readonly change = new Subject<T | null>();

  /** Cleans up the key manager. */
  destroy(): void {
    this._typeaheadSubscription.unsubscribe();
    this._typeahead?.destroy();
    this._effect?.();
    if (typeof this._itemsSubscription === "function") this._itemsSubscription();
    else this._itemsSubscription?.unsubscribe();
    this.change.complete();
  }

  /** Handles a keyboard event on the tree. */
  onKeydown(event: KeyboardEvent): void {
    const key = event.key;

    switch (key) {
      case "Tab":
        // Return early, so Tab actually tabs out of the tree.
        return;

      case "ArrowDown":
        this._focusNextItem();
        break;

      case "ArrowUp":
        this._focusPreviousItem();
        break;

      case "ArrowRight":
        if (this._horizontalOrientation === "rtl") this._collapseCurrentItem();
        else this._expandCurrentItem();
        break;

      case "ArrowLeft":
        if (this._horizontalOrientation === "rtl") this._expandCurrentItem();
        else this._collapseCurrentItem();
        break;

      case "Home":
        this._focusFirstItem();
        break;

      case "End":
        this._focusLastItem();
        break;

      case "Enter":
      case " ":
        this._activateCurrentItem();
        break;

      default:
        if (event.key === "*") {
          this._expandAllItemsAtCurrentItemLevel();
          break;
        }

        this._typeahead?.handleKey(event);
        // Don't prevent the default action of non-navigational keys or reset the typed letters.
        return;
    }

    // Reset the typeahead since the user has used a navigational key.
    this._typeahead?.reset();
    event.preventDefault();
  }

  /** Index of the currently active item. */
  getActiveItemIndex(): number | null {
    return this._activeItemIndex;
  }

  /** The currently active item. */
  getActiveItem(): T | null {
    return this._activeItem;
  }

  /** Called when the list of items has changed. */
  private _itemsChanged(newItems: T[]): void {
    if (this._hasInitialFocused && this._activeItem && !newItems.includes(this._activeItem)) {
      this._activeItem = null;
      this._hasInitialFocused = false;
    }

    this._items = newItems;
    this._typeahead?.setItems(this._items);
    this._updateActiveItemIndex(this._items);
    this._initializeFocus();
  }

  /** Focus the first available item. */
  private _focusFirstItem(): void {
    this.focusItem(this._findNextAvailableItemIndex(-1));
  }

  /** Focus the last available item. */
  private _focusLastItem(): void {
    this.focusItem(this._findPreviousAvailableItemIndex(this._items.length));
  }

  /** Focus the next available item. */
  private _focusNextItem(): void {
    this.focusItem(this._findNextAvailableItemIndex(this._activeItemIndex));
  }

  /** Focus the previous available item. */
  private _focusPreviousItem(): void {
    this.focusItem(this._findPreviousAvailableItemIndex(this._activeItemIndex));
  }

  /** Focus the provided item by index, or by `trackBy` equality. */
  focusItem(index: number, options?: { emitChangeEvent?: boolean }): void;
  focusItem(item: T, options?: { emitChangeEvent?: boolean }): void;
  focusItem(itemOrIndex: number | T, options?: { emitChangeEvent?: boolean }): void;
  focusItem(itemOrIndex: number | T, options: { emitChangeEvent?: boolean } = {}): void {
    options.emitChangeEvent ??= true;

    const index = typeof itemOrIndex === "number" ? itemOrIndex : this._items.findIndex((item) => this._trackByFn(item) === this._trackByFn(itemOrIndex));
    if (index < 0 || index >= this._items.length) return;
    const activeItem = this._items[index]!;

    // If we're just setting the same item, don't re-call activate or focus.
    if (this._activeItem !== null && this._trackByFn(activeItem) === this._trackByFn(this._activeItem)) return;

    const previousActiveItem = this._activeItem;
    this._activeItem = activeItem ?? null;
    this._activeItemIndex = index;
    this._typeahead?.setCurrentSelectedItemIndex(index);

    this._activeItem?.focus();
    previousActiveItem?.unfocus();

    if (options.emitChangeEvent) this.change.next(this._activeItem);

    if (this._shouldActivationFollowFocus) this._activateCurrentItem();
  }

  private _updateActiveItemIndex(newItems: T[]): void {
    const activeItem = this._activeItem;
    if (!activeItem) return;

    const newIndex = newItems.findIndex((item) => this._trackByFn(item) === this._trackByFn(activeItem));

    if (newIndex > -1 && newIndex !== this._activeItemIndex) {
      this._activeItemIndex = newIndex;
      this._typeahead?.setCurrentSelectedItemIndex(newIndex);
    }
  }

  private _setTypeAhead(debounceInterval: number | boolean): void {
    this._typeahead = new Typeahead(this._items, {
      debounceInterval: typeof debounceInterval === "number" ? debounceInterval : undefined,
      skipPredicate: (item) => this._skipPredicateFn(item),
    });

    this._typeaheadSubscription = this._typeahead.selectedItem.subscribe((item) => {
      this.focusItem(item);
    });
  }

  private _findNextAvailableItemIndex(startingIndex: number): number {
    for (let i = startingIndex + 1; i < this._items.length; i++) {
      if (!this._skipPredicateFn(this._items[i]!)) return i;
    }
    return startingIndex;
  }

  private _findPreviousAvailableItemIndex(startingIndex: number): number {
    for (let i = startingIndex - 1; i >= 0; i--) {
      if (!this._skipPredicateFn(this._items[i]!)) return i;
    }
    return startingIndex;
  }

  /** If the item is expanded, collapse it; otherwise focus the parent. */
  private _collapseCurrentItem(): void {
    if (!this._activeItem) return;

    if (this._isCurrentItemExpanded()) {
      this._activeItem.collapse();
    } else {
      const parent = this._activeItem.getParent();
      if (!parent || this._skipPredicateFn(parent as T)) return;
      this.focusItem(parent as T);
    }
  }

  /** If the item is collapsed, expand it; otherwise focus the first child. */
  private _expandCurrentItem(): void {
    if (!this._activeItem) return;

    if (!this._isCurrentItemExpanded()) {
      this._activeItem.expand();
    } else {
      takeFirst(this._activeItem.getChildren(), (children) => {
        const firstChild = children.find((child) => !this._skipPredicateFn(child as T));
        if (!firstChild) return;
        this.focusItem(firstChild as T);
      });
    }
  }

  private _isCurrentItemExpanded(): boolean {
    if (!this._activeItem) return false;
    return typeof this._activeItem.isExpanded === "boolean" ? this._activeItem.isExpanded : this._activeItem.isExpanded();
  }

  private _isItemDisabled(item: TreeKeyManagerItem): boolean | undefined {
    return typeof item.isDisabled === "boolean" ? item.isDisabled : item.isDisabled?.();
  }

  /** For all items that are the same level as the current item, expand those items. */
  private _expandAllItemsAtCurrentItemLevel(): void {
    if (!this._activeItem) return;

    const parent = this._activeItem.getParent();
    const itemsToExpand: TreeKeyManagerItem[] | Subscribable<TreeKeyManagerItem[]> = !parent
      ? this._items.filter((item) => item.getParent() === null)
      : parent.getChildren();

    takeFirst(itemsToExpand, (items) => {
      for (const item of items) item.expand();
    });
  }

  private _activateCurrentItem(): void {
    this._activeItem?.activate();
  }
}

/** The default key manager factory (Angular's `TREE_KEY_MANAGER` injection token default). */
export const TREE_KEY_MANAGER: TreeKeyManagerFactory<any> = (items, options) => new TreeKeyManager(items, options);
