// Ported from React Stately (@react-stately/select useSelectState), Apache-2.0, © Adobe.
//
// Select state: the overlay (open) state, the value (single key or keys), focus flags and form
// validation. Signals + JSON only (resumable); the methods are free functions taking the state. The
// collection is the data items (`items`): the closed trigger needs it for typeahead and the arrow
// keys, the hidden `<select>` for its options, SelectValue for the selected items' text. RAC parts mode (no
// `items`): `collection` = the Select's built collection (react-stately `useSelectState({ collection })`); its
// item nodes are read as data entries (`selectEntries`), `value` = the node's object value, `content` = its children.
import { signal, untrack, _regionState, type Signal } from "@rivetjs/reactivity";
import { controllable, setControlledValue, type ControlledState } from "../interactions/controllable.ts";
import { createId } from "@rivetjs/cdk/id";
import { buildNodes, ListCollection, type FocusStrategy } from "../_adapters/collections.ts";
import { createOverlayTriggerState, openOverlay, toggleOverlay, type OverlayTriggerProps, type OverlayTriggerState } from "./overlays.ts";
import {
  createFormValidationState,
  type FormValidationState,
  type MaybeAccessor,
  type ValidationBehavior,
  type ValidationErrors,
  type ValidationFunction,
} from "./form-validation.ts";
import { flatItems, type CollectionEntry, type Item, type Key } from "./list.ts";
import type { Collection as BuiltCollection, Node as BuiltNode, SelectionMode as SharedSelectionMode } from "../collections/types.ts";

export type { Key, Item, CollectionEntry, FocusStrategy };

/** Select has no `"none"` mode (react-stately `SelectProps`); derived from the shared `SelectionMode`. */
export type SelectionMode = Exclude<SharedSelectionMode, "none">;
export type ValueType<M extends SelectionMode> = M extends "single" ? Key | null : readonly Key[];
export type ChangeValueType<M extends SelectionMode> = M extends "single" ? Key | null : Key[];
type ValidationType<M extends SelectionMode> = M extends "single" ? Key : Key[];

export interface SelectStateProps<M extends SelectionMode = "single"> extends OverlayTriggerProps {
  /** Items and sections (RAC `<ListBox items>`); a function for items that change. */
  items?: readonly CollectionEntry[] | (() => readonly CollectionEntry[]) | undefined;
  /**
   * RAC parts mode: the collection built from the Select's children (`collectionOf`, the ListBox items), as an
   * accessor (an inline arrow: region state keeps it). Items are read from it when `items` is not given.
   */
  collection?: (() => BuiltCollection<BuiltNode<unknown>>) | undefined;
  /** Whether single or multiple selection is enabled. @default 'single'. Read once at mount (picks the value shape). */
  selectionMode?: M;
  /** The current value (controlled): a plain value (shown until the caller re-renders; `onChange` reports changes) or a two-way Signal. */
  value?: ValueType<M> | Signal<ValueType<M>>;
  /** The default value (uncontrolled). */
  defaultValue?: ValueType<M>;
  /** Handler that is called when the value changes (resumed pages: an inline arrow or a local function). */
  onChange?: (value: ChangeValueType<M>) => void;
  /** @deprecated use `value`. The currently selected key in the collection (controlled): plain or a two-way Signal. */
  selectedKey?: Key | null | Signal<Key | null>;
  /** @deprecated use `defaultValue`. The initial selected key in the collection (uncontrolled). */
  defaultSelectedKey?: Key | null;
  /** @deprecated use `onChange`. Handler that is called when the selection changes. */
  onSelectionChange?: (key: Key | null) => void;
  /**
   * The item keys that are disabled. These items cannot be selected, focused, or otherwise interacted with. Read once
   * at mount (the listbox's selection manager copies them); a live item uses `ListBoxItem isDisabled={…}`.
   */
  disabledKeys?: Iterable<Key>;
  /** Whether the Select should close when an item is selected. Defaults to true if selectionMode is single, false otherwise. Read once at mount. */
  shouldCloseOnSelect?: boolean;
  /** Whether the select should be allowed to be open when the collection is empty. Read once at mount. */
  allowsEmptyCollection?: boolean;
  /** Whether the select is disabled. Rivet (live props): the parts pass an accessor that stays live (internal). */
  isDisabled?: boolean;
  /** Whether a value is required. Rivet (live props): the parts pass an accessor that stays live (internal). */
  isRequired?: boolean;
  /** Controlled invalid state; an accessor stays live. */
  isInvalid?: MaybeAccessor<boolean | undefined>;
  validate?: ValidationFunction<ValidationType<M>>;
  /** @default 'aria' (the Select component defaults to 'native', RAC) */
  validationBehavior?: ValidationBehavior;
  /** The name of the hidden select submitted with a form. Read once at mount (form identity). */
  name?: string;
  /** The `<form>` id of the hidden select. Read once at mount. */
  form?: string;
  /** Server errors (from `<Form validationErrors>`). */
  validationErrors?: MaybeAccessor<ValidationErrors | undefined>;
  /** Base id of the parts (`<id>-trigger`, `<id>-listbox`, …); generated when omitted. */
  id?: string;
}

