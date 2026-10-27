// Ported from React Aria (@react-aria/select useSelect, HiddenSelect useHiddenSelect; @react-aria/menu
// useMenuTrigger with type "listbox"), Apache-2.0, © Adobe.
//
// Select behaviour: handler bodies for the trigger button (press / keyboard of useMenuTrigger, typeahead
// and ArrowLeft / ArrowRight of useSelect on the closed trigger), the label, the listbox in the popover
// (useListBox + the select's selection rules) and the hidden native <select> (autofill, form value,
// native validation, form reset). The closed trigger works from the data items (`selectCollection`);
// the open popover renders the RAC ListBox over the select's list state (`selectListChange`, `selectListBlur`).
import { untrack, type Signal } from "@rivetjs/reactivity";
import { getSearchCollator, ListKeyboardDelegate, type Key, type Selection } from "../_adapters/collections.ts";
import { typeSelectKeyDown } from "../_adapters/type-select.ts";
import type { SelectableCollection } from "../_adapters/selection.ts";
import { isFocusVisible, noteModality, setInteractionModality } from "../interactions/focus-visible.tsx";
import { isVirtualClick } from "../platform/index.ts";
import { focusWithoutScrolling } from "../utils/index.ts";
import { pointerTypeOf } from "../selection/dom-utils.ts";
import type { SelectionManager } from "../_adapters/selection-manager.ts";
import { commitValidation } from "../state/form-validation.ts";
import { commit, onFormReset, validationChange, validationInvalid } from "../form/behaviour.ts";
import { fieldProps } from "../label/behaviour.ts";
import { closeOverlay } from "../state/overlays.ts";
import {
  openSelect,
  selectCollection,
  selectItems,
  selectedKeys,
  selectValue,
  setSelectValue,
  toggleSelect,
  type FocusStrategy,
  type SelectionMode,
  type SelectState,
  isSelectDisabled,
  isSelectRequired,
} from "../state/select.ts";

type AnySelect = SelectState<SelectionMode>;

/** Part ids (useSelect: trigger = field, value = SelectValue, listbox = the menu). */
export const triggerId = (state: { id: string }): string => state.id + "-trigger";
export const labelId = (state: { id: string }): string => triggerId(state) + "-label";
export const valueId = (state: { id: string }): string => state.id + "-value";
export const listId = (state: { id: string }): string => state.id + "-listbox";
export const popoverId = (state: { id: string }): string => state.id + "-popover";
export const hiddenId = (state: { id: string }): string => state.id + "-hidden";

/** Props of `selectProps` (react-aria `AriaSelectOptions`: the labelling part). */
export interface SelectAriaProps {
  /** Visible label (RA `label`): whether a label element labels the trigger. */
  label?: unknown;
  /** Description (RA `description`): reserves the description id. */
  description?: unknown;
  "aria-label"?: string | undefined;
  "aria-labelledby"?: string | undefined;
  "aria-describedby"?: string | undefined;
}

/**
 * `isDisabled` for attribute / context bags (live props P5): the live accessor when the select's `isDisabled` is one
 * (a returned arrow: resumable), else the creation value.
 */
export function selectDisabled(state: SelectState<SelectionMode>): boolean | (() => boolean) {
  return state.disabled ? liveSelectDisabled(state) : state.isDisabled;
}
function liveSelectDisabled(state: SelectState<SelectionMode>): () => boolean {
  return () => isSelectDisabled(state);
}
/** `data-required` for a spread / render bag: an accessor when live (returned arrow), else the value. */
export function selectRequiredAttr(state: SelectState<SelectionMode>): "true" | undefined | (() => "true" | undefined) {
  return state.required ? liveSelectRequiredAttr(state) : state.isRequired ? "true" : undefined;
}
function liveSelectRequiredAttr(state: SelectState<SelectionMode>): () => "true" | undefined {
  return () => (isSelectRequired(state) ? "true" : undefined);
}
/** `data-disabled` for a spread / render bag: an accessor when live (returned arrow), else the value. */
export function selectDisabledAttr(state: SelectState<SelectionMode>): "true" | undefined | (() => "true" | undefined) {
  return state.disabled ? liveSelectDisabledAttr(state) : state.isDisabled ? "true" : undefined;
}
function liveSelectDisabledAttr(state: SelectState<SelectionMode>): () => "true" | undefined {
  return () => (isSelectDisabled(state) ? "true" : undefined);
}

