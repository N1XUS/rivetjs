// Ported from react-stately disclosure/useDisclosureState.ts + disclosure/useDisclosureGroupState.ts
// (packages/react-stately/src/disclosure), Apache-2.0, © Adobe.
//
// Rivet:
// - State = signals + JSON + free functions (methods take the state), so handlers capturing it resume.
// - Controlled values follow useControlledState: a plain value (RAC controlled: never written, every
//   change only calls `on…Change`), a Signal (two-way: written, then `on…Change`) or undefined
//   (uncontrolled: an internal region signal starting at the default).
// - The group's single-expansion clamp runs at creation and on every write instead of in an effect.
// - Angular CDK accordion extras (user decision 2026-10-06: the accordion merges into Disclosure):
//   `allowsMultipleExpanded` may be a Signal (Angular `multi` input), `openAll` / `closeAll` skip
//   disabled disclosures (`registerDisclosure(state, key, isDisabled)`, `unregisterDisclosure`).
// Deviation: group keys compare as strings (`id` props / DOM ids are strings; `1` and `"1"` match).
import { computed, signal, untrack, _regionState, type Signal } from "@rivetjs/reactivity";
import type { Key } from "@rivetjs/cdk/collections";
import { constantCell } from "../interactions/controllable.ts";

export type { Key };

/** Readable (and, when not controlled by a plain value, writable) value cell. */
interface Cell<T> {
  (): T;
  set?: (value: T) => void;
}

const isSignal = <T>(value: unknown): value is Signal<T> => typeof value === "function";

/**
 * useControlledState over signals: `controlled` is true for a plain controlled value (the state is
 * not written; only `onChange` is called).
 */
function cell<T>(value: T | Signal<T> | undefined, defaultValue: T): { value: Signal<T>; controlled: boolean } {
  if (isSignal<T>(value)) return { value, controlled: false };
  if (value !== undefined) return { value: constantCell<T>(value), controlled: true };
  return { value: _regionState(() => signal(defaultValue)), controlled: false };
}

export interface DisclosureProps {
  /** Whether the disclosure is expanded (controlled): a plain value or a two-way Signal. */
  isExpanded?: boolean | Signal<boolean> | (() => boolean);
  /** Whether the disclosure is expanded by default (uncontrolled). */
  defaultExpanded?: boolean;
  /** Handler that is called when the disclosure expanded state changes. */
  onExpandedChange?: (isExpanded: boolean) => void;
}

export interface DisclosureState {
  /** Whether the disclosure is currently expanded (accessor: bind it). */
  readonly isExpanded: Cell<boolean>;
  /** A plain controlled value: never written. */
  readonly controlled: boolean;
  readonly onExpandedChange?: ((isExpanded: boolean) => void) | undefined;
}

/**
 * Manages state for a disclosure widget (react-stately `useDisclosureState`). `isExpanded` may also be
 * a read-only accessor (a `computed`, e.g. the group's `isKeyExpanded`): controlled, not written.
 */
export function createDisclosureState(props: DisclosureProps = {}): DisclosureState {
  const v = props.isExpanded;
  if (typeof v === "function" && !("set" in v)) return { isExpanded: v as Cell<boolean>, controlled: true, onExpandedChange: props.onExpandedChange };
  const c = cell(v as boolean | Signal<boolean> | undefined, props.defaultExpanded || false);
  return { isExpanded: c.value, controlled: c.controlled, onExpandedChange: props.onExpandedChange };
}

/** Sets whether the disclosure is expanded (useControlledState setter: no-op when unchanged). */
export function setExpanded(state: DisclosureState, isExpanded: boolean): void {
  if (untrack(state.isExpanded) === isExpanded) return;
  if (!state.controlled) state.isExpanded.set?.(isExpanded);
  state.onExpandedChange?.(isExpanded);
}
/** Expand the disclosure. */
export const expand = (state: DisclosureState): void => setExpanded(state, true);
/** Collapse the disclosure. */
export const collapse = (state: DisclosureState): void => setExpanded(state, false);
/** Toggles the disclosure's visibility. */
export const toggleDisclosure = (state: DisclosureState): void => setExpanded(state, !untrack(state.isExpanded));

export interface DisclosureGroupProps {
  /** Whether multiple items can be expanded at the same time (Rivet: or a Signal — Angular CDK accordion `multi` — or an accessor: live). */
  allowsMultipleExpanded?: boolean | Signal<boolean> | (() => boolean | undefined);
  /** Whether all items are disabled (a value, or an accessor: live; read with `isGroupDisabled(state)`). */
  isDisabled?: boolean | (() => boolean | undefined);
  /** The currently expanded keys in the group (controlled): a plain iterable, a two-way Signal or a read-only accessor (live prop; never written). */
  expandedKeys?: Iterable<Key> | Signal<Set<Key>> | (() => Set<Key>);
  /** The initial expanded keys in the group (uncontrolled). */
  defaultExpandedKeys?: Iterable<Key>;
  /** Handler that is called when items are expanded or collapsed. */
  onExpandedChange?: (keys: Set<Key>) => unknown;
}

export interface DisclosureGroupState {
  /** Whether multiple items can be expanded at the same time (read with `allowsMultiple(state)`). */
  readonly allowsMultipleExpanded: boolean | Signal<boolean> | (() => boolean | undefined);
  /** Whether all items are disabled, when the state was created (live: `isGroupDisabled(state)`). */
  readonly isDisabled: boolean;
  /** Rivet: the live `isDisabled` accessor (read by `isGroupDisabled`). */
  readonly liveDisabled?: () => boolean | undefined;
  /** A set of keys for items that are expanded (accessor). */
  readonly expandedKeys: Cell<Set<Key>>;
  /** A plain controlled `expandedKeys`: never written. */
  readonly controlled: boolean;
  readonly onExpandedChange?: ((keys: Set<Key>) => unknown) | undefined;
  /** Rivet: keys of the rendered disclosures (Angular CDK accordion `openAll`); filled by `registerDisclosure`. */
  readonly members: Key[];
  /** Rivet: keys of the rendered disabled disclosures (`openAll` / `closeAll` leave them as they are). */
  readonly disabledMembers: Key[];
}

