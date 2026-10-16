// Ported from React Stately (react-stately src/combobox/useComboBoxState.ts), Apache-2.0, © Adobe.
//
// ComboBox state: the collection (items / defaultItems / a built collection), single or multiple
// selection (`value` / deprecated `selectedKey`), the input text, the menu's open state with the
// action that opened it, the frozen collection shown while the menu closes, and form validation.
// Rivet:
// - React state / refs → signals + JSON (serializable, region state); methods → free functions
//   taking the state (`openCombo(state, …)` = `state.open(…)`, `commitCombo` = `state.commit()` …).
// - The per-render `useEffect` body of useComboBoxState is `comboUpdate(state)`. Every exported
//   action runs it (until stable, like React's render → effect → render loop) once the action's
//   writes are done; a component runs it when inputs outside the state change (controlled `items`
//   accessors, a controlled value Signal written from outside).
// - Collections are class instances: never stored. `comboCollection(state)` builds the collection
//   from the inputs on demand (cached per items array), `comboDisplayedCollection(state)` =
//   upstream `state.collection`; the frozen `lastCollection` lives in a module WeakMap (browser-only,
//   never serialized: after a resume the closed menu shows the filtered collection, as on mount).
// - `selectionManager` → `comboSelectionManager(state)` (a SelectionManager rebuilt per call over the
//   state's `selectionState`). The list selection is controlled by the value (upstream
//   `selectedKeys: convertValue(displayValue)`): `selectedKeys` is a signal kept in sync with the
//   value by `comboUpdate`, and list selection writes reach `onSelectionChange` → `setValue`.
//   That callback cannot live inside the serialized state (it would capture the state: a cycle), so
//   `selectionState` is a separate view object: `createComboBoxState` builds it with a closure
//   (client-rendered / non-resumed use); the ComboBox component builds it from `createComboBoxCore`
//   + `comboBoxSelectionState(core, { onSelectionChange: (keys) => comboSelectionChange(core, keys) })`
//   so the callback is an inline arrow (resumable) capturing only the core.
// - Controlled values: a Signal is two-way; a plain `value` / `selectedKey` / `inputValue` is
//   controlled (useControlledState): never written by the state, changes reported to the callbacks.
// - `defaultFilter`: the filter is not stored as a function. `defaultFilter` (a user callback) wins;
//   else `filterLocale` (Rivet: what RAC ComboBox passes as `useFilter({sensitivity: "base"}).contains`)
//   builds a locale `contains` filter on use; with neither, no filtering (upstream hook semantics).
// - The validation value (`{ inputValue, value, selectedKey }` or null) is a signal kept in sync too.
import { batch, signal, untrack, _regionState, type Signal } from "@rivetjs/reactivity";
import { createId } from "@rivetjs/cdk/id";
import { CollectionBuilder, createCollection } from "@rivetjs/cdk/collections/builder";
import { ListCollection } from "@rivetjs/cdk/collections/list";
import { getChildNodes } from "@rivetjs/cdk/collections/nodes";
import { defaultItemRenderer } from "@rivetjs/cdk/collections/list-state";
import type { Collection, CollectionChildren, FocusStrategy, Key, Node, Selection } from "@rivetjs/cdk/collections/types";
import { SelectionManager } from "@rivetjs/cdk/selection/manager";
import type { MultipleSelectionState } from "@rivetjs/cdk/selection/state";
import { createFilter } from "../i18n/filter.ts";
import {
  commitValidation,
  createFormValidationState,
  type FormValidationState,
  type MaybeAccessor,
  type ValidationBehavior,
  type ValidationErrors,
  type ValidationFunction,
} from "./form-validation.ts";
import type { Point } from "./overlays.ts";

export type { Key, Selection, FocusStrategy, Node, Collection };

export type MenuTriggerAction = "focus" | "input" | "manual";
export type SelectionMode = "single" | "multiple";
export type ValueType<M extends SelectionMode> = M extends "single" ? Key | null : readonly Key[];
export type ChangeValueType<M extends SelectionMode> = M extends "single" ? Key | null : Key[];
type ValidationType<M extends SelectionMode> = M extends "single" ? Key | null : Key[];
type FilterFn = (textValue: string, inputValue: string) => boolean;

export interface ComboBoxValidationValue<M extends SelectionMode = "single"> {
  /** @deprecated The selected key in the ComboBox. */
  selectedKey: Key | null;
  /** The keys of the currently selected items. */
  value: ValidationType<M>;
  /** The value of the ComboBox input. */
  inputValue: string;
}

/** A controlled value: plain, a two-way Signal, or an accessor (a live prop: read on use, never written). */
export type Controllable<T> = T | Signal<T> | (() => T);

const isSignal = <T>(value: unknown): value is Signal<T> => typeof value === "function" && typeof (value as Signal<T>).set === "function";