export interface SelectState<M extends SelectionMode = "single"> extends OverlayTriggerState {
  readonly id: string;
  readonly selectionMode: M;
  /** The value: a key (single) or keys (multiple). A single select given an array shows its first key. Read-only: write with `setSelectValue`. */
  readonly value: Signal<Key | null | readonly Key[]>;
  /** useControlledState of the value (plain controlled / Signal / uncontrolled + `onChange`). */
  readonly control: ControlledState<Key | null | readonly Key[], any>;
  /** The value restored on form reset (`defaultValue` ?? the initial value). */
  readonly defaultValue: ValueType<M>;
  readonly items: SelectStateProps<M>["items"];
  /** RAC parts mode: the built collection accessor (see `SelectStateProps.collection`). */
  readonly collection?: SelectStateProps<M>["collection"];
  readonly disabledKeys: readonly Key[];
  readonly shouldCloseOnSelect: boolean;
  readonly allowsEmptyCollection: boolean;
  readonly isDisabled: boolean;
  /** Rivet: the caller's `isDisabled` accessor (live props), when it passed one; read `isSelectDisabled(state)`. */
  readonly disabled?: () => boolean | undefined;
  readonly isRequired: boolean;
  /** Rivet: the caller's `isRequired` accessor (live props), when it passed one; read `isSelectRequired(state)`. */
  readonly required?: () => boolean | undefined;
  readonly name?: string | undefined;
  readonly form?: string | undefined;
  /** Controls which item will be auto focused when the menu opens. */
  readonly focusStrategy: Signal<FocusStrategy | null>;
  /** Whether the select is currently focused. */
  readonly isFocused: Signal<boolean>;
  /** Whether focus is keyboard focus (RAC `useFocusRing({within: true})`). */
  readonly isFocusVisible: Signal<boolean>;
  /** Focused key of the closed trigger's typeahead (react-stately: the list's `focusedKey`). */
  readonly focusedKey: Signal<Key | null>;
  readonly validation: FormValidationState;
  readonly onSelectionChange?: ((key: Key | null) => void) | undefined;
}

/**
 * Provides state management for a select component (react-stately `useSelectState`). Handles the
 * open state for the popup menu and the single / multiple value. Region state: a resumed page
 * re-creating the select's region keeps it.
 */