/**
 * react-aria `useSelect` attribute bags (same keys as RA). Ids and ARIA attributes only: the handlers
 * are the exported free functions (`selectTriggerKeyDown`, `selectListEvent`, …), attached as inline
 * arrows so they resume. Reactive values are accessors (`triggerProps["aria-expanded"]()`).
 */
export function selectProps(props: SelectAriaProps, state: AnySelect) {
  const ids = fieldProps({
    id: triggerId(state),
    label: props.label,
    description: props.description,
    labelElementType: "span",
    "aria-label": props["aria-label"],
    "aria-labelledby": props["aria-labelledby"],
    "aria-describedby": props["aria-describedby"],
  });
  const fieldLabelledBy = ids.fieldProps["aria-labelledby"];
  const ariaLabel = ids.fieldProps["aria-label"];
  const self = ariaLabel && !fieldLabelledBy ? triggerId(state) : null;
  return {
    ids,
    labelProps: { id: ids.labelProps.id ?? labelId(state) },
    triggerProps: {
      id: triggerId(state),
      "aria-haspopup": "listbox" as const,
      "aria-expanded": () => (state.isOpen() ? "true" : "false"),
      "aria-controls": () => (state.isOpen() ? listId(state) : undefined),
      "aria-label": ariaLabel,
      // useSelect: the trigger is labelled by the value, then the label (or itself with aria-label).
      "aria-labelledby": [valueId(state), fieldLabelledBy, self].filter(Boolean).join(" "),
      isDisabled: selectDisabled(state),
    },
    valueProps: { id: valueId(state) },
    menuProps: {
      id: listId(state),
      "aria-labelledby": [fieldLabelledBy, self].filter(Boolean).join(" ") || undefined,
      autoFocus: () => untrack(state.focusStrategy) || true,
      shouldSelectOnPressUp: true,
      shouldFocusOnHover: true,
      disallowEmptySelection: true,
      linkBehavior: "selection" as const,
    },
    descriptionProps: { id: ids.descriptionId },
    errorMessageProps: { id: ids.errorMessageId },
    hiddenSelectProps: { isDisabled: selectDisabled(state), name: state.name, form: state.form, state },
  };
}

/** Keys the closed trigger handles (`data-rk`: a cold arrow key does not scroll the page while code loads). */
export const TRIGGER_KEYS = "Enter Space ArrowDown ArrowUp ArrowLeft ArrowRight";

/** Field callbacks of useSelect (`onFocus`, `onBlur`, `onFocusChange`, `onKeyDown`, `onKeyUp`). */
export interface SelectCallbacks {
  onFocus?: ((event: FocusEvent) => void) | undefined;
  onBlur?: ((event: FocusEvent) => void) | undefined;
  onFocusChange?: ((isFocused: boolean) => void) | undefined;
  onKeyDown?: ((event: KeyboardEvent) => void) | undefined;
  onKeyUp?: ((event: KeyboardEvent) => void) | undefined;
}

const triggerOf = (state: AnySelect, from: Element | Document): HTMLElement | null =>
  ("ownerDocument" in from && from.ownerDocument ? from.ownerDocument : (from as Document)).getElementById(triggerId(state));

// Keyboard presses of the trigger (Enter / Space): their activation click is not a virtual press.
const keyboardPresses = new WeakSet<object>();

