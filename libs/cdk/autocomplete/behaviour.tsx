// Ported from react-aria useAutocomplete (packages/react-aria/src/autocomplete/useAutocomplete.ts),
// Apache-2.0, © Adobe.
// Rivet:
// - `useAutocomplete(props, state)` → `autocompleteProps(props, state)` (call during render, from `.tsx`:
//   the returned bags hold inline-arrow handlers / accessors that resumed bindings and contexts capture).
//   Hook-internal handlers are free functions `autocompleteChange` / `autocompleteKeyDown` /
//   `autocompleteKeyUpCapture` / `autocompleteBlur` / `autocompleteFocus` / `autocompletePointerDown` /
//   `autocompleteFocusIn` / `autocompleteBeforeInput` taking `(event, aria, state)`.
// - `aria` = the per-instance serializable part (`AutocompleteAriaState`: collection id, `ref()`s, signals);
//   upstream's refs (`timeout`, `delayNextActiveDescendant`, `queuedActiveDescendant`, `lastInputType`,
//   `keyDownTarget`) are transient browser data in a module WeakMap keyed by it.
// - `hasCollection` = the collection element is attached (`collectionRef()`), or, on the server, true (the
//   wrapped collection renders after the input; React's server HTML lacks the attributes until hydration,
//   a resumed page has no hydration — so the server writes the post-mount state). `shouldUseVirtualFocus`
//   turns off when the attached collection is focusable itself (`tabindex`: no virtual focus support, e.g.
//   Table), read at use time instead of the upstream callback-ref state update.
// - React synthetic event APIs → native: `isPropagationStopped()` = `cancelBubble`, `isDefaultPrevented()` =
//   `defaultPrevented`, `continuePropagation()` = not stopping (native events propagate unless stopped).
// - virtual focus props (`onKeyDown`, `onBlur`, `onFocus`, `onPointerDown`, `aria-activedescendant`) are
//   always passed; they no-op (`aria-activedescendant` undefined) while virtual focus is off or no collection
//   is attached (upstream adds them conditionally per render).
// - Deviation: the collection `focusin` listener → `collectionProps.onFocusIn`, the input `beforeinput`
//   listener → `inputProps.onBeforeInput`, the document capture `keyup` listener is added on keydown and
//   removed after the matching keyup (upstream: for the component's lifetime; it only acts on the keyup
//   matching the last input keydown).
import { signal, type Signal } from "@rivetjs/reactivity";
import { ref as createRef } from "@rivetjs/runtime/dom";
import type { Ref } from "@rivetjs/runtime/jsx-runtime";
import type { Node } from "../collections/types.ts";
import { CLEAR_FOCUS_EVENT, FOCUS_EVENT } from "../selection/selectable-collection.ts";
import { dispatchVirtualBlur, dispatchVirtualFocus, getVirtuallyFocusedElement, moveVirtualFocus } from "../selection/dom-utils.ts";
import { getInteractionModality, getPointerType } from "../interactions/focus-visible.tsx";
import { getActiveElement, getEventTarget, getOwnerDocument } from "../utils/dom.ts";
import { isAndroid, isCtrlKeyPressed, isIOS } from "../platform/index.ts";
import { createMergedId, type MergedId } from "../slots/index.tsx";
import { labelsProps } from "../label/behaviour.ts";
import { formatMessage } from "../_adapters/intl.ts";
import { strings as intlMessages } from "./intl.ts";
import {
  autocompleteInputValue,
  setAutocompleteInputValue,
  setFocusedNodeId,
  type AutocompleteState,
  type AutocompleteStateProps,
} from "../state/autocomplete.ts";
import type { FieldInputContextValue, SelectableCollectionContextValue } from "./contexts.ts";

export interface AriaAutocompleteProps<T> extends AutocompleteStateProps {
  /**
   * An optional filter function used to determine if a option should be included in the autocomplete list.
   * Include this if the items you are providing to your wrapped collection aren't filtered by default.
   */
  filter?: (textValue: string, inputValue: string, node: Node<T>) => boolean;
  /**
   * Whether or not to focus the first item in the collection after a filter is performed. Note this is only
   * applicable if virtual focus behavior is not turned off via `disableVirtualFocus`.
   *
   * @default false
   */
  disableAutoFocusFirst?: boolean;
  /**
   * Whether the autocomplete should disable virtual focus, instead making the wrapped collection directly tabbable.
   *
   * @default false
   */
  disableVirtualFocus?: boolean;
}

