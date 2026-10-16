// Ported from @angular/cdk/collections (selection-model.ts), MIT, © Google LLC.
//
// Imperative selection of values (not keys): for client-side code and stores. rxjs `Subject` →
// a minimal `changed` emitter (`subscribe(fn)` returns an unsubscribe). Not serializable: for
// resumable component state use `@rivetjs/cdk/selection/state` (signals) instead.

/** Event emitted when the value of a SelectionModel has changed. */
export interface SelectionChange<T> {
  /** Model that dispatched the event. */
  source: SelectionModel<T>;
  /** Options that were added to the model. */
  added: T[];
  /** Options that were removed from the model. */
  removed: T[];
}

/** Minimal Subject: `next` notifies subscribers in order. */
export class Emitter<T> {
  private listeners: ((value: T) => void)[] = [];
  subscribe(fn: (value: T) => void): { unsubscribe(): void } {
    this.listeners.push(fn);
    return {
      unsubscribe: () => {
        this.listeners = this.listeners.filter((l) => l !== fn);
      },
    };
  }
  next(value: T): void {
    for (const fn of [...this.listeners]) fn(value);
  }
  get observed(): boolean {
    return this.listeners.length > 0;
  }
}

/** Class to be used to power selecting one or more options from a list. */
export class SelectionModel<T> {
  /** Currently-selected values. */
  private _selection = new Set<T>();
  /** Keeps track of the deselected options that haven't been emitted by the change event. */
  private _deselectedToEmit: T[] = [];
  /** Keeps track of the selected options that haven't been emitted by the change event. */
  private _selectedToEmit: T[] = [];
  /** Cache for the array value of the selected items. */
  private _selected: T[] | null = null;

  /** Selected values. */
  get selected(): T[] {
    if (!this._selected) this._selected = Array.from(this._selection.values());
    return this._selected;
  }

  /** Event emitted when the value has changed. */
  readonly changed = new Emitter<SelectionChange<T>>();

  /** Selection methods taking arrays (no spread: large collections). */
  readonly bulk: Readonly<{
    select: (values: T[]) => boolean;
    deselect: (values: T[]) => boolean;
    setSelection: (values: T[]) => boolean;
  }> = {
    select: (values) => this._select(values),
    deselect: (values) => this._deselect(values),
    setSelection: (values) => this._setSelection(values),
  };

  private _multiple: boolean;
  private _emitChanges: boolean;
  compareWith?: ((o1: T, o2: T) => boolean) | undefined;

  constructor(_multiple = false, initiallySelectedValues?: T[], _emitChanges = true, compareWith?: (o1: T, o2: T) => boolean) {
    this._multiple = _multiple;
    this._emitChanges = _emitChanges;
    this.compareWith = compareWith;
    if (initiallySelectedValues && initiallySelectedValues.length) {
      if (_multiple) initiallySelectedValues.forEach((value) => this._markSelected(value));
      else this._markSelected(initiallySelectedValues[0]!);
      // Clear the array in order to avoid firing the change event for preselected values.
      this._selectedToEmit.length = 0;
    }
  }

  /** Selects a value or an array of values. Returns whether the selection changed. */
  select(...values: T[]): boolean {
    return this._select(values);
  }

  /** Deselects a value or an array of values. Returns whether the selection changed. */
  deselect(...values: T[]): boolean {
    return this._deselect(values);
  }

  /** Sets the selected values. Returns whether the selection changed. */
  setSelection(...values: T[]): boolean {
    return this._setSelection(values);
  }

  /** Toggles a value between selected and deselected. */
  toggle(value: T): boolean {
    return this.isSelected(value) ? this.deselect(value) : this.select(value);
  }

  /**
   * Clears all of the selected values. `flushEvent` false defers the change event to the next one.
   * Returns whether the selection changed.
   */
  clear(flushEvent = true): boolean {
    this._unmarkAll();
    const changed = this._hasQueuedChanges();
    if (flushEvent) this._emitChangeEvent();
    return changed;
  }

  /** Determines whether a value is selected. */
  isSelected(value: T): boolean {
    return this._selection.has(this._getConcreteValue(value));
  }

  /** Determines whether the model does not have a value. */
  isEmpty(): boolean {
    return this._selection.size === 0;
  }