/** useSelect's keyboard delegate over the data items (no DOM: the menu is closed). */
function triggerDelegate(state: AnySelect): ListKeyboardDelegate {
  // Disabled = `disabledKeys` + the items' own `isDisabled` (RAC parts: `<ListBoxItem isDisabled>`).
  const disabledKeys = new Set<Key>(state.disabledKeys);
  for (const item of selectItems(state)) if (item.disabled) disabledKeys.add(item.key);
  return new ListKeyboardDelegate({ collection: selectCollection(state), disabledKeys, ref: null, collator: getSearchCollator() });
}

/**
 * The listbox selection is the select value (useSelectState `selectedKeys: convertValue(value)`). The list's
 * selection state is controlled (the ListBox never writes it): this writes the value's keys into its signal
 * (a serializable state; a derived signal is not). Run from an effect while the popover content renders (the
 * menu opened however: trigger, `isOpen`, `openSelect`; a value written outside while open) and after each
 * listbox selection change. `keys`: pass `selectedKeys(state)` read in the effect to track the value.
 */
export function syncListSelection(state: AnySelect, listKeys: Signal<Selection>, keys: readonly Key[] = untrack(() => selectedKeys(state))): void {
  const current = untrack(listKeys);
  if (current !== "all" && current.size === keys.length && keys.every((key) => current.has(key))) return;
  listKeys.set(new Set(keys));
}

/** useMenuTrigger `state.open(focusStrategy)` / `state.toggle(focusStrategy)`. */
export function selectOpen(state: AnySelect, focusStrategy: FocusStrategy | null, toggle = false): void {
  if (toggle) toggleSelect(state, focusStrategy);
  else openSelect(state, focusStrategy);
}

/** keydown on the trigger: typeahead (single), Enter / Space / ArrowDown / ArrowUp open, ArrowLeft / ArrowRight select. */
/** useTypeSelect on the closed trigger (single selection): the manager is the trigger's focused key. */
function triggerTypeSelect(state: AnySelect, trigger: HTMLElement, event: KeyboardEvent, delegate = triggerDelegate(state)): boolean {
  const manager = {
    get focusedKey() {
      return untrack(state.focusedKey);
    },
    setFocusedKey(key: Key | null) {
      state.focusedKey.set(key);
    },
  } as unknown as SelectionManager;
  if (!typeSelectKeyDown(state as unknown as SelectableCollection, trigger, manager, delegate, event, (key) => setSelectValue(state, key))) return false;
  if (event.key === " ") keyboardPresses.add(state); // keyup: no native activation either
  return true;
}

/**
 * useTypeSelect `onKeyDownCapture` of a parts-form trigger (`<Button>`), on the Select root: a Space continuing a
 * search is consumed before the Button's press sees it (RA: capture handler + stopPropagation on the trigger).
 */
export function selectTriggerKeyDownCapture(state: AnySelect, event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null;
  if (event.key !== " " || isSelectDisabled(state) || state.selectionMode !== "single" || !target || target.id !== triggerId(state)) return;
  triggerTypeSelect(state, target, event);
}

export function selectTriggerKeyDown(state: AnySelect, event: KeyboardEvent & { currentTarget: HTMLElement }, callbacks: SelectCallbacks = {}): void {
  noteModality(event);
  if (isSelectDisabled(state)) return;
  const trigger = event.currentTarget;
  const single = state.selectionMode === "single";
  const delegate = triggerDelegate(state);
  // useTypeSelect (single selection only): onKeyDownCapture: a key typeahead consumes stops propagation, so no
  // trigger shortcut runs.
  if (single && triggerTypeSelect(state, trigger, event, delegate)) return;
  // useMenuTrigger (useKeyboard shortcuts). No `defaultPrevented` check, as upstream: the loader holds
  // a cold Space / Enter (`data-rk`) and the handler still opens.
  const open = (focusStrategy: FocusStrategy) => {
    event.preventDefault();
    selectOpen(state, focusStrategy, true);
  };
  switch (event.key) {
    case "Enter":
    case " ":
      // usePress: a keyboard press never activates natively (keyup / click are ours).
      keyboardPresses.add(state);
      open("first");
      break;
    case "ArrowDown":
      open("first");
      break;
    case "ArrowUp":
      open("last");
      break;
    // useSelect: ArrowLeft / ArrowRight move the selection while closed (single selection).
    case "ArrowLeft":
    case "ArrowRight": {
      if (!single || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) break;
      event.preventDefault();
      const current = untrack(() => selectedKeys(state))[0] ?? null;
      const key = current != null ? (event.key === "ArrowLeft" ? delegate.getKeyAbove(current) : delegate.getKeyBelow(current)) : delegate.getFirstKey();
      if (key != null) setSelectValue(state, key);
      break;
    }
  }
  callbacks.onKeyDown?.(event);
}