/** RAC `AutocompleteProps`. */
export interface AutocompleteProps<T = object> extends AriaAutocompleteProps<T> {
  /** The children wrapped by the autocomplete. Consists of at least an input element and a collection element to filter. */
  children?: unknown;
  slot?: string | null;
}

export interface AriaAutocompleteOptions<T> extends Omit<AriaAutocompleteProps<T>, "children"> {
  /** The ref for the wrapped input element (default: a new `ref()`). */
  inputRef?: Ref<HTMLInputElement>;
  /** The ref for the wrapped collection element (default: a new `ref()`). */
  collectionRef?: Ref<HTMLElement>;
  /** Locale of the default collection label (default "en-US"). */
  locale?: string;
}

/** Per-instance serializable data of `autocompleteProps` (ids, refs, signals). */
export interface AutocompleteAriaState {
  /** The collection id (RA `useId`), merged into the collection's own id when it has one (RA `mergeIds`). */
  readonly collectionId: MergedId;
  readonly inputRef: Ref<HTMLInputElement>;
  readonly collectionRef: Ref<HTMLElement>;
  /** Upstream `shouldUseVirtualFocus` state (initial value). */
  readonly virtualFocus: boolean;
  readonly autoFocusOnMount: Signal<boolean>;
  readonly disableAutoFocusFirst: boolean;
}

export interface AutocompleteAria<T> {
  /** Props for the autocomplete input element (`FieldInputContext`). */
  inputProps: FieldInputContextValue;
  /** Props for the collection (`SelectableCollectionContext`). */
  collectionProps: SelectableCollectionContextValue<T>;
  /** Ref to attach to the wrapped collection. */
  collectionRef: Ref<HTMLElement>;
  /** Ref to attach to the wrapped input. */
  inputRef: Ref<HTMLInputElement>;
  /** A filter function that returns if the provided collection node should be filtered out of the collection. */
  filter?: (nodeTextValue: string, node: Node<T>) => boolean;
  /** @internal the per-instance data the handlers take. */
  aria: AutocompleteAriaState;
}

interface Transient {
  timeout: ReturnType<typeof setTimeout> | undefined;
  delayNextActiveDescendant: boolean;
  queuedActiveDescendant: string | null;
  lastInputType: string;
  keyDownTarget: Element | null;
  keyUp: ((e: KeyboardEvent) => void) | null;
}
const transients = new WeakMap<AutocompleteAriaState, Transient>();
function transient(aria: AutocompleteAriaState): Transient {
  let t = transients.get(aria);
  if (!t) {
    t = { timeout: undefined, delayNextActiveDescendant: false, queuedActiveDescendant: null, lastInputType: "", keyDownTarget: null, keyUp: null };
    transients.set(aria, t);
  }
  return t;
}

/** Whether a collection is connected (attached; true on the server). */
export function autocompleteHasCollection(aria: AutocompleteAriaState): boolean {
  return aria.collectionRef() != null || typeof document === "undefined";
}

/** Whether the input drives the collection with virtual focus (upstream `shouldUseVirtualFocus` state). */
export function autocompleteShouldUseVirtualFocus(aria: AutocompleteAriaState): boolean {
  if (!aria.virtualFocus) return false;
  // If useSelectableCollection isn't passed shouldUseVirtualFocus even when useAutocomplete provides it
  // that means the collection doesn't support it (e.g. Table). If that is the case, we need to disable it here regardless
  // of what the user's provided so that the input doesn't recieve the onKeyDown and autocomplete props.
  const node = aria.collectionRef();
  return !(node && node.getAttribute("tabindex") != null);
}

const virtualFocusActive = (aria: AutocompleteAriaState): boolean => autocompleteShouldUseVirtualFocus(aria) && autocompleteHasCollection(aria);

/**
 * Provides the behavior and accessibility implementation for an autocomplete component. An autocomplete
 * combines a text input with a collection, allowing users to filter the collection's contents match a query.
 */