export function createSelectState<M extends SelectionMode = "single">(props: SelectStateProps<M>): SelectState<M> {
  return _regionState(() => {
    const selectionMode = (props.selectionMode ?? "single") as M;
    const single = selectionMode === "single";
    // Rivet (live props): the parts pass a live `isDisabled` accessor (the public type stays boolean).
    const givenDisabled = props.isDisabled as boolean | (() => boolean | undefined) | undefined;
    const givenRequired = props.isRequired as boolean | (() => boolean | undefined) | undefined;
    const read = (v: boolean | (() => boolean | undefined) | undefined) => (typeof v === "function" ? v() : v);
    const defaultValue = (props.defaultValue !== undefined ? props.defaultValue : single ? (props.defaultSelectedKey ?? null) : []) as ValueType<M>;
    // useSelectState: `value` wins over the deprecated `selectedKey` (single only); undefined = uncontrolled.
    const controlled = (props.value !== undefined ? props.value : single ? props.selectedKey : undefined) as
      Key | null | readonly Key[] | Signal<Key | null | readonly Key[]> | undefined;
    const control = controllable<Key | null | readonly Key[], any>(controlled, defaultValue, props.onChange as ((value: any) => void) | undefined);
    const value = control.value;
    const initial = untrack(value);
    return {
      ...createOverlayTriggerState(props),
      id: props.id ?? createId(),
      selectionMode,
      value,
      control,
      defaultValue: (defaultValue ?? initial) as ValueType<M>,
      items: props.items,
      ...(props.collection ? { collection: props.collection } : {}),
      disabledKeys: [...(props.disabledKeys ?? [])],
      shouldCloseOnSelect: props.shouldCloseOnSelect ?? single,
      allowsEmptyCollection: !!props.allowsEmptyCollection,
      isDisabled: !!untrack(() => read(givenDisabled)),
      ...(typeof givenDisabled === "function" ? { disabled: givenDisabled } : {}),
      isRequired: !!untrack(() => read(givenRequired)),
      ...(typeof givenRequired === "function" ? { required: givenRequired } : {}),
      ...(props.name !== undefined ? { name: props.name } : {}),
      ...(props.form !== undefined ? { form: props.form } : {}),
      focusStrategy: signal<FocusStrategy | null>(null),
      isFocused: signal(false),
      isFocusVisible: signal(false),
      focusedKey: signal<Key | null>(null),
      validation: createFormValidationState<unknown>({
        isInvalid: props.isInvalid,
        validate: props.validate as ValidationFunction<unknown> | undefined,
        validationBehavior: props.validationBehavior ?? "aria",
        name: props.name,
        validationErrors: props.validationErrors,
        value,
      }),
      ...(props.onSelectionChange ? { onSelectionChange: props.onSelectionChange } : {}),
    };
  });
}

/** Whether the select is disabled now (its live `isDisabled` accessor, else the creation value). */
export const isSelectDisabled = (state: { isDisabled: boolean; disabled?: () => boolean | undefined }): boolean =>
  state.disabled ? !!state.disabled() : state.isDisabled;

/** Whether the select is required now (its live `isRequired` accessor, else the creation value). */
export const isSelectRequired = (state: { isRequired: boolean; required?: () => boolean | undefined }): boolean =>
  state.required ? !!state.required() : state.isRequired;

/** The collection entries (reads the items accessor). */
const EMPTY_ENTRIES: readonly CollectionEntry[] = [];

/**
 * A built-collection item read as a data entry (RAC parts mode): `label` / `textValue` = the node's `textValue`,
 * `disabled` = `isDisabled`, plus the node's object `value` and `content` (its children: SelectValue renders them).
 */
export interface BuiltItem extends Item {
  readonly value: unknown;
  readonly content: unknown;
}

const derived = new WeakMap<object, readonly CollectionEntry[]>();

/** The item nodes of a built collection as entries (sections → `{ key, title, children }`), cached per collection. */
export function builtEntries(collection: BuiltCollection<BuiltNode<unknown>>): readonly CollectionEntry[] {
  const cached = derived.get(collection);
  if (cached) return cached;
  const item = (node: BuiltNode<unknown>): BuiltItem => {
    const props = (node.props ?? {}) as { isDisabled?: boolean; href?: string; target?: string; rel?: string; children?: unknown };
    return {
      key: node.key,
      label: node.textValue,
      textValue: node.textValue,
      ...(props.isDisabled ? { disabled: true } : {}),
      ...(props.href ? { href: props.href, target: props.target, rel: props.rel } : {}),
      ...(node["aria-label"] ? { "aria-label": node["aria-label"] } : {}),
      value: node.value,
      content: props.children,
    } as BuiltItem;
  };
  const out: CollectionEntry[] = [];
  for (const node of collection as Iterable<BuiltNode<unknown>>) {
    if (node.type === "item") out.push(item(node));
    else if (node.type === "section") {
      const children: BuiltItem[] = [];
      let title: string | undefined;
      for (const child of collection.getChildren?.(node.key) ?? []) {
        if (child.type === "item") children.push(item(child));
        else if (child.type === "header" && title === undefined) title = child.textValue;
      }
      out.push({ key: node.key, ...(title ? { title } : {}), ...(node["aria-label"] ? { "aria-label": node["aria-label"] } : {}), children });
    }
  }
  derived.set(collection, out);
  return out;
}

