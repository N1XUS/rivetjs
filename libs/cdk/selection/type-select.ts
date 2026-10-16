// Ported from @react-aria/selection (useTypeSelect.ts), Apache-2.0, © Adobe.
//
// Rivet: the search buffer lives per owner (the collection element, or any object) in a WeakMap,
// not in component state, so resumed handlers share it without serializing it.
import { nodeContains } from "./dom-utils.ts";
import type { Key, KeyboardDelegate } from "../collections/types.ts";
import type { MultipleSelectionManager } from "./manager.ts";

/** How long to wait before clearing the typeahead buffer. */
export const TYPEAHEAD_DEBOUNCE_WAIT_MS = 1000;

export interface AriaTypeSelectOptions {
  /** A delegate that returns collection item keys with respect to visual layout. */
  keyboardDelegate: KeyboardDelegate;
  /** An interface for reading and updating multiple selection state. */
  selectionManager: Pick<MultipleSelectionManager, "focusedKey" | "setFocusedKey">;
  /** Called when an item is focused by typing. */
  onTypeSelect?: ((key: Key) => void) | undefined;
}

interface Buffer {
  search: string;
  timeout: ReturnType<typeof setTimeout> | undefined;
}

const buffers = new WeakMap<object, Buffer>();
const bufferOf = (owner: object): Buffer => {
  let b = buffers.get(owner);
  if (!b) buffers.set(owner, (b = { search: "", timeout: undefined }));
  return b;
};

/** Current search string of `owner` (tests, custom handlers). */
export const typeSelectSearch = (owner: object): string => buffers.get(owner)?.search ?? "";

/** Clear the buffer of `owner`. */
export function resetTypeSelect(owner: object): void {
  const b = buffers.get(owner);
  if (!b) return;
  clearTimeout(b.timeout);
  b.search = "";
  b.timeout = undefined;
}

function schedule(b: Buffer): void {
  clearTimeout(b.timeout);
  b.timeout = setTimeout(() => {
    b.search = "";
  }, TYPEAHEAD_DEBOUNCE_WAIT_MS);
}

function search(b: Buffer, options: AriaTypeSelectOptions): Key | null {
  const { keyboardDelegate, selectionManager } = options;
  if (keyboardDelegate.getKeyForSearch == null) return null;
  // Prioritize items after the currently focused item, falling back to searching the whole list.
  let key = keyboardDelegate.getKeyForSearch(b.search, selectionManager.focusedKey);
  if (key == null) key = keyboardDelegate.getKeyForSearch(b.search);
  return key;
}

/**
 * Capture-phase keydown: while a search is in progress, Space extends the search instead of
 * selecting (and is stopped from reaching the bubble-phase handlers). Returns whether handled.
 */
export function typeSelectKeyDownCapture(owner: object, options: AriaTypeSelectOptions, e: KeyboardEvent): boolean {
  if (!options.keyboardDelegate.getKeyForSearch) return false;
  const b = bufferOf(owner);
  if (b.search.length > 0 && e.key === " ") {
    e.preventDefault();
    e.stopPropagation();
    b.search += " ";
    const key = search(b, options);
    if (key != null) {
      options.selectionManager.setFocusedKey(key);
      options.onTypeSelect?.(key);
    }
    schedule(b);
    return true;
  }
  return false;
}

/** Bubble-phase keydown: printable characters extend the search. Returns whether handled. */
export function typeSelectKeyDown(owner: object, options: AriaTypeSelectOptions, e: KeyboardEvent & { currentTarget: EventTarget | null }): boolean {
  if (!options.keyboardDelegate.getKeyForSearch) return false;
  const b = bufferOf(owner);
  const character = getStringForKey(e.key);
  if (
    !character ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey ||
    (typeof Node !== "undefined" && e.currentTarget instanceof Node && !nodeContains(e.currentTarget, e.target as Node)) ||
    (b.search.length === 0 && character === " ")
  ) {
    return false;
  }
  b.search += character;
  const key = search(b, options);
  if (key != null) {
    options.selectionManager.setFocusedKey(key);
    options.onTypeSelect?.(key);
    e.preventDefault();
    e.stopPropagation();
  } else {
    // If still nothing then the type to select is done and everything is reset.
    resetTypeSelect(owner);
    return false;
  }
  schedule(b);
  return true;
}

/**
 * react-aria `useTypeSelect`: the handler pair for an owner (`onKeyDownCapture` / `onKeyDown`),
 * undefined when the delegate cannot search.
 */
export function useTypeSelect(owner: object, options: AriaTypeSelectOptions): {
  typeSelectProps: { onKeyDownCapture?: (e: KeyboardEvent) => void; onKeyDown?: (e: KeyboardEvent & { currentTarget: EventTarget | null }) => void };
} {
  if (!options.keyboardDelegate.getKeyForSearch) return { typeSelectProps: {} };
  return {
    typeSelectProps: {
      onKeyDownCapture: (e) => void typeSelectKeyDownCapture(owner, options, e),
      onKeyDown: (e) => void typeSelectKeyDown(owner, options, e),
    },
  };
}

function getStringForKey(key: string): string {
  // If the key is of length 1, it is an ASCII value. Otherwise, if there are no ASCII characters in
  // the key name, it is a Unicode character. See https://www.w3.org/TR/uievents-key/
  if (key.length === 1 || !/^[A-Z]/i.test(key)) return key;
  return "";
}