/** Whether multiple items can be expanded at the same time (binding-safe read). */
export const allowsMultiple = (state: DisclosureGroupState): boolean =>
  !!(typeof state.allowsMultipleExpanded === "function" ? state.allowsMultipleExpanded() : state.allowsMultipleExpanded);

/** Whether all items are disabled now (binding-safe read: tracks a live `isDisabled`). */
export const isGroupDisabled = (state: DisclosureGroupState): boolean => (state.liveDisabled ? !!state.liveDisabled() : state.isDisabled);

const clamp = (keys: Set<Key>, multiple: boolean): Set<Key> => (multiple || keys.size <= 1 ? keys : new Set([keys.values().next().value!]));

/** Manages state for a group of disclosures, e.g. an accordion (react-stately `useDisclosureGroupState`). */
export function createDisclosureGroupState(props: DisclosureGroupProps = {}): DisclosureGroupState {
  const allowsMultipleExpanded = props.allowsMultipleExpanded ?? false;
  const multiple = !!untrack(() => (typeof allowsMultipleExpanded === "function" ? allowsMultipleExpanded() : allowsMultipleExpanded));
  const raw = props.expandedKeys;
  const c = isSignal<Set<Key>>(raw)
    ? cell<Set<Key>>(raw, new Set())
    : cell<Set<Key>>(raw !== undefined ? new Set(raw as Iterable<Key>) : undefined, new Set(props.defaultExpandedKeys ?? []));
  const state: DisclosureGroupState = {
    allowsMultipleExpanded,
    isDisabled: typeof props.isDisabled === "function" ? !!untrack(props.isDisabled) : (props.isDisabled ?? false),
    ...(typeof props.isDisabled === "function" ? { liveDisabled: props.isDisabled } : {}),
    expandedKeys: c.value,
    controlled: c.controlled,
    onExpandedChange: props.onExpandedChange,
    members: [],
    disabledMembers: [],
  };
  // Ensure only one item is expanded if allowsMultipleExpanded is false (upstream: an effect).
  const current = untrack(c.value);
  const clamped = clamp(current, multiple);
  if (clamped !== current) setExpandedKeys(state, clamped);
  return state;
}

/** Replaces the set of expanded keys (useControlledState setter + single-expansion clamp). */
export function setExpandedKeys(state: DisclosureGroupState, keys: Set<Key>): void {
  const next = clamp(
    keys,
    untrack(() => allowsMultiple(state)),
  );
  if (Object.is(untrack(state.expandedKeys), next)) return;
  if (!state.controlled) state.expandedKeys.set?.(next);
  state.onExpandedChange?.(next);
}

/** Whether the item `key` is expanded (binding accessor; keys compare as strings). */
export const isKeyExpanded = (state: DisclosureGroupState, key: Key): boolean => {
  for (const k of state.expandedKeys()) if (String(k) === String(key)) return true;
  return false;
};

/** A computed of `isKeyExpanded` (serializable: a Disclosure's controlled `isExpanded` inside a group). */
export const keyExpanded = (state: DisclosureGroupState, key: Key): (() => boolean) => computed(() => isKeyExpanded(state, key));

const has = (keys: Key[], key: Key): boolean => keys.some((k) => String(k) === String(key));
const without = (keys: Key[], key: Key): void => {
  const i = keys.findIndex((k) => String(k) === String(key));
  if (i >= 0) keys.splice(i, 1);
};

/** Rivet: a rendered disclosure joins the group (for `openAll` / `closeAll`, Angular `UniqueSelectionDispatcher`). */
export function registerDisclosure(state: DisclosureGroupState, key: Key, isDisabled = false): void {
  if (!has(state.members, key)) state.members.push(key);
  if (isDisabled && !has(state.disabledMembers, key)) state.disabledMembers.push(key);
}

/** Rivet: a disclosure leaves the group (Angular CDK accordion item destroyed). */
export function unregisterDisclosure(state: DisclosureGroupState, key: Key): void {
  without(state.members, key);
  without(state.disabledMembers, key);
}

/**
 * Rivet (Angular CDK accordion `openAll`): expands every registered enabled disclosure — only when
 * multiple may be expanded; disabled disclosures keep their state.
 */
export function openAll(state: DisclosureGroupState): void {
  if (!untrack(() => allowsMultiple(state))) return;
  const keys = new Set(untrack(state.expandedKeys));
  for (const key of state.members) if (!has(state.disabledMembers, key)) keys.add(key);
  setExpandedKeys(state, keys);
}

/** Rivet (Angular CDK accordion `closeAll`): collapses every enabled disclosure of the group (also in single mode). */
export function closeAll(state: DisclosureGroupState): void {
  setExpandedKeys(state, new Set([...untrack(state.expandedKeys)].filter((key) => has(state.disabledMembers, key))));
}

/** Toggles the expanded state for an item by its key. */
export function toggleKey(state: DisclosureGroupState, key: Key): void {
  const current = untrack(state.expandedKeys);
  const has = untrack(() => isKeyExpanded(state, key));
  let keys: Set<Key>;
  if (untrack(() => allowsMultiple(state))) {
    keys = new Set([...current].filter((k) => String(k) !== String(key)));
    if (!has) keys.add(key);
  } else keys = new Set(has ? [] : [key]);
  setExpandedKeys(state, keys);
}