/** keyup on the trigger: Space activation is ours (no native click). */
export function selectTriggerKeyUp(state: AnySelect, event: KeyboardEvent, callbacks: SelectCallbacks = {}): void {
  if ((event.key === " " || event.key === "Enter") && keyboardPresses.has(state)) {
    event.preventDefault();
    keyboardPresses.delete(state);
  }
  callbacks.onKeyUp?.(event);
}

/** pointerdown on the trigger: mouse / pen open on press start (useMenuTrigger `onPressStart`). */
export function selectTriggerPointerDown(state: AnySelect, event: PointerEvent & { currentTarget: HTMLElement }): void {
  noteModality(event);
  keyboardPresses.delete(state);
  if (event.button !== 0 || isSelectDisabled(state)) return;
  const type = pointerTypeOf(event);
  if (type === "touch" || type === "virtual") return;
  // Ensure the trigger has focus before opening so FocusScope restores it on close.
  focusWithoutScrolling(event.currentTarget);
  selectOpen(state, null);
}

/**
 * useMenuTrigger `onPressStart` (RAC parts: the `<Button>` of a Select gets it through `ButtonContext`): mouse / pen
 * open on press start (focus the trigger first so FocusScope restores it), a virtual press opens on the first item.
 */
export function selectTriggerPressStart(state: AnySelect, event: { pointerType: string; target: EventTarget | null }): void {
  if (event.pointerType !== "touch" && event.pointerType !== "keyboard" && !isSelectDisabled(state)) {
    focusWithoutScrolling(event.target as HTMLElement);
    selectOpen(state, event.pointerType === "virtual" ? "first" : null);
  }
}

/** useMenuTrigger `onPress`: touch toggles on press up. */
export function selectTriggerPress(state: AnySelect, event: { pointerType: string; target: EventTarget | null }): void {
  if (event.pointerType === "touch" && !isSelectDisabled(state)) {
    focusWithoutScrolling(event.target as HTMLElement);
    selectOpen(state, null, true);
  }
}

/** mousedown on the trigger: preventFocusOnPress (the pointerdown handler focused it already). */
export function selectTriggerMouseDown(event: MouseEvent): void {
  if (event.button === 0) event.preventDefault();
}

/** click on the trigger: touch toggles (press up), screen reader clicks open on the first item. */
export function selectTriggerClick(state: AnySelect, event: MouseEvent & { currentTarget: HTMLElement }): void {
  if (keyboardPresses.has(state)) {
    keyboardPresses.delete(state);
    event.preventDefault();
    return;
  }
  if (isSelectDisabled(state)) return;
  if (isVirtualClick(event)) {
    focusWithoutScrolling(event.currentTarget);
    selectOpen(state, "first");
  } else if ((event as unknown as PointerEvent).pointerType === "touch") {
    focusWithoutScrolling(event.currentTarget);
    selectOpen(state, null, true);
  }
}

/** focus on the trigger (useSelect `onFocus`). */
export function selectTriggerFocus(state: AnySelect, event: FocusEvent, callbacks: SelectCallbacks = {}): void {
  if (untrack(state.isFocused)) return;
  callbacks.onFocus?.(event);
  callbacks.onFocusChange?.(true);
  state.isFocused.set(true);
}

