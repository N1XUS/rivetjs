// ListKeyManager / ActiveDescendantKeyManager / FocusKeyManager / Typeahead: keyboard navigation of a
// list of items — arrows (vertical, horizontal LTR/RTL), wrap, skip predicate (disabled by default),
// Home/End, PageUp/PageDown, allowed modifier keys, debounced typeahead, Tab-out, change stream.
// Ported from Angular CDK a11y key-manager (angular/components), MIT, © Google LLC.
//
// Rivet: `Subject`s are minimal emitters with the same `subscribe` / `next` / `complete` shape (no
// RxJS); items may be an array or an accessor / signal (the original's `Signal<T[]>`; an accessor is
// tracked with an effect, no injector). Instances are browser-side objects: create them in a handler or
// client effect. Resumed widgets keep the active index in a signal and restore it with
// `updateActiveItem(index())` before `onKeydown`, then write it back from `change`.
import { effect, type Disposer } from "@rivetjs/reactivity";
import type { FocusOrigin } from "./focus-monitor.ts";

// Key codes (Angular `@angular/cdk/keycodes`).
const TAB = 9,
  PAGE_UP = 33,
  PAGE_DOWN = 34,
  END = 35,
  HOME = 36,
  LEFT_ARROW = 37,
  UP_ARROW = 38,
  RIGHT_ARROW = 39,
  DOWN_ARROW = 40,
  ZERO = 48,
  NINE = 57,
  A = 65,
  Z = 90;

type ModifierKey = "altKey" | "shiftKey" | "ctrlKey" | "metaKey";

/** Whether `event` has any of `modifiers` (any modifier when none given). */
export function hasModifierKey(event: KeyboardEvent | MouseEvent, ...modifiers: ModifierKey[]): boolean {
  if (modifiers.length) return modifiers.some((modifier) => event[modifier]);
  return event.altKey || event.shiftKey || event.ctrlKey || event.metaKey;
}

export interface Subscription {
  unsubscribe(): void;
}

/** Observer callbacks (RxJS shape). */
export interface Observer<T> {
  next?: (value: T) => void;
  complete?: () => void;
}

/** Minimal `Subject`: `next`, `subscribe` (function or `{ next, complete }`), `complete`. */
export class Subject<T = void> {
  private observers = new Set<Observer<T>>();
  private closed = false;
  next(value: T): void {
    if (this.closed) return;
    for (const observer of [...this.observers]) observer.next?.(value);
  }
  subscribe(observer: ((value: T) => void) | Observer<T>): Subscription {
    const entry: Observer<T> = typeof observer === "function" ? { next: observer } : observer;
    if (this.closed) {
      entry.complete?.();
      return { unsubscribe() {} };
    }
    this.observers.add(entry);
    return { unsubscribe: () => this.observers.delete(entry) };
  }
  complete(): void {
    if (this.closed) return;
    this.closed = true;
    const observers = [...this.observers];
    this.observers.clear();
    for (const observer of observers) observer.complete?.();
  }
  get observed(): boolean {
    return this.observers.size > 0;
  }
}

const DEFAULT_TYPEAHEAD_DEBOUNCE_INTERVAL_MS = 200;

export interface TypeaheadItem {
  getLabel?(): string;
}

export interface TypeaheadConfig<T> {
  debounceInterval?: number;
  skipPredicate?: (item: T) => boolean | undefined;
}

/** Selects items from typed characters (debounced), as in `role="listbox"` / `role="tree"`. */
export class Typeahead<T extends TypeaheadItem> {
  private _items: readonly T[] = [];
  private _selectedItemIndex = -1;
  /** Letters pressed so far. */
  private _pressedLetters: string[] = [];
  private _skipPredicateFn?: (item: T) => boolean | undefined;
  private _timer: ReturnType<typeof setTimeout> | undefined;
  private readonly _interval: number;
  private readonly _selectedItem = new Subject<T>();
  readonly selectedItem: Subject<T> = this._selectedItem;

  constructor(initialItems: readonly T[], config?: TypeaheadConfig<T>) {
    this._interval = typeof config?.debounceInterval === "number" ? config.debounceInterval : DEFAULT_TYPEAHEAD_DEBOUNCE_INTERVAL_MS;
    if (config?.skipPredicate) this._skipPredicateFn = config.skipPredicate;
    if (initialItems.length && initialItems.some((item) => typeof item.getLabel !== "function"))
      throw new Error("KeyManager items in typeahead mode must implement the `getLabel` method.");
    this.setItems(initialItems);
  }