export function autocompleteProps<T>(props: AriaAutocompleteOptions<T>, state: AutocompleteState): AutocompleteAria<T> {
  const { filter, disableAutoFocusFirst = false, disableVirtualFocus = false } = props;
  // For mobile screen readers, we don't want virtual focus, instead opting to disable FocusScope's restoreFocus and manually
  // moving focus back to the subtriggers
  const isMobileScreenReader = getInteractionModality() === "virtual" && !!(isIOS() || isAndroid());
  const aria: AutocompleteAriaState = {
    collectionId: createMergedId(),
    inputRef: props.inputRef ?? createRef<HTMLInputElement>(),
    collectionRef: props.collectionRef ?? createRef<HTMLElement>(),
    virtualFocus: !isMobileScreenReader && !disableVirtualFocus,
    autoFocusOnMount: signal(false),
    disableAutoFocusFirst,
  };

  const collectionLabels = labelsProps(aria.collectionId.id, formatMessage(intlMessages, props.locale, "collectionLabel"), undefined);

  // Only apply the autocomplete specific behaviors if the collection component wrapped by it is actually
  // being filtered/allows filtering by the Autocomplete.
  const inputProps: FieldInputContextValue = {
    value: () => autocompleteInputValue(state),
    onChange: (value: string) => autocompleteChange(value, aria, state),
    onKeyDown: (e: KeyboardEvent) => {
      if (virtualFocusActive(aria)) autocompleteKeyDown(e, aria, state);
    },
    "aria-activedescendant": () => (virtualFocusActive(aria) ? (state.focusedNodeId() ?? undefined) : undefined),
    onBlur: (e: FocusEvent) => {
      if (virtualFocusActive(aria)) autocompleteBlur(e, aria);
    },
    onFocus: (e: FocusEvent) => {
      if (virtualFocusActive(aria)) autocompleteFocus(e, aria);
    },
    onPointerDown: (e: PointerEvent) => {
      if (virtualFocusActive(aria)) autocompletePointerDown(e, aria, state);
    },
    onBeforeInput: (e: InputEvent) => autocompleteBeforeInput(e, aria),
    enterKeyHint: "go",
    // RA: `collectionId` merged into the collection's own id (mergeIds → idsUpdaterMap re-renders this hook). Rivet: the
    // collection's `contextProps` switches `collectionId.current` to its own id while it renders — also on the server,
    // before this attribute is written — else the rendered collection's id.
    "aria-controls": () => (autocompleteHasCollection(aria) ? aria.collectionRef()?.id || aria.collectionId.current() : undefined),
    // TODO: readd proper logic for completionMode = complete (aria-autocomplete: both)
    "aria-autocomplete": "list",
    // This disable's iOS's autocorrect suggestions, since the autocomplete provides its own suggestions.
    autoCorrect: "off",
    // This disable's the macOS Safari spell check auto corrections.
    spellCheck: "false",
    autoComplete: "off",
  };

  const collectionProps: SelectableCollectionContextValue<T> = {
    ...collectionLabels,
    id: aria.collectionId,
    shouldUseVirtualFocus: () => autocompleteShouldUseVirtualFocus(aria),
    disallowTypeAhead: () => autocompleteShouldUseVirtualFocus(aria),
    autoFocus: () => (aria.autoFocusOnMount() ? "first" : false),
    onFocusIn: (e: FocusEvent) => autocompleteFocusIn(e, aria, state),
  };

  // Object-literal arrow (not a bare ternary branch) so the compiler captures it: ListBox keeps it in resumed state.
  const collectionFilter = { filter: (nodeTextValue: string, node: Node<T>) => filter!(nodeTextValue, autocompleteInputValue(state), node) };

  return {
    inputProps,
    collectionProps,
    collectionRef: aria.collectionRef,
    inputRef: aria.inputRef,
    filter: filter != null ? collectionFilter.filter : undefined,
    aria,
  };
}