/** blur on the trigger (useSelect `onBlur`): not while the menu is open (focus moved into it). */
export function selectTriggerBlur(state: AnySelect, event: FocusEvent, callbacks: SelectCallbacks = {}): void {
  if (untrack(state.isOpen)) return;
  callbacks.onBlur?.(event);
  callbacks.onFocusChange?.(false);
  state.isFocused.set(false);
}

/** click on the label: focus the trigger and show its focus ring. */
export function selectLabelClick(state: AnySelect, event: MouseEvent & { currentTarget: HTMLElement }): void {
  if (isSelectDisabled(state)) return;
  triggerOf(state, event.currentTarget)?.focus();
  setInteractionModality("keyboard");
}

/** focusin / focusout on the Select root (useFocusRing `within`). */
export function selectFocusWithin(state: AnySelect, event: FocusEvent & { currentTarget: HTMLElement }): void {
  if (event.type === "focusin") state.isFocusVisible.set(isFocusVisible());
  else if (!event.currentTarget.contains(event.relatedTarget as Node | null)) state.isFocusVisible.set(false);
}

/**
 * useSelect `menuProps.onBlur` (the ListBox's `onBlur`: focus left the listbox element). Focus moving inside the
 * popover or back to the select (closing restores focus to the trigger, FocusScope `restoreFocus`) is not the
 * select losing focus — one focus / blur pair per focus, as upstream where the unmounted menu never blurs. Focus
 * to nowhere (the listbox removed on close, an option removed, a click on a non-focusable part) is checked once
 * focus settles.
 */
export function selectListBlur(state: AnySelect, event: FocusEvent, callbacks: SelectCallbacks = {}): void {
  const root = event.currentTarget as HTMLElement;
  const doc = root.ownerDocument;
  const related = event.relatedTarget as Node | null;
  const within = (node: Node | null): boolean => {
    if (node == null) return false;
    if (root.contains(node) || !!doc.getElementById(popoverId(state))?.contains(node)) return true;
    const trigger = doc.getElementById(triggerId(state));
    return !!trigger && (trigger === node || !!trigger.parentElement?.contains(node));
  };
  const blur = () => {
    if (!untrack(state.isFocused)) return;
    callbacks.onBlur?.(event);
    callbacks.onFocusChange?.(false);
    state.isFocused.set(false);
  };
  if (related != null) {
    if (!within(related)) blur();
    return;
  }
  setTimeout(() => {
    const active = doc.activeElement;
    if (!within(active) && !untrack(state.isOpen)) blur();
  }, 0);
}

/**
 * useSelectState's listbox `onSelectionChange`: set the value, mirror it into the list selection (controlled),
 * close when `shouldCloseOnSelect`, and commit validation against the hidden field. `root`: an element of the
 * select (its document holds the hidden field); without it only the state commits.
 */
export function selectListChange(state: AnySelect, listKeys: Signal<Selection>, keys: Selection, root: Element | null | undefined): void {
  if (keys === "all") return;
  if (state.selectionMode === "single") setSelectValue(state, keys.values().next().value ?? null);
  else setSelectValue(state, [...keys]);
  syncListSelection(state, listKeys);
  if (state.shouldCloseOnSelect) closeOverlay(state);
  if (root) commitSelect(state, root.ownerDocument);
  else commitValidation(state.validation);
}

/** Commit the validation (`validationState.commitValidation()`) against the hidden native field. */
export function commitSelect(state: AnySelect, doc: Document): void {
  const field = doc.getElementById(hiddenId(state)) as HTMLSelectElement | HTMLInputElement | null;
  if (field) {
    syncHiddenField(state, field);
    hiddenSelectReset(state, field);
  }
  commit(state.validation, field);
}

/** Write the value into the hidden field now (its bindings flush later) so native validity is current. */
export function syncHiddenField(state: AnySelect, field: HTMLSelectElement | HTMLInputElement): void {
  const keys = untrack(() => selectedKeys(state)).map(String);
  if (field.tagName === "SELECT") {
    const select = field as HTMLSelectElement;
    for (const option of select.options) option.selected = option.value === "" ? keys.length === 0 && !select.multiple : keys.includes(option.value);
  } else field.value = keys[0] ?? "";
}