  destroy(): void {
    this._pressedLetters = [];
    clearTimeout(this._timer);
    this._selectedItem.complete();
  }

  setCurrentSelectedItemIndex(index: number): void {
    this._selectedItemIndex = index;
  }

  setItems(items: readonly T[]): void {
    this._items = items;
  }

  handleKey(event: KeyboardEvent): void {
    const keyCode = event.keyCode;
    // `event.key` maps to the user's keyboard language; else alphanumerics from the keyCode.
    if (event.key && event.key.length === 1) this._letter(event.key.toLocaleUpperCase());
    else if ((keyCode >= A && keyCode <= Z) || (keyCode >= ZERO && keyCode <= NINE)) this._letter(String.fromCharCode(keyCode));
  }

  /** Whether the user is typing (letters buffered). */
  isTyping(): boolean {
    return this._pressedLetters.length > 0;
  }

  /** Forget the typed letters. */
  reset(): void {
    this._pressedLetters = [];
  }

  private _letter(letter: string): void {
    this._pressedLetters.push(letter);
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this._search(), this._interval);
  }

  private _search(): void {
    if (this._pressedLetters.length === 0) return;
    const inputString = this._pressedLetters.join("").toLocaleUpperCase();
    // Start after the current item.
    for (let i = 1; i < this._items.length + 1; i++) {
      const index = (this._selectedItemIndex + i) % this._items.length;
      const item = this._items[index]!;
      if (!this._skipPredicateFn?.(item) && item.getLabel?.().toLocaleUpperCase().trim().indexOf(inputString) === 0) {
        this._selectedItem.next(item);
        break;
      }
    }
    this._pressedLetters = [];
  }
}

/** Items a ListKeyManager can manage. */
export interface ListKeyManagerOption {
  disabled?: boolean;
  getLabel?(): string;
}

/** Modifier keys handled by the ListKeyManager. */
export type ListKeyManagerModifierKey = "altKey" | "ctrlKey" | "metaKey" | "shiftKey";

type Items<T> = T[] | readonly T[] | (() => T[] | readonly T[]);

/** Keyboard navigation of a list: sets the active item on arrow / Home / End / Page / typeahead keys. */
export class ListKeyManager<T extends ListKeyManagerOption> {
  private _activeItemIndex = -1;
  private _activeItem: T | null = null;
  private _wrap = false;
  private _typeaheadSubscription: Subscription = { unsubscribe() {} };
  private _vertical = true;
  private _horizontal: "ltr" | "rtl" | null = null;
  private _allowedModifierKeys: ListKeyManagerModifierKey[] = [];
  private _homeAndEnd = false;
  private _pageUpAndDown = { enabled: false, delta: 10 };
  private _effect: Disposer | undefined;
  private _typeahead?: Typeahead<T>;
  /** Skip predicate: disabled items by default. */
  private _skipPredicateFn = (item: T): boolean | undefined => item.disabled;

  /** Emits when Tab is pressed (focus leaves the list). */
  readonly tabOut = new Subject<void>();
  /** Emits the new active index whenever the active item changes. */
  readonly change = new Subject<number>();

  private _items: Items<T>;

  constructor(_items: Items<T>) {
    this._items = _items;
    if (typeof _items === "function") this._effect = effect(() => this._itemsChanged(_items()));
  }

  /** Predicate for items to skip. */
  skipPredicate(predicate: (item: T) => boolean): this {
    this._skipPredicateFn = predicate;
    return this;
  }

  /** Wrap from one end of the list to the other. */
  withWrap(shouldWrap = true): this {
    this._wrap = shouldWrap;
    return this;
  }

  /** Up / Down arrows move (default on). */
  withVerticalOrientation(enabled = true): this {
    this._vertical = enabled;
    return this;
  }

  /** Left / Right arrows move in `direction`; `null` disables horizontal movement. */
  withHorizontalOrientation(direction: "ltr" | "rtl" | null): this {
    this._horizontal = direction;
    return this;
  }

  /** Modifier keys that may be held while navigating (default none). */
  withAllowedModifierKeys(keys: ListKeyManagerModifierKey[]): this {
    this._allowedModifierKeys = keys;
    return this;
  }