/** react-stately `ComboBoxStateOptions` (`ComboBoxProps` + collection options). */
export interface ComboBoxStateProps<T = any, M extends SelectionMode = "single"> {
  /** The list of ComboBox items (uncontrolled): filtered with `defaultFilter`. */
  defaultItems?: readonly T[] | (() => readonly T[]) | undefined;
  /** The list of ComboBox items (controlled): not filtered (the application filters). */
  items?: readonly T[] | (() => readonly T[]) | null | undefined;
  /** Collection elements, or a renderer `(item) => Item(...)` for the items. Default: `{ id, name | label | textValue }` items. */
  children?: CollectionChildren<T> | undefined;
  /** A pre-built collection (RAC: the CollectionBuilder output of the ListBox parts), or an accessor of one. */
  collection?: Collection<Node<T>> | (() => Collection<Node<T>>) | undefined;
  /** Whether single or multiple selection is enabled. @default 'single' */
  selectionMode?: M | undefined;
  /** The current value (controlled). */
  value?: Controllable<ValueType<M>> | undefined;
  /** The default value (uncontrolled). */
  defaultValue?: ValueType<M> | undefined;
  /** Handler that is called when the value changes. */
  onChange?: ((value: ChangeValueType<M>) => void) | undefined;
  /** @deprecated The currently selected key in the collection (controlled). */
  selectedKey?: Controllable<Key | null> | undefined;
  /** @deprecated The initial selected key in the collection (uncontrolled). */
  defaultSelectedKey?: Key | null | undefined;
  /** @deprecated Handler that is called when the selection changes. */
  onSelectionChange?: ((key: Key | null) => void) | undefined;
  /** The value of the ComboBox input (controlled). */
  inputValue?: Controllable<string> | undefined;
  /** The default value of the ComboBox input (uncontrolled). */
  defaultInputValue?: string | undefined;
  /** Handler that is called when the ComboBox input value changes. */
  onInputChange?: ((value: string) => void) | undefined;
  /** Whether the ComboBox allows a non-item matching input value to be set. */
  allowsCustomValue?: boolean | undefined;
  /** The interaction required to display the ComboBox menu. @default 'input' */
  menuTrigger?: MenuTriggerAction | undefined;
  /** Method that is called when the open state of the menu changes, with the action that opened it. */
  onOpenChange?: ((isOpen: boolean, menuTrigger?: MenuTriggerAction) => void) | undefined;
  /** The filter function used to determine if a option should be included in the combo box list. */
  defaultFilter?: FilterFn | undefined;
  /** Rivet: locale of the default `contains` filter (sensitivity "base") used when `defaultFilter` is omitted. */
  filterLocale?: string | undefined;
  /** Whether the combo box allows the menu to be open when the collection is empty. */
  allowsEmptyCollection?: boolean | undefined;
  /** Whether the combo box menu should close on blur. @default true */
  shouldCloseOnBlur?: boolean | undefined;
  /** The item keys that are disabled. */
  disabledKeys?: Iterable<Key> | undefined;
  /** Rivet (live props): the ComboBox part passes an accessor for a live flag (read once here, except `isReadOnly`:
   *  `core.readOnly`, read `isComboReadOnly`). */
  isDisabled?: boolean | undefined;
  isReadOnly?: boolean | undefined;
  isRequired?: MaybeAccessor<boolean | undefined>;
  isInvalid?: MaybeAccessor<boolean | undefined> | undefined;
  validate?: ValidationFunction<ComboBoxValidationValue<M>> | undefined;
  /** @default 'aria' (the ComboBox component defaults to 'native', RAC) */
  validationBehavior?: ValidationBehavior | undefined;
  /** Server errors (from `<Form validationErrors>`). */
  validationErrors?: MaybeAccessor<ValidationErrors | undefined> | undefined;
  name?: string | undefined;
  form?: string | undefined;
  /** Base id of the parts; generated when omitted. */
  id?: string | undefined;
}

type AnyValue = Key | null | readonly Key[];

/**
 * The serializable core of a ComboBox state (signals + JSON + user callbacks). Every free function
 * that does not need the selection manager takes it.
 */
export interface ComboBoxCore<T = any, M extends SelectionMode = SelectionMode> {
  readonly id: string;
  readonly selectionMode: M;
  readonly menuTrigger: MenuTriggerAction;
  readonly allowsEmptyCollection: boolean;
  readonly allowsCustomValue: boolean;
  readonly shouldCloseOnBlur: boolean;
  /** The flags at creation; read `isComboReadOnly(core)` (follows a live `readOnly`). */
  readonly isDisabled: boolean;
  readonly isReadOnly: boolean;
  readonly isRequired: boolean;
  /** Live `isReadOnly` accessor (live props). */
  readonly readOnly?: (() => boolean | undefined) | undefined;
  readonly name?: string | undefined;
  readonly form?: string | undefined;
  // Collection inputs.
  readonly items: ComboBoxStateProps<T, M>["items"];
  readonly defaultItems: ComboBoxStateProps<T, M>["defaultItems"];
  readonly children: CollectionChildren<T> | undefined;
  readonly collection: ComboBoxStateProps<T, M>["collection"];
  readonly defaultFilter: FilterFn | undefined;
  readonly filterLocale: string | undefined;
  readonly disabledKeys: readonly Key[];
  // Value.
  /** The value (single: key, multiple: keys). */
  readonly value: Signal<AnyValue>;
  /** `value` / `selectedKey` was given (upstream `value !== undefined`). */
  readonly valueControlled: boolean;
  /** A plain controlled value: never written (only reported). */
  readonly valueFixed: boolean;
  readonly defaultValue: ValueType<M>;
  readonly defaultSelectedKey: Key | null;
  /** The input text. */
  readonly inputValue: Signal<string>;
  /** `inputValue` was given (upstream `props.inputValue !== undefined`). */
  readonly inputControlled: boolean;
  readonly inputFixed: boolean;
  readonly defaultInputValue: string;
  // Overlay (OverlayTriggerState shape: Popover reads `isOpen`).
  readonly isOpen: Signal<boolean>;
  readonly point: Signal<Point | null>;
  // Upstream useState / useRef.
  readonly focusStrategy: Signal<FocusStrategy | null>;
  readonly isFocused: Signal<boolean>;
  readonly showAllItems: Signal<boolean>;
  readonly closedDueToEmpty: Signal<boolean>;
  readonly menuOpenTrigger: Signal<MenuTriggerAction | null>;
  readonly lastValue: Signal<string>;
  /** `lastValueRef`: the display value at the last update. */
  readonly lastDisplayValue: Signal<AnyValue>;
  readonly lastSelectedKeyText: Signal<string>;
  readonly valueOnFocus: Signal<[string, AnyValue]>;
  // List selection + focus (the selection state's signals).
  readonly selectedKeys: Signal<Selection>;
  readonly listFocused: Signal<boolean>;
  readonly focusedKey: Signal<Key | null>;
  readonly childFocusStrategy: Signal<FocusStrategy | null>;
  readonly selectionBehavior: Signal<"toggle" | "replace">;
  readonly anchorKey: Signal<Key | null>;
  readonly currentKey: Signal<Key | null>;
  // Validation.
  readonly validationValue: Signal<ComboBoxValidationValue<M> | null>;
  readonly validation: FormValidationState;
  // Callbacks.
  readonly onChange?: ((value: never) => void) | undefined;
  readonly onSelectionChange?: ((key: Key | null) => void) | undefined;
  readonly onInputChange?: ((value: string) => void) | undefined;
  readonly onOpenChange?: ((isOpen: boolean, menuTrigger?: MenuTriggerAction) => void) | undefined;
}