/** Upstream `updateActiveDescendantEvent`: the collection's `focusin` (virtual focus moves to an item). */
export function autocompleteFocusIn(e: Event, aria: AutocompleteAriaState, state: AutocompleteState): void {
  const t = transient(aria);
  const input = aria.inputRef();
  // Ensure input is focused if the user clicks on the collection directly.
  // don't trigger on touch so that mobile keyboard doesnt appear when tapping on options
  if (!e.isTrusted && autocompleteShouldUseVirtualFocus(aria) && input && getActiveElement(getOwnerDocument(input)) !== input && getPointerType() !== "touch") {
    input.focus();
  }

  const target = getEventTarget(e) as Element | null;
  if (e.isTrusted || !target || t.queuedActiveDescendant === target.id) {
    return;
  }

  clearTimeout(t.timeout);
  if (target !== aria.collectionRef()) {
    if (t.delayNextActiveDescendant) {
      t.queuedActiveDescendant = target.id;
      t.timeout = setTimeout(() => {
        setFocusedNodeId(state, target.id);
      }, 500);
    } else {
      t.queuedActiveDescendant = target.id;
      setFocusedNodeId(state, target.id);
    }
  } else if (t.queuedActiveDescendant && !getOwnerDocument(input).getElementById(t.queuedActiveDescendant)) {
    // If we recieve a focus event refocusing the collection, either we have newly refocused the input and are waiting for the
    // wrapped collection to refocus the previously focused node if any OR
    // we are in a state where we've filtered to such a point that there aren't any matching items in the collection to focus.
    // In this case we want to clear tracked item if any and clear active descendant
    t.queuedActiveDescendant = null;
    setFocusedNodeId(state, null);
  }

  t.delayNextActiveDescendant = false;
}

/** Upstream `focusFirstItem`. */
export function autocompleteFocusFirstItem(aria: AutocompleteAriaState): void {
  const collection = aria.collectionRef();
  if (!collection) {
    aria.autoFocusOnMount.set(true);
    return;
  }

  transient(aria).delayNextActiveDescendant = true;
  collection.dispatchEvent(
    new CustomEvent(FOCUS_EVENT, {
      cancelable: true,
      bubbles: true,
      detail: {
        focusStrategy: "first",
      },
    }),
  );
}

/** Upstream `clearVirtualFocus`. */
export function autocompleteClearVirtualFocus(aria: AutocompleteAriaState, state: AutocompleteState, clearFocusKey?: boolean): void {
  const t = transient(aria);
  aria.autoFocusOnMount.set(false);
  moveVirtualFocus(getActiveElement());
  t.queuedActiveDescendant = null;
  setFocusedNodeId(state, null);
  const clearFocusEvent = new CustomEvent(CLEAR_FOCUS_EVENT, {
    cancelable: true,
    bubbles: true,
    detail: {
      clearFocusKey,
    },
  });
  clearTimeout(t.timeout);
  t.delayNextActiveDescendant = false;
  aria.collectionRef()?.dispatchEvent(clearFocusEvent);
}

/** Upstream `useEvent(inputRef, 'beforeinput')`. */
export function autocompleteBeforeInput(e: InputEvent, aria: AutocompleteAriaState): void {
  transient(aria).lastInputType = e.inputType;
}

/** Upstream `onChange` (the input's text changed). */
export function autocompleteChange(value: string, aria: AutocompleteAriaState, state: AutocompleteState): void {
  const t = transient(aria);
  const lastInputType = t.lastInputType;
  // Tell wrapped collection to focus the first element in the list when typing forward and to clear focused key when modifying the text via
  // copy paste/backspacing/undo/redo for screen reader announcements
  if (
    (lastInputType === "insertText" ||
      // IME composition (e.g. CJK input) reports 'insertCompositionText'/'insertFromComposition'
      // instead of 'insertText'. Treat these as forward typing so the first item gets virtual focus.
      lastInputType === "insertCompositionText" ||
      lastInputType === "insertFromComposition") &&
    !aria.disableAutoFocusFirst
  ) {
    autocompleteFocusFirstItem(aria);
  } else if (lastInputType && (lastInputType.includes("insert") || lastInputType.includes("delete") || lastInputType.includes("history"))) {
    autocompleteClearVirtualFocus(aria, state, true);

    // If onChange was triggered before the timeout actually updated the activedescendant, we need to fire
    // our own dispatchVirtualFocus so focusVisible gets reapplied on the input
    const input = aria.inputRef();
    if (input && getVirtuallyFocusedElement(getOwnerDocument(input)) === input) {
      dispatchVirtualFocus(input, null);
    }
  }

  setAutocompleteInputValue(state, value);
}