// --- HiddenSelect (useHiddenSelect) ----------------------------------------------------------

/** change / input on the hidden <select> (browser autofill): set the value; `change` commits validation. */
export function hiddenSelectChange(state: AnySelect, event: Event & { currentTarget: HTMLSelectElement }): void {
  const select = event.currentTarget;
  hiddenSelectReset(state, select);
  if (select.multiple)
    setSelectValue(
      state,
      Array.from(select.selectedOptions, (option) => option.value),
    );
  else setSelectValue(state, select.value);
  if (event.type === "change") validationChange(state.validation, select);
}

/** invalid on the hidden field (submit / checkValidity): commit, focus the trigger, no browser bubble. */
export function hiddenSelectInvalid(state: AnySelect, event: Event & { currentTarget: HTMLElement }): void {
  hiddenSelectReset(state, event.currentTarget as HTMLSelectElement);
  validationInvalid(state.validation, event, () => triggerOf(state, event.currentTarget)?.focus());
}

/** useFormReset: a form reset restores the default value. */
export function hiddenSelectReset(state: AnySelect, field: HTMLSelectElement | HTMLInputElement): void {
  onFormReset(state, field, () => setSelectValue(state, state.defaultValue as Key | readonly Key[] | null));
}

// --- Value helpers (Rivet extras over useSelectState `setValue`, for parts outside the listbox) ----

/**
 * Set the value from outside the listbox (a chip's remove button, a clear button) and commit validation.
 * `event`: the handler's event — its document holds the hidden field, so native validity is synced
 * before the commit; without it only the state commits (native validity syncs at the next submit).
 */
function setFromOutside(state: AnySelect, value: Key | readonly Key[] | null, event: Event | undefined): void {
  setSelectValue(state, value);
  const doc = (event?.currentTarget as Node | null | undefined)?.ownerDocument ?? (event?.target as Node | null | undefined)?.ownerDocument;
  if (doc) commitSelect(state, doc);
  else commitValidation(state.validation);
}

/** Removes `keys` from the value (single: clears it when the key matches); `onChange`, commits validation. */
export function removeSelected(state: AnySelect, keys: Key | Iterable<Key>, event?: Event): void {
  const remove = new Set<Key>(typeof keys === "object" && keys != null && Symbol.iterator in keys ? keys : [keys as Key]);
  const current = untrack(() => selectedKeys(state));
  const next = current.filter((key) => !remove.has(key));
  if (next.length === current.length) return;
  setFromOutside(state, state.selectionMode === "single" ? null : next, event);
}

/** Clears the value (single: `null`, multiple: `[]`); `onChange`, commits validation. */
export function clearSelection(state: AnySelect, event?: Event): void {
  if (untrack(() => selectedKeys(state)).length === 0) return;
  setFromOutside(state, state.selectionMode === "single" ? null : [], event);
}

/** Toggles `key` (single: selects it, or clears when it is the value); `onChange`, commits validation. */
export function toggleSelected(state: AnySelect, key: Key, event?: Event): void {
  const current = untrack(() => selectedKeys(state));
  const has = current.includes(key);
  if (state.selectionMode === "single") setFromOutside(state, has ? null : key, event);
  else setFromOutside(state, has ? current.filter((k) => k !== key) : [...current, key], event);
}

/** Whether `key` is part of the value (binding accessor: hidden options, `selected`). */
export const isValueKey = (state: AnySelect, key: Key): boolean => {
  // Per hidden `<option>` binding (≤ 300 per select, all re-run on a selection change): reads the value in place —
  // no `selectedKeys` copy, one `String(key)` (was a copy + two `String` calls per compared key).
  const value = selectValue(state) as Key | readonly Key[] | null;
  if (value == null) return false;
  const want = String(key);
  if (!Array.isArray(value)) return String(value) === want;
  for (let i = 0; i < value.length; i++) if (String(value[i]) === want) return true;
  return false;
};