  /** Typeahead: typed characters activate the next item whose label starts with them. */
  withTypeAhead(debounceInterval = 200): this {
    const items = this._getItemsArray();
    if (items.length > 0 && items.some((item) => typeof item.getLabel !== "function"))
      throw Error("ListKeyManager items in typeahead mode must implement the `getLabel` method.");
    this._typeaheadSubscription.unsubscribe();
    this._typeahead = new Typeahead(items, {
      debounceInterval: typeof debounceInterval === "number" ? debounceInterval : undefined,
      skipPredicate: (item) => this._skipPredicateFn(item),
    });
    this._typeaheadSubscription = this._typeahead.selectedItem.subscribe((item) => this.setActiveItem(item));
    return this;
  }

  /** Cancel the current typeahead sequence. */
  cancelTypeahead(): this {
    this._typeahead?.reset();
    return this;
  }

  /** Home / End activate the first / last item. */
  withHomeAndEnd(enabled = true): this {
    this._homeAndEnd = enabled;
    return this;
  }

  /** PageUp / PageDown move by `delta` items (clamped to the ends). */
  withPageUpDown(enabled = true, delta = 10): this {
    this._pageUpAndDown = { enabled, delta };
    return this;
  }

  /** Set the active item (index or item); emits `change` when it changed. */
  setActiveItem(item: T | number): void {
    const previous = this._activeItem;
    this.updateActiveItem(item);
    if (this._activeItem !== previous) this.change.next(this._activeItemIndex);
  }

  /** Set the active item from a keydown; prevents the default action of handled keys. */
  onKeydown(event: KeyboardEvent): void {
    const keyCode = event.keyCode;
    const modifiers: ListKeyManagerModifierKey[] = ["altKey", "ctrlKey", "metaKey", "shiftKey"];
    const isModifierAllowed = modifiers.every((modifier) => !event[modifier] || this._allowedModifierKeys.indexOf(modifier) > -1);
    switch (keyCode) {
      case TAB:
        this.tabOut.next();
        return;
      case DOWN_ARROW:
        if (this._vertical && isModifierAllowed) {
          this.setNextItemActive();
          break;
        }
        return;
      case UP_ARROW:
        if (this._vertical && isModifierAllowed) {
          this.setPreviousItemActive();
          break;
        }
        return;
      case RIGHT_ARROW:
        if (this._horizontal && isModifierAllowed) {
          this._horizontal === "rtl" ? this.setPreviousItemActive() : this.setNextItemActive();
          break;
        }
        return;
      case LEFT_ARROW:
        if (this._horizontal && isModifierAllowed) {
          this._horizontal === "rtl" ? this.setNextItemActive() : this.setPreviousItemActive();
          break;
        }
        return;
      case HOME:
        if (this._homeAndEnd && isModifierAllowed) {
          this.setFirstItemActive();
          break;
        }
        return;
      case END:
        if (this._homeAndEnd && isModifierAllowed) {
          this.setLastItemActive();
          break;
        }
        return;
      case PAGE_UP:
        if (this._pageUpAndDown.enabled && isModifierAllowed) {
          const target = this._activeItemIndex - this._pageUpAndDown.delta;
          this._setActiveItemByIndex(target > 0 ? target : 0, 1);
          break;
        }
        return;
      case PAGE_DOWN:
        if (this._pageUpAndDown.enabled && isModifierAllowed) {
          const target = this._activeItemIndex + this._pageUpAndDown.delta;
          const length = this._getItemsArray().length;
          this._setActiveItemByIndex(target < length ? target : length - 1, -1);
          break;
        }
        return;
      default:
        if (isModifierAllowed || hasModifierKey(event, "shiftKey")) this._typeahead?.handleKey(event);
        // Non-navigation keys keep their default action.
        return;
    }
    this._typeahead?.reset();
    event.preventDefault();
  }

  /** Index of the active item (-1: none). */
  get activeItemIndex(): number | null {
    return this._activeItemIndex;
  }

  /** The active item. */
  get activeItem(): T | null {
    return this._activeItem;
  }

  /** Whether the user is typing (typeahead). */
  isTyping(): boolean {
    return !!this._typeahead && this._typeahead.isTyping();
  }

  setFirstItemActive(): void {
    this._setActiveItemByIndex(0, 1);
  }

  setLastItemActive(): void {
    this._setActiveItemByIndex(this._getItemsArray().length - 1, -1);
  }

  setNextItemActive(): void {
    this._activeItemIndex < 0 ? this.setFirstItemActive() : this._setActiveItemByDelta(1);
  }