/** Upstream `onKeyDown` (textfield specific keydown operations). */
export function autocompleteKeyDown(e: KeyboardEvent, aria: AutocompleteAriaState, state: AutocompleteState): void {
  const t = transient(aria);
  t.keyDownTarget = getEventTarget(e) as Element;
  listenKeyUp(aria);
  if (e.isComposing) {
    return;
  }

  const input = aria.inputRef();
  let focusedNodeId = t.queuedActiveDescendant;
  if (focusedNodeId !== null && getOwnerDocument(input).getElementById(focusedNodeId) == null) {
    // if the focused id doesn't exist in document, then we need to clear the tracked focused node, otherwise
    // we will be attempting to fire key events on a non-existing node instead of trying to focus the newly swapped wrapped collection.
    // This can happen if you are swapping out the Autocomplete wrapped collection component like in the docs search.
    t.queuedActiveDescendant = null;
    focusedNodeId = null;
  }

  switch (e.key) {
    case "a":
      if (isCtrlKeyPressed(e)) {
        return;
      }
      break;
    case "Escape":
      // Early return for Escape here so it doesn't leak the Escape event from the simulated collection event below and
      // close the dialog prematurely. Ideally that should be up to the discretion of the input element hence the check
      // for isPropagationStopped
      if (e.defaultPrevented) {
        return;
      }
      break;
    case " ":
      // Space shouldn't trigger onAction so early return.
      return;
    case "Tab":
      // Don't propogate Tab down to the collection, otherwise we will try to focus the collection via useSelectableCollection's Tab handler (aka shift tab logic)
      // We want FocusScope to handle Tab if one exists (aka sub dialog), so special casepropogate
      return;
    case "Home":
    case "End":
    case "PageDown":
    case "PageUp":
    case "ArrowUp":
    case "ArrowDown":
    case "ArrowRight":
    case "ArrowLeft": {
      if ((e.key === "Home" || e.key === "End") && focusedNodeId == null && e.shiftKey) {
        return;
      }

      // If there is text within the input field, we'll want continue propagating events down
      // to the wrapped collection if there is a focused node so that a user can continue moving the
      // virtual focus. However, if the user doesn't have a focus in the collection, just move the text
      // cursor instead. They can move focus down into the collection via down/up arrow if need be
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        if (focusedNodeId == null) {
          if (!e.cancelBubble) {
            e.stopPropagation();
          }
          return;
        }

        break;
      }

      // Prevent these keys from moving the text cursor in the input
      e.preventDefault();
      // Move virtual focus into the wrapped collection
      const focusCollection = new CustomEvent(FOCUS_EVENT, {
        cancelable: true,
        bubbles: true,
      });

      aria.collectionRef()?.dispatchEvent(focusCollection);
      break;
    }
  }

  // Emulate the keyboard events that happen in the input field in the wrapped collection. This is for triggering things like onAction via Enter
  // or moving focus from one item to another. Stop propagation on the input event if it isn't already stopped so it doesn't leak out. For events
  // like ESC, the dispatched event below will bubble out of the collection and be stopped if handled by useSelectableCollection, otherwise will bubble
  // as expected
  if (!e.cancelBubble) {
    e.stopPropagation();
  }

  let shouldPerformDefaultAction = true;
  const collection = aria.collectionRef();
  if (collection != null) {
    if (focusedNodeId == null) {
      shouldPerformDefaultAction = collection.dispatchEvent(new KeyboardEvent(e.type, e)) || false;
    } else {
      const item = getOwnerDocument(collection).getElementById(focusedNodeId);
      if (item) {
        shouldPerformDefaultAction = item.dispatchEvent(new KeyboardEvent(e.type, e)) || false;
      }
    }
  }

  if (shouldPerformDefaultAction) {
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowRight": {
        // Clear the activedescendant so NVDA announcements aren't interrupted but retain the focused key in the collection so the
        // user's keyboard navigation restarts from where they left off
        autocompleteClearVirtualFocus(aria, state);
        break;
      }
      case "Enter":
        // Trigger click action on item when Enter key was pressed.
        if (focusedNodeId != null) {
          const item = getOwnerDocument(collection).getElementById(focusedNodeId);
          item?.dispatchEvent(new PointerEvent("click", e));
        }
        break;
    }
  } else {
    // TODO: check if we can do this, want to stop textArea from using its default Enter behavior so items are properly triggered
    e.preventDefault();
  }
}