/** The ComboBox state: the core plus the list's selection state (`selectionManager` source). */
export interface ComboBoxState<T = any, M extends SelectionMode = SelectionMode> extends ComboBoxCore<T, M> {
  readonly selectionState: MultipleSelectionState;
}

const convertValue = (value: AnyValue | undefined): Key[] => (value == null ? [] : Array.isArray(value) ? [...value] : [value as Key]);

const readItems = <T>(items: readonly T[] | (() => readonly T[]) | null | undefined): readonly T[] | null | undefined =>
  typeof items === "function" ? items() : items;

/**
 * The serializable core of a combo box state (react-stately `useComboBoxState` minus the selection
 * view). Region state: a resumed page re-creating the combobox's region keeps it.
 */
export function createComboBoxCore<T = any, M extends SelectionMode = "single">(props: ComboBoxStateProps<T, M>): ComboBoxCore<T, M> {
  return _regionState(() => {
    const selectionMode = (props.selectionMode ?? "single") as M;
    const single = selectionMode === "single";
    const defaultValue = (props.defaultValue !== undefined ? props.defaultValue : single ? (props.defaultSelectedKey ?? null) : []) as ValueType<M>;
    const valueProp = (props.value !== undefined ? props.value : single ? props.selectedKey : undefined) as Controllable<AnyValue> | undefined;
    // A Signal is two-way; an accessor (live prop) is read as is and never written (`valueFixed`).
    const value: Signal<AnyValue> =
      typeof valueProp === "function" ? (valueProp as Signal<AnyValue>) : signal<AnyValue>(valueProp !== undefined ? valueProp : defaultValue);
    const initialValue = untrack(value);
    const initialDisplay = single && Array.isArray(initialValue) ? (initialValue[0] ?? null) : initialValue;
    const core = {
      // The listbox id (RA useMenuTrigger `menuId` = useId()); `props.id` is the input's id.
      id: createId(),
      selectionMode,
      menuTrigger: props.menuTrigger ?? "input",
      allowsEmptyCollection: !!props.allowsEmptyCollection,
      allowsCustomValue: !!props.allowsCustomValue,
      shouldCloseOnBlur: props.shouldCloseOnBlur ?? true,
      isDisabled: !!untrack(() => readFlag(props.isDisabled)),
      isReadOnly: !!untrack(() => readFlag(props.isReadOnly)),
      isRequired: !!untrack(() => readFlag(props.isRequired)),
      ...(typeof props.isReadOnly === "function" ? { readOnly: props.isReadOnly as () => boolean | undefined } : {}),
      ...(props.name !== undefined ? { name: props.name } : {}),
      ...(props.form !== undefined ? { form: props.form } : {}),
      items: props.items,
      defaultItems: props.defaultItems,
      children: props.children,
      collection: props.collection,
      defaultFilter: props.defaultFilter,
      filterLocale: props.filterLocale,
      disabledKeys: [...(props.disabledKeys ?? [])],
      value,
      valueControlled: valueProp !== undefined,
      valueFixed: valueProp !== undefined && !isSignal(valueProp),
      defaultValue: (defaultValue ?? initialDisplay) as ValueType<M>,
      defaultSelectedKey: props.defaultSelectedKey ?? (single ? (initialDisplay as Key | null) : null) ?? null,
      inputValue: signal(""),
      inputControlled: props.inputValue !== undefined,
      inputFixed: props.inputValue !== undefined && !isSignal(props.inputValue),
      defaultInputValue: "",
      isOpen: signal(false),
      point: signal<Point | null>(null),
      focusStrategy: signal<FocusStrategy | null>(null),
      isFocused: signal(false),
      showAllItems: signal(false),
      closedDueToEmpty: signal(false),
      menuOpenTrigger: signal<MenuTriggerAction | null>("focus"),
      lastValue: signal(""),
      lastDisplayValue: signal<AnyValue>(initialDisplay),
      lastSelectedKeyText: signal(""),
      valueOnFocus: signal<[string, AnyValue]>(["", initialDisplay]),
      selectedKeys: signal<Selection>(new Set(convertValue(initialDisplay))),
      listFocused: signal(false),
      focusedKey: signal<Key | null>(null),
      childFocusStrategy: signal<FocusStrategy | null>(null),
      selectionBehavior: signal<"toggle" | "replace">("toggle"),
      anchorKey: signal<Key | null>(null),
      currentKey: signal<Key | null>(null),
      validationValue: signal<ComboBoxValidationValue<M> | null>(null),
      ...(props.onChange ? { onChange: props.onChange as (value: never) => void } : {}),
      ...(props.onSelectionChange ? { onSelectionChange: props.onSelectionChange } : {}),
      ...(props.onInputChange ? { onInputChange: props.onInputChange } : {}),
      ...(props.onOpenChange ? { onOpenChange: props.onOpenChange } : {}),
    } as unknown as Mutable<ComboBoxCore<T, M>>;
    // validation: its value accessor is the synced validation-value signal.
    core.validation = createFormValidationState<unknown>({
      isInvalid: props.isInvalid,
      validate: props.validate as ValidationFunction<unknown> | undefined,
      validationBehavior: props.validationBehavior ?? "aria",
      name: props.name,
      validationErrors: props.validationErrors,
      value: core.validationValue,
    });
    // useControlledState(props.inputValue, getDefaultInputValue(defaultInputValue, selectedKey, collection) || '').
    const selectedKey = single ? ((initialDisplay as Key | null) ?? null) : null;
    const startInput = untrack(() => getDefaultInputValue(props.defaultInputValue, selectedKey, comboCollection(core))) || "";
    const inputProp = props.inputValue;
    if (typeof inputProp === "function") core.inputValue = inputProp as Signal<string>;
    else core.inputValue.set(inputProp !== undefined ? inputProp : startInput);
    const initialInput = untrack(core.inputValue);
    core.lastValue.set(initialInput);
    core.valueOnFocus.set([initialInput, initialDisplay]);
    // RAC ComboBox builds its collection after the first render (CollectionBuilder): the selected item's text is
    // "" on that render, so the first update writes it into the input (over `defaultInputValue`). A
    // `collection` prop (the component's built collection) reproduces that; data `items` keep useComboBoxState's.
    core.lastSelectedKeyText.set(selectedKey != null && !props.collection ? untrack(() => itemText(core, selectedKey)) : "");
    core.defaultInputValue = untrack(() => getDefaultInputValue(props.defaultInputValue, core.defaultSelectedKey, comboCollection(core))) ?? initialInput;
    core.validationValue.set(untrack(() => validationValueOf(core)));
    return core as ComboBoxCore<T, M>;
  });
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

const readFlag = (flag: MaybeAccessor<boolean | undefined>): boolean | undefined => (typeof flag === "function" ? flag() : flag);

/** Whether the combobox is read-only now (its live `isReadOnly` accessor, else the creation value). */
export const isComboReadOnly = (core: ComboBoxCore): boolean => (core.readOnly ? !!core.readOnly() : core.isReadOnly);

/**
 * Rivet (live props): the input text, after running the update loop when a plain controlled `value` / `selectedKey` /
 * `inputValue` (an accessor: the parent's prop) changed since the last update — RA re-renders and its per-render
 * effect re-syncs the input with the selection. Called from the input's value binding, so a resumed page (where the
 * component's update effect never runs) follows the prop in place. Reads the value / input tracked.
 */
export function comboInputText(core: ComboBoxCore): string {
  if ((core.valueFixed || core.inputFixed) && run.depth === 0) {
    const display = comboValue(core);
    const input = core.inputValue();
    if (!sameValue(display, untrack(core.lastDisplayValue)) || input !== untrack(core.lastValue)) comboUpdate(core);
  }
  return core.inputValue();
}

/** Same value, or equal key lists (a live multiple `value={…}` returns a fresh array per read). */
const sameValue = (a: unknown, b: unknown): boolean =>
  Object.is(a, b) || (Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((key, i) => Object.is(key, b[i])));

/**
 * The list's selection state over a core (react-stately `useListState` selection options of
 * useComboBoxState): controlled by the value, `disallowEmptySelection` in single mode, duplicate
 * selection events allowed. `onSelectionChange` must call `comboSelectionChange(core, keys)`.
 */
export function comboBoxSelectionState(core: ComboBoxCore, view: { onSelectionChange: (keys: Selection) => void }): MultipleSelectionState {
  return {
    selectionMode: core.selectionMode,
    selectionBehavior: core.selectionBehavior,
    selectionBehaviorProp: "toggle",
    disallowEmptySelection: core.selectionMode === "single",
    selectedKeys: core.selectedKeys,
    anchorKey: core.anchorKey,
    currentKey: core.currentKey,
    isFocused: core.listFocused,
    focusedKey: core.focusedKey,
    childFocusStrategy: core.childFocusStrategy,
    disabledKeys: new Set(core.disabledKeys),
    disabledBehavior: "all",
    controlled: true,
    allowDuplicateSelectionEvents: true,
    onSelectionChange: view.onSelectionChange,
  };
}

/**
 * Provides state management for a combo box component (react-stately `useComboBoxState`). Handles
 * building a collection of items from props and manages the option selection state of the combo
 * box. In addition, it tracks the input value, focus state, and other properties of the combo box.
 * (Resumed components: build it from `createComboBoxCore` + `comboBoxSelectionState` with an inline arrow.)
 */
export function createComboBoxState<T = any, M extends SelectionMode = "single">(props: ComboBoxStateProps<T, M>): ComboBoxState<T, M> {
  const core = createComboBoxCore<T, M>(props);
  return { ...core, selectionState: comboBoxSelectionState(core, { onSelectionChange: (keys) => comboSelectionChange(core, keys) }) };
}

// ---------------------------------------------------------------------------------------------
// Collection
// ---------------------------------------------------------------------------------------------

/**
 * Per-instance cache key: the `isOpen` signal (shared by the core and every `{ ...core, selectionState }`
 * view, so module caches see one instance whichever object an action receives).
 */
const idOf = (core: ComboBoxCore<any, any>): object => core.isOpen;

const built = new WeakMap<object, { items: unknown; collection: Collection<Node<any>>; builder: CollectionBuilder<any> }>();

/** The full (unfiltered) collection (upstream `collection` of useListState). Reads accessor inputs. */
export function comboCollection<T>(core: ComboBoxCore<T, SelectionMode>): Collection<Node<T>> {
  const given = core.collection;
  if (given) return typeof given === "function" ? given() : given;
  const items = readItems(core.items) ?? readItems(core.defaultItems) ?? undefined;
  const cached = built.get(idOf(core));
  if (cached && cached.items === items) return cached.collection as Collection<Node<T>>;
  const builder = cached?.builder ?? new CollectionBuilder<any>();
  const children = core.children ?? (items ? (defaultItemRenderer as CollectionChildren<T>) : null);
  const collection = createCollection<T, Collection<Node<T>>>(
    { children, items: items as Iterable<T> | undefined },
    (nodes) => new ListCollection(nodes),
    { suppressTextValueWarning: !core.children },
    builder,
  );
  built.set(idOf(core), { items, collection, builder });
  return collection;
}

/** The filter in use: `defaultFilter`, else a locale `contains` (sensitivity "base"), else none. */
export function comboFilter(core: ComboBoxCore): FilterFn | undefined {
  if (core.defaultFilter) return core.defaultFilter;
  if (core.filterLocale) return createFilter({ sensitivity: "base" }, core.filterLocale).contains;
  return undefined;
}

const filtered = new WeakMap<object, { input: string; filter: FilterFn | undefined; collection: Collection<Node<any>>; result: Collection<Node<any>> }>();

/** The collection filtered by the input (none when items are controlled or no filter is set). Reads signals. */
export function comboFilteredCollection<T>(core: ComboBoxCore<T, SelectionMode>): Collection<Node<T>> {
  const collection = comboCollection(core);
  const filter = comboFilter(core);
  // No default filter if items are controlled.
  if (core.items != null || !filter) return collection;
  const input = core.inputValue();
  const cached = filtered.get(idOf(core));
  if (cached && cached.input === input && cached.collection === collection && (cached.filter === filter || !core.defaultFilter))
    return cached.result as Collection<Node<T>>;
  const result = filterCollection(collection, input, filter);
  filtered.set(idOf(core), { input, filter, collection, result });
  return result;
}

const lastCollections = new WeakMap<object, Collection<Node<any>>>();

function lastCollection<T>(core: ComboBoxCore<T, SelectionMode>): Collection<Node<T>> {
  return (lastCollections.get(idOf(core)) as Collection<Node<T>> | undefined) ?? comboFilteredCollection(core);
}

/** Input text of the current "render" (the action / update pass that is running): upstream closures see it. */
const renderInput = new WeakMap<object, string>();

/** Upstream `updateLastCollection`: freeze what the menu shows while it closes (the render's filtered collection). */
function updateLastCollection(core: ComboBoxCore): void {
  untrack(() => {
    let result: Collection<Node<unknown>>;
    if (core.showAllItems()) result = comboCollection(core);
    else {
      const input = renderInput.get(idOf(core));
      const filter = comboFilter(core);
      result =
        input === undefined || input === core.inputValue() || core.items != null || !filter
          ? comboFilteredCollection(core)
          : filterCollection(comboCollection(core), input, filter);
    }
    lastCollections.set(idOf(core), result);
  });
}

/** The displayed collection (upstream `state.collection`): open → all or filtered items; closed → frozen. Reads signals. */
export function comboDisplayedCollection<T>(core: ComboBoxCore<T, SelectionMode>): Collection<Node<T>> {
  if (core.isOpen()) return core.showAllItems() ? comboCollection(core) : comboFilteredCollection(core);
  return lastCollection(core);
}

/** The selection manager (upstream `state.selectionManager`) over the displayed collection. */
export function comboSelectionManager(state: ComboBoxState): SelectionManager {
  return new SelectionManager(comboDisplayedCollection(state) as Collection<Node<unknown>>, state.selectionState);
}

function filterCollection<T>(collection: Collection<Node<T>>, inputValue: string, filter: FilterFn): Collection<Node<T>> {
  return new ListCollection(filterNodes(collection, collection, inputValue, filter));
}

function filterNodes<T>(collection: Collection<Node<T>>, nodes: Iterable<Node<T>>, inputValue: string, filter: FilterFn): Iterable<Node<T>> {
  const filteredNode: Node<T>[] = [];
  for (const node of nodes) {
    if (node.type === "section" && node.hasChildNodes) {
      const result = filterNodes(collection, getChildNodes(node, collection), inputValue, filter);
      if ([...result].some((node) => node.type === "item")) filteredNode.push({ ...node, childNodes: result });
    } else if (node.type === "item" && filter(node.textValue, inputValue)) {
      filteredNode.push({ ...node });
    } else if (node.type !== "item") {
      filteredNode.push({ ...node });
    }
  }
  return filteredNode;
}

function getDefaultInputValue(
  defaultInputValue: string | null | undefined,
  selectedKey: Key | null,
  collection: Collection<Node<unknown>>,
): string | null | undefined {
  if (defaultInputValue == null) {
    if (selectedKey != null) return collection.getItem(selectedKey)?.textValue ?? "";
  }
  return defaultInputValue;
}

/** Text of the item `key` in the full collection ('' when missing). */
const itemText = (core: ComboBoxCore, key: Key | null): string => (key != null ? (comboCollection(core).getItem(key)?.textValue ?? "") : "");

// ---------------------------------------------------------------------------------------------
// Value accessors (read signals: call inside bindings for live values)
// ---------------------------------------------------------------------------------------------

/** The current value; a single combobox given an array shows its first key (upstream `displayValue`). */
export function comboValue<M extends SelectionMode>(core: ComboBoxCore<any, M>): ValueType<M> {
  const value = core.value();
  return (core.selectionMode === "single" && Array.isArray(value) ? (value[0] ?? null) : value) as ValueType<M>;
}

/** Selected keys (the list selection, value order). */
export const comboSelectedKeys = (core: ComboBoxCore): Key[] => convertValue(comboValue(core));

/** @deprecated upstream: the key of the first selected item (single mode only, else null). */
export const comboSelectedKey = (core: ComboBoxCore): Key | null => (core.selectionMode === "single" ? (comboSelectedKeys(core)[0] ?? null) : null);

/** The selected item nodes (keys missing from the collection are skipped). */
export function comboSelectedItems<T>(core: ComboBoxCore<T, SelectionMode>): Node<T>[] {
  const collection = comboCollection(core);
  return comboSelectedKeys(core)
    .map((key) => collection.getItem(key))
    .filter((item): item is Node<T> => item != null);
}

/** @deprecated upstream `selectedItem`: the first selected item node. */
export const comboSelectedItem = <T>(core: ComboBoxCore<T, SelectionMode>): Node<T> | null => comboSelectedItems(core)[0] ?? null;

function validationValueOf(core: ComboBoxCore): ComboBoxValidationValue<SelectionMode> | null {
  const display = comboValue(core);
  if (Array.isArray(display) && display.length === 0) return null;
  return { inputValue: core.inputValue(), value: display as Key | null, selectedKey: comboSelectedKey(core) };
}

// ---------------------------------------------------------------------------------------------
// Actions (each runs the update loop once its writes are done)
// ---------------------------------------------------------------------------------------------

// Mutable module state in ONE object (resume-extracted symbols import module bindings read-only).
const run = { depth: 0 };

function act<R>(core: ComboBoxCore, fn: () => R): R {
  if (run.depth === 0) renderInput.set(idOf(core), untrack(core.inputValue));
  run.depth++;
  let result: R;
  try {
    result = batch(() => untrack(fn));
  } finally {
    run.depth--;
  }
  if (run.depth === 0) comboUpdate(core);
  return result;
}

/** useControlledState setter: a fixed (plain controlled) value is never written; onChange when it changes. */
function setControlledValue(core: ComboBoxCore, value: AnyValue): void {
  const previous = untrack(core.value);
  if (Object.is(previous, value)) return;
  if (!core.valueFixed) core.value.set(value);
  (core.onChange as ((value: AnyValue) => void) | undefined)?.(value);
}

/** Sets the value of the combo box input (upstream `setInputValue`). */
export function setComboInputValue(core: ComboBoxCore, value: string): void {
  act(core, () => writeInputValue(core, value));
}

function writeInputValue(core: ComboBoxCore, value: string): void {
  if (Object.is(untrack(core.inputValue), value)) return;
  if (!core.inputFixed) core.inputValue.set(value);
  core.onInputChange?.(value);
}

/** Sets the combobox value (upstream `setValue` / deprecated `setSelectedKey`). */
export function setComboValue(core: ComboBoxCore, value: Key | readonly Key[] | null): void {
  act(core, () => writeValue(core, value));
}

function writeValue(core: ComboBoxCore, value: Key | readonly Key[] | null): void {
  if (core.selectionMode === "single") {
    const key = Array.isArray(value) ? ((value as readonly Key[])[0] ?? null) : (value as Key | null);
    const display = comboValue(core);
    setControlledValue(core, key);
    if (key !== display) core.onSelectionChange?.(key);
  } else {
    let keys: Key[] = [];
    if (Array.isArray(value)) keys = [...(value as readonly Key[])];
    else if (value != null) keys = [value as Key];
    setControlledValue(core, keys);
  }
}

/** The list selection changed (upstream useListState `onSelectionChange` of useComboBoxState). */
export function comboSelectionChange(core: ComboBoxCore, keys: Selection): void {
  act(core, () => {
    // impossible, but TS doesn't know that
    if (keys === "all") return;
    if (core.selectionMode === "single") {
      const key = (keys.values().next().value as Key | undefined) ?? null;
      if (key === comboValue(core)) {
        core.onSelectionChange?.(key);
        // If key is the same, reset the inputValue and close the menu
        // (scenario: user clicks on already selected option)
        resetInputValue(core);
        closeMenu(core);
      } else {
        writeValue(core, key);
      }
    } else {
      writeValue(core, [...keys]);
    }
  });
}

/** onOpenChange wrapper: report the open action, focus the list while open, clear its focused key on close. */
function setOpenState(core: ComboBoxCore, open: boolean): void {
  if (untrack(core.isOpen) === open) return;
  core.isOpen.set(open);
  core.onOpenChange?.(open, open ? (untrack(core.menuOpenTrigger) ?? undefined) : undefined);
  core.listFocused.set(open);
  if (!open) core.focusedKey.set(null);
}

/** Whether there is something to display for an open with `trigger`. */
function canDisplay(core: ComboBoxCore, trigger: MenuTriggerAction | undefined): boolean {
  const displayAllItems = trigger === "manual" || (trigger === "focus" && core.menuTrigger === "focus");
  return (
    core.allowsEmptyCollection ||
    comboFilteredCollection(core).size > 0 ||
    (displayAllItems && comboCollection(core).size > 0) ||
    // controlled items always open (the application may swap in a base list from onOpenChange)
    !!core.items
  );
}

/** Opens the menu (upstream `open(focusStrategy, trigger)`). */
export function openCombo(core: ComboBoxCore, focusStrategy: FocusStrategy | null = null, trigger?: MenuTriggerAction): void {
  act(core, () => openMenu(core, focusStrategy, trigger));
}

function openMenu(core: ComboBoxCore, focusStrategy: FocusStrategy | null = null, trigger?: MenuTriggerAction): void {
  const displayAllItems = trigger === "manual" || (trigger === "focus" && core.menuTrigger === "focus");
  // Prevent open operations from triggering if there is nothing to display; also if items are
  // uncontrolled but defaultItems is empty, even if displayAllItems is true.
  if (!canDisplay(core, trigger)) return;
  // Show all items if menu is manually opened. Only care about this if items are undefined
  if (displayAllItems && !core.isOpen() && core.items === undefined) core.showAllItems.set(true);
  core.menuOpenTrigger.set(trigger ?? null);
  core.focusStrategy.set(focusStrategy);
  setOpenState(core, true);
}

/** Toggles the menu (upstream `toggle(focusStrategy, trigger)`). */
export function toggleCombo(core: ComboBoxCore, focusStrategy: FocusStrategy | null = null, trigger?: MenuTriggerAction): void {
  act(core, () => {
    const displayAllItems = trigger === "manual" || (trigger === "focus" && core.menuTrigger === "focus");
    // If the menu is closed and there is nothing to display, early return so toggle isn't called to prevent extraneous onOpenChange
    if (!canDisplay(core, trigger) && !core.isOpen()) return;
    // Show all items if menu is toggled open. Only care about this if items are undefined
    if (displayAllItems && !core.isOpen() && core.items === undefined) core.showAllItems.set(true);
    // Only update the menuOpenTrigger if menu is currently closed
    if (!core.isOpen()) core.menuOpenTrigger.set(trigger ?? null);
    toggleMenu(core, focusStrategy);
  });
}

function toggleMenu(core: ComboBoxCore, focusStrategy: FocusStrategy | null = null): void {
  // If menu is going to close, save the current collection so we can freeze the displayed collection
  // when the user clicks outside the popover to close the menu.
  if (core.isOpen()) updateLastCollection(core);
  core.focusStrategy.set(focusStrategy);
  setOpenState(core, !core.isOpen());
}

function closeMenu(core: ComboBoxCore): void {
  if (core.isOpen()) {
    updateLastCollection(core);
    setOpenState(core, false);
  }
}

function resetInputValue(core: ComboBoxCore): void {
  const text = itemText(core, comboSelectedKey(core));
  core.lastValue.set(text);
  writeInputValue(core, text);
}

/** Resets the input value to the previously selected item's text if any and closes the menu (upstream `revert`). */
export function revertCombo(core: ComboBoxCore): void {
  act(core, () => {
    core.closedDueToEmpty.set(false);
    if (core.allowsCustomValue && comboSelectedKey(core) == null) commitCustomValue(core);
    else commitSelection(core);
  });
}

function commitCustomValue(core: ComboBoxCore): void {
  if (core.selectionMode === "multiple") {
    // In multi-select mode, the input's custom text is independent from the selected items.
    // Closing or committing the field should not clear the existing selection.
    core.lastValue.set(core.inputValue());
    closeMenu(core);
    return;
  }
  core.lastDisplayValue.set(null);
  writeValue(core, null);
  closeMenu(core);
}

function commitSelection(core: ComboBoxCore, shouldForceSelectionChange = false): void {
  // If multiple things are controlled, call onSelectionChange only when selecting the focused item,
  // or when inputValue needs to be synced back to the selected item on commit/blur.
  if (core.valueControlled && core.inputControlled) {
    const selectedKey = comboSelectedKey(core);
    const text = itemText(core, selectedKey);
    if (shouldForceSelectionChange || core.selectionMode === "multiple" || core.inputValue() !== text) {
      core.onSelectionChange?.(selectedKey);
      (core.onChange as ((value: AnyValue) => void) | undefined)?.(comboValue(core));
    }
    // Stop menu from reopening from useEffect
    core.lastValue.set(text);
    closeMenu(core);
  } else {
    // If only a single aspect of combobox is controlled, reset input value and close menu for the user
    resetInputValue(core);
    closeMenu(core);
  }
}

function commitValue(core: ComboBoxCore): void {
  core.closedDueToEmpty.set(false);
  if (core.allowsCustomValue) {
    const text = itemText(core, comboSelectedKey(core));
    if (core.inputValue() === text) commitSelection(core);
    else commitCustomValue(core);
  } else {
    // Reset inputValue and close menu
    commitSelection(core);
  }
}

/** Commits the value and closes the menu (upstream `state.close`, = `commitValue`). */
export function closeCombo(core: ComboBoxCore): void {
  act(core, () => commitValue(core));
}

/**
 * The menu was closed from outside the combobox's own actions (the Popover's outside press / its
 * `OverlayTriggerStateContext` close): freeze the collection and commit (upstream: Popover calls
 * `state.close()` = `commitValue`). Call after `isOpen` was set to false.
 */
export function comboClosedExternally(core: ComboBoxCore): void {
  act(core, () => {
    core.onOpenChange?.(false, undefined);
    core.listFocused.set(false);
    core.focusedKey.set(null);
    commitValue(core);
  });
}

/** Selects the currently focused item and updates the input value (upstream `commit`). */
export function commitCombo(state: ComboBoxState): void {
  act(state, () => {
    const focusedKey = state.focusedKey();
    if (state.isOpen() && focusedKey != null) {
      const manager = comboSelectionManager(state);
      // Reset inputValue and close menu here if the selected key is already the focused key. Otherwise
      // fire onSelectionChange to allow the application to control the closing.
      if (manager.isSelected(focusedKey) && state.selectionMode === "single") commitSelection(state, true);
      else manager.select(focusedKey);
    } else {
      commitValue(state);
    }
  });
}

/** Sets whether the combobox is focused (upstream `setFocused`). */
export function setComboFocused(core: ComboBoxCore, isFocused: boolean): void {
  act(core, () => {
    if (isFocused) {
      core.valueOnFocus.set([core.inputValue(), comboValue(core)]);
      if (core.menuTrigger === "focus" && !isComboReadOnly(core)) openMenu(core, null, "focus");
    } else {
      if (core.shouldCloseOnBlur) commitValue(core);
      // Commit validation if the input value or selected items changed.
      const [input, value] = core.valueOnFocus();
      if (core.inputValue() !== input || comboValue(core) !== value) {
        syncDerived(core);
        commitValidation(core.validation);
      }
    }
    core.isFocused.set(isFocused);
  });
}

/** Sets the list's focused key (upstream `selectionManager.setFocusedKey`). */
export function setComboFocusedKey(core: ComboBoxCore, key: Key | null, childFocusStrategy: FocusStrategy = "first"): void {
  act(core, () => {
    core.childFocusStrategy.set(childFocusStrategy);
    core.focusedKey.set(key);
  });
}

/** Mirror the value into the list selection and the validation value. */
function syncDerived(core: ComboBoxCore): void {
  const keys = comboSelectedKeys(core);
  const current = core.selectedKeys();
  if (current === "all" || current.size !== keys.length || keys.some((key) => !current.has(key))) core.selectedKeys.set(new Set(keys));
  const next = validationValueOf(core);
  const prev = core.validationValue();
  if (next?.inputValue !== prev?.inputValue || next?.value !== prev?.value || next?.selectedKey !== prev?.selectedKey || (next == null) !== (prev == null))
    core.validationValue.set(next);
}

const snapshot = (core: ComboBoxCore): unknown[] => [
  core.value(),
  core.inputValue(),
  core.isOpen(),
  core.showAllItems(),
  core.lastValue(),
  core.focusedKey(),
  core.closedDueToEmpty(),
  core.lastDisplayValue(),
];

/**
 * The per-render effect of useComboBoxState (open / close on input, close when filtered empty,
 * re-open after async items, close on single selection, clear the focused key on input, clear the
 * value when the input is cleared, re-sync the input text with the value). Runs until stable.
 * Actions call it; call it yourself after changing inputs outside the state (items, a value Signal).
 */
export function comboUpdate(core: ComboBoxCore): void {
  if (run.depth > 0) return;
  for (let i = 0; i < 8; i++) {
    const before = untrack(() => snapshot(core));
    renderInput.set(idOf(core), untrack(core.inputValue));
    run.depth++;
    try {
      batch(() => untrack(() => effectBody(core)));
    } finally {
      run.depth--;
    }
    const after = untrack(() => snapshot(core));
    if (before.every((value, index) => Object.is(value, after[index]))) break;
  }
}

function effectBody(core: ComboBoxCore): void {
  const isFocused = core.isFocused();
  const filteredSize = comboFilteredCollection(core).size;
  const inputValue = core.inputValue();
  const lastValue = core.lastValue();
  const displayValue = comboValue(core);
  const last = core.lastDisplayValue();
  const single = core.selectionMode === "single";
  // Open and close menu automatically when the input value changes if the input is focused,
  // and there are items in the collection or allowEmptyCollection is true.
  if (isFocused && (filteredSize > 0 || core.allowsEmptyCollection) && !core.isOpen() && inputValue !== lastValue && core.menuTrigger !== "manual")
    openMenu(core, null, "input");
  // Close the menu if the collection is empty. Don't close menu if filtered collection size is 0
  // but we are currently showing all items via button press
  if (!core.showAllItems() && !core.allowsEmptyCollection && core.isOpen() && filteredSize === 0) {
    core.closedDueToEmpty.set(true);
    closeMenu(core);
  }
  // Re-open the menu when items become non-empty after being auto-closed due to an empty collection
  // (e.g. async load completed with results after a previous empty response).
  if (isFocused && core.closedDueToEmpty() && filteredSize > 0 && !core.isOpen() && core.menuTrigger !== "manual") {
    core.closedDueToEmpty.set(false);
    openMenu(core, null, "input");
  }
  // Close when an item is selected.
  if (displayValue != null && displayValue !== last && single) closeMenu(core);
  // Clear focused key when input value changes and display filtered collection again.
  if (inputValue !== lastValue) {
    core.focusedKey.set(null);
    core.showAllItems.set(false);
    // Set value to null when the user clears the input.
    // If controlled, this is the application developer's responsibility.
    if (single && inputValue === "" && (!core.inputControlled || !core.valueControlled)) writeValue(core, null);
  }
  // If the value changed, update the input value.
  // Do nothing if both inputValue and value are controlled.
  // In this case, it's the user's responsibility to update inputValue in onSelectionChange.
  if (displayValue !== last && (!core.inputControlled || !core.valueControlled)) resetInputValue(core);
  else if (lastValue !== inputValue) core.lastValue.set(inputValue);
  // Update the inputValue if the selected item's text changes from its last tracked value (async
  // items, renamed item). Only while the user is outside the field; not with a controlled inputValue.
  const selectedKey = single ? ((displayValue as Key | null) ?? null) : null;
  const selectedItemText = itemText(core, selectedKey);
  if (!isFocused && selectedKey != null && !core.inputControlled && selectedKey === last) {
    if (core.lastSelectedKeyText() !== selectedItemText) {
      core.lastValue.set(selectedItemText);
      writeInputValue(core, selectedItemText);
    }
  }
  core.lastDisplayValue.set(displayValue);
  core.lastSelectedKeyText.set(selectedItemText);
  syncDerived(core);
}