  setPreviousItemActive(): void {
    this._activeItemIndex < 0 && this._wrap ? this.setLastItemActive() : this._setActiveItemByDelta(-1);
  }

  /** Set the active item without emitting `change` or other effects. */
  updateActiveItem(item: T | number): void {
    const items = this._getItemsArray();
    const index = typeof item === "number" ? item : items.indexOf(item);
    const active = items[index];
    this._activeItem = active == null ? null : active;
    this._activeItemIndex = index;
    this._typeahead?.setCurrentSelectedItemIndex(index);
  }

  /** Clean up subscriptions and timers. */
  destroy(): void {
    this._typeaheadSubscription.unsubscribe();
    this._effect?.();
    this._typeahead?.destroy();
    this.tabOut.complete();
    this.change.complete();
  }

  private _setActiveItemByDelta(delta: -1 | 1): void {
    this._wrap ? this._setActiveInWrapMode(delta) : this._setActiveInDefaultMode(delta);
  }

  private _setActiveInWrapMode(delta: -1 | 1): void {
    const items = this._getItemsArray();
    for (let i = 1; i <= items.length; i++) {
      const index = (this._activeItemIndex + delta * i + items.length) % items.length;
      if (!this._skipPredicateFn(items[index]!)) {
        this.setActiveItem(index);
        return;
      }
    }
  }

  private _setActiveInDefaultMode(delta: -1 | 1): void {
    this._setActiveItemByIndex(this._activeItemIndex + delta, delta);
  }

  private _setActiveItemByIndex(index: number, fallbackDelta: -1 | 1): void {
    const items = this._getItemsArray();
    if (!items[index]) return;
    while (this._skipPredicateFn(items[index]!)) {
      index += fallbackDelta;
      if (!items[index]) return;
    }
    this.setActiveItem(index);
  }

  private _getItemsArray(): T[] | readonly T[] {
    return typeof this._items === "function" ? this._items() : this._items;
  }

  private _itemsChanged(newItems: T[] | readonly T[]): void {
    this._typeahead?.setItems(newItems);
    const active = this._activeItem;
    if (active) {
      const newIndex = newItems.indexOf(active);
      if (newIndex > -1 && newIndex !== this._activeItemIndex) {
        this._activeItemIndex = newIndex;
        this._typeahead?.setCurrentSelectedItemIndex(newIndex);
      }
    }
  }
}

/** Items of an ActiveDescendantKeyManager style themselves as active / inactive. */
export interface Highlightable extends ListKeyManagerOption {
  setActiveStyles(): void;
  setInactiveStyles(): void;
}

/** ListKeyManager for `aria-activedescendant` widgets: the active item styles itself, focus stays put. */
export class ActiveDescendantKeyManager<T> extends ListKeyManager<Highlightable & T> {
  override setActiveItem(index: (Highlightable & T) | number): void {
    if (this.activeItem) this.activeItem.setInactiveStyles();
    super.setActiveItem(index);
    if (this.activeItem) this.activeItem.setActiveStyles();
  }
}

/** Items of a FocusKeyManager focus themselves. */
export interface FocusableOption extends ListKeyManagerOption {
  focus(origin?: FocusOrigin): void;
}

/** ListKeyManager for roving focus: the active item receives focus. */
export class FocusKeyManager<T> extends ListKeyManager<FocusableOption & T> {
  private _origin: FocusOrigin = "program";

  /** Focus origin passed to the items' `focus` calls. */
  setFocusOrigin(origin: FocusOrigin): this {
    this._origin = origin;
    return this;
  }

  override setActiveItem(item: (FocusableOption & T) | number): void {
    super.setActiveItem(item);
    if (this.activeItem) this.activeItem.focus(this._origin);
  }
}

/**
 * Adapter: DOM elements as key manager items (`disabled` from `aria-disabled` / `disabled`, label
 * from text content, `focus()` / active styles via `data-active`). Rivet addition for DOM-as-collection
 * widgets.
 */
export function elementOption(element: HTMLElement): FocusableOption & Highlightable & { element: HTMLElement } {
  return {
    element,
    get disabled() {
      return element.getAttribute("aria-disabled") === "true" || (element as HTMLButtonElement).disabled === true;
    },
    getLabel: () => element.getAttribute("aria-label") ?? element.textContent ?? "",
    focus: () => element.focus(),
    setActiveStyles: () => element.setAttribute("data-active", ""),
    setInactiveStyles: () => element.removeAttribute("data-active"),
  };
}