function listenKeyUp(aria: AutocompleteAriaState): void {
  const t = transient(aria);
  if (t.keyUp || typeof document === "undefined") return;
  const handler = (e: KeyboardEvent) => autocompleteKeyUpCapture(e, aria);
  t.keyUp = handler;
  getOwnerDocument(aria.inputRef()).addEventListener("keyup", handler, true);
}

/** Upstream `onKeyUpCapture` (document capture listener). */
export function autocompleteKeyUpCapture(e: KeyboardEvent, aria: AutocompleteAriaState): void {
  const t = transient(aria);
  // Dispatch simulated key up events for things like triggering links in listbox
  // Make sure to stop the propagation of the input keyup event so that the simulated keyup/down pair
  // is detected by usePress instead of the original keyup originating from the input
  if (getEventTarget(e) === t.keyDownTarget) {
    e.stopImmediatePropagation();
    if (t.keyUp) getOwnerDocument(aria.inputRef()).removeEventListener("keyup", t.keyUp, true);
    t.keyUp = null;
    const focusedNodeId = t.queuedActiveDescendant;
    if (focusedNodeId == null) {
      aria.collectionRef()?.dispatchEvent(new KeyboardEvent(e.type, e));
    } else {
      const item = getOwnerDocument(aria.inputRef()).getElementById(focusedNodeId);
      item?.dispatchEvent(new KeyboardEvent(e.type, e));
    }
  }
}

// Be sure to clear/restore the virtual + collection focus when blurring/refocusing the field so we only show the
// focus ring on the virtually focused collection when are actually interacting with the Autocomplete
/** Upstream `onBlur`. */
export function autocompleteBlur(e: FocusEvent, aria: AutocompleteAriaState): void {
  if (!e.isTrusted) {
    return;
  }

  const queued = transient(aria).queuedActiveDescendant;
  const lastFocusedNode = queued ? getOwnerDocument(aria.inputRef()).getElementById(queued) : null;
  if (lastFocusedNode) {
    dispatchVirtualBlur(lastFocusedNode, e.relatedTarget as Element | null);
  }
}

/** Upstream `onFocus`. */
export function autocompleteFocus(e: FocusEvent, aria: AutocompleteAriaState): void {
  if (!e.isTrusted) {
    return;
  }

  const queued = transient(aria).queuedActiveDescendant;
  const curFocusedNode = queued ? getOwnerDocument(aria.inputRef()).getElementById(queued) : null;
  if (curFocusedNode) {
    const target = getEventTarget(e) as Element;
    queueMicrotask(() => {
      // instead of focusing the last focused node, just focus the collection instead and have the collection handle what item to focus via useSelectableCollection/Item
      const collection = aria.collectionRef();
      dispatchVirtualBlur(target, collection ?? null);
      if (collection) dispatchVirtualFocus(collection, target);
    });
  }
}

// Clicking back into the input can happen after focus moved elsewhere in the dialog, while
// virtual focus is still on an option. Clear virtual focus on pointer down so mouse
// interactions restore the input state before the click's focus handling runs.
// Touch is excluded because touch interactions should not move focus back to the input.
/** Upstream `onPointerDown`. */
export function autocompletePointerDown(e: PointerEvent, aria: AutocompleteAriaState, state: AutocompleteState): void {
  const input = aria.inputRef();
  if (e.button !== 0 || e.pointerType === "touch" || transient(aria).queuedActiveDescendant == null || input == null) {
    return;
  }

  if (getEventTarget(e) === input) {
    autocompleteClearVirtualFocus(aria, state);
  }
}