/** The data items: `items`, else the built collection's items (RAC parts mode), else none. */
export const selectEntries = (state: SelectState<SelectionMode>): readonly CollectionEntry[] => {
  if (state.items === undefined && state.collection) return builtEntries(state.collection());
  return (typeof state.items === "function" ? state.items() : state.items) ?? EMPTY_ENTRIES;
};

/** Every item (sections flattened). */
export const selectItems = (state: SelectState<SelectionMode>): Item[] => flatItems(selectEntries(state));

/** react-stately `ListCollection` of the items (typeahead, arrow keys, size). */
export const selectCollection = (state: SelectState<SelectionMode>): ListCollection => new ListCollection(buildNodes(selectEntries(state)));

/** The displayed value: the first key when a single select holds an array (reads `value`). */
export function selectValue<M extends SelectionMode>(state: SelectState<M>): ValueType<M> {
  const value = state.value();
  return (state.selectionMode === "single" && Array.isArray(value) ? (value[0] ?? null) : value) as ValueType<M>;
}

/** Selected keys, in value order (react-stately `convertValue`). */
export function selectedKeys(state: SelectState<SelectionMode>): Key[] {
  const value = selectValue(state);
  if (value == null) return [];
  return Array.isArray(value) ? [...value] : [value as Key];
}

/** The key of the first selected item (`selectedKey`). */
export const selectedKey = (state: SelectState<SelectionMode>): Key | null => selectedKeys(state)[0] ?? null;

/** The selected items, in value order (`selectedItems`; keys missing from the collection are skipped). */
export function selectedItems(state: SelectState<SelectionMode>): Item[] {
  return selectedItemsOf(selectEntries(state), selectedKeys(state));
}

/**
 * Rivet helper (no upstream equivalent; `selectedItems` over any data): the items of `keys`, in key
 * order, from entries (sections flattened). For selected items shown outside the Select, from the
 * same items + a shared `value` signal.
 */
export function selectedItemsOf(entries: readonly CollectionEntry[], keys: Iterable<Key> | Key | null | undefined): Item[] {
  const byKey = new Map<Key, Item>();
  for (const item of flatItems(entries ?? EMPTY_ENTRIES)) byKey.set(item.key, item);
  const list = keys == null ? [] : typeof keys === "object" && Symbol.iterator in keys ? [...keys] : [keys as Key];
  return list.map((key) => byKey.get(key)).filter((item): item is Item => item != null);
}

/** Sets the select value (react-stately `setValue` / `setSelectedKey`). */
export function setSelectValue(state: SelectState<SelectionMode>, value: Key | readonly Key[] | null): void {
  const current = untrack(() => selectValue(state));
  if (state.selectionMode === "single") {
    const key = Array.isArray(value) ? ((value as readonly Key[])[0] ?? null) : (value as Key | null);
    // useControlledState: onChange only when the value changes (plain controlled: onChange only).
    setControlledValue(state.control, key);
    if (key !== current) state.onSelectionChange?.(key);
  } else {
    let keys: Key[] = [];
    if (Array.isArray(value)) keys = [...(value as readonly Key[])];
    else if (value != null) keys = [value as Key];
    setControlledValue(state.control, keys);
  }
}

/** Whether the select may open: a non-empty collection, or `allowsEmptyCollection`. */
export const canOpen = (state: SelectState<SelectionMode>): boolean => untrack(() => selectCollection(state).size) !== 0 || state.allowsEmptyCollection;

/** Opens the menu (not when the collection is empty, unless `allowsEmptyCollection`). */
export function openSelect(state: SelectState<SelectionMode>, focusStrategy: FocusStrategy | null = null): void {
  if (!canOpen(state)) return;
  state.focusStrategy.set(focusStrategy);
  openOverlay(state);
}

/** Toggles the menu (not when the collection is empty, unless `allowsEmptyCollection`). */
export function toggleSelect(state: SelectState<SelectionMode>, focusStrategy: FocusStrategy | null = null): void {
  if (!canOpen(state)) return;
  state.focusStrategy.set(focusStrategy);
  toggleOverlay(state);
}