  /** Determines whether the model has a value. */
  hasValue(): boolean {
    return !this.isEmpty();
  }

  /** Sorts the selected values based on a predicate function. */
  sort(predicate?: (a: T, b: T) => number): void {
    if (this._multiple && this.selected) this._selected!.sort(predicate);
  }

  /** Gets whether multiple values can be selected. */
  isMultipleSelection(): boolean {
    return this._multiple;
  }

  private _select(values: T[]): boolean {
    this._verifyValueAssignment(values);
    values.forEach((value) => this._markSelected(value));
    const changed = this._hasQueuedChanges();
    this._emitChangeEvent();
    return changed;
  }

  private _deselect(values: T[]): boolean {
    this._verifyValueAssignment(values);
    values.forEach((value) => this._unmarkSelected(value));
    const changed = this._hasQueuedChanges();
    this._emitChangeEvent();
    return changed;
  }

  private _setSelection(values: T[]): boolean {
    this._verifyValueAssignment(values);
    const oldValues = this.selected;
    const newSelectedSet = new Set(values.map((value) => this._getConcreteValue(value)));
    values.forEach((value) => this._markSelected(value));
    oldValues.filter((value) => !newSelectedSet.has(this._getConcreteValue(value, newSelectedSet))).forEach((value) => this._unmarkSelected(value));
    const changed = this._hasQueuedChanges();
    this._emitChangeEvent();
    return changed;
  }

  /** Emits a change event and clears the records of selected and deselected values. */
  private _emitChangeEvent(): void {
    // Clear the selected values so they can be re-cached.
    this._selected = null;
    if (this._selectedToEmit.length || this._deselectedToEmit.length) {
      this.changed.next({ source: this, added: this._selectedToEmit, removed: this._deselectedToEmit });
      this._deselectedToEmit = [];
      this._selectedToEmit = [];
    }
  }

  private _markSelected(value: T): void {
    value = this._getConcreteValue(value);
    if (!this.isSelected(value)) {
      if (!this._multiple) this._unmarkAll();
      if (!this.isSelected(value)) this._selection.add(value);
      if (this._emitChanges) this._selectedToEmit.push(value);
    }
  }

  private _unmarkSelected(value: T): void {
    value = this._getConcreteValue(value);
    if (this.isSelected(value)) {
      this._selection.delete(value);
      if (this._emitChanges) this._deselectedToEmit.push(value);
    }
  }

  private _unmarkAll(): void {
    if (!this.isEmpty()) this._selection.forEach((value) => this._unmarkSelected(value));
  }

  /** Throws when several values are assigned to a single-selection model. */
  private _verifyValueAssignment(values: T[]): void {
    if (values.length > 1 && !this._multiple) throw getMultipleValuesInSingleSelectionError();
  }

  private _hasQueuedChanges(): boolean {
    return !!(this._deselectedToEmit.length || this._selectedToEmit.length);
  }

  /** A value comparable to inputValue by compareWith, or inputValue itself. */
  private _getConcreteValue(inputValue: T, selection?: Set<T>): T {
    if (!this.compareWith) return inputValue;
    selection = selection ?? this._selection;
    for (const selectedValue of selection) if (this.compareWith(inputValue, selectedValue)) return selectedValue;
    return inputValue;
  }
}

/** Error: multiple values passed into a single-value SelectionModel. */
export function getMultipleValuesInSingleSelectionError(): Error {
  return Error("Cannot pass multiple values into SelectionModel with single-value mode.");
}

// Ported from @angular/cdk/collections (tree-adapter.ts), MIT, © Google LLC.
/**
 * Interface for a class that can flatten hierarchical structured data and re-expand the flattened
 * data back into its original structure. Should be used in conjunction with a tree.
 */
export interface TreeDataNodeFlattener<T> {
  /** Transforms a set of hierarchical structured data into a flattened data array. */
  flattenNodes(structuredData: any[]): T[];
  /** Expands a flattened array of data into its hierarchical form using the provided expansion model. */
  expandFlattenedNodes(nodes: T[], expansionModel: SelectionModel<T>): T[];
  /** Put node descendants of node in array. If `onlyExpandable` is true, then only process expandable descendants. */
  nodeDescendents(node: T, nodes: T[], onlyExpandable: boolean): void;
}
