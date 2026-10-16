// Ported from react-spectrum (react-aria: selection/useTypeSelect), Apache-2.0, © Adobe.
//
// LOCAL ADAPTER (split from `./selection.ts`): typeahead for delegated collection handlers and the closed
// Select trigger. The buffer lives in a WeakMap keyed by the selection state (never serialized).
import type { Key, KeyboardDelegate, SelectionManager } from "./collections.ts";

const TYPEAHEAD_DEBOUNCE_WAIT_MS = 1000;
const searches = new WeakMap<object, { search: string; timeout?: ReturnType<typeof setTimeout> }>();

function getStringForKey(key: string): string {
  // Length 1: a character; otherwise a non-ASCII key name is a Unicode character.
  if (key.length === 1 || !/^[A-Z]/i.test(key)) return key;
  return "";
}

/**
 * Typeahead keydown (incl. the capture-phase Space-in-search case). Returns true when the key was
 * consumed (default prevented, propagation stopped).
 */
export function typeSelectKeyDown(
  list: object,
  root: HTMLElement,
  manager: SelectionManager,
  delegate: KeyboardDelegate,
  e: KeyboardEvent,
  onTypeSelect?: (key: Key) => void,
): boolean {
  if (!delegate.getKeyForSearch) return false;
  let state = searches.get(list);
  if (!state) searches.set(list, (state = { search: "" }));
  const reset = () => {
    clearTimeout(state!.timeout);
    state!.timeout = setTimeout(() => (state!.search = ""), TYPEAHEAD_DEBOUNCE_WAIT_MS);
  };
  // Space continues a search in progress (capture phase in the original).
  if (state.search.length > 0 && e.key === " ") {
    e.preventDefault();
    e.stopPropagation();
    state.search += " ";
    let key = delegate.getKeyForSearch(state.search, manager.focusedKey);
    if (key == null) key = delegate.getKeyForSearch(state.search);
    if (key != null) {
      manager.setFocusedKey(key);
      onTypeSelect?.(key);
    }
    reset();
    return true;
  }
  const character = getStringForKey(e.key);
  if (!character || e.ctrlKey || e.metaKey || e.altKey || (state.search.length === 0 && character === " ")) return false;
  state.search += character;
  let key = delegate.getKeyForSearch(state.search, manager.focusedKey);
  if (key == null) key = delegate.getKeyForSearch(state.search);
  if (key == null) {
    state.search = "";
    clearTimeout(state.timeout);
    state.timeout = undefined;
    return false;
  }
  manager.setFocusedKey(key);
  onTypeSelect?.(key);
  e.preventDefault();
  e.stopPropagation();
  reset();
  return true;
}

/** Test hook: clear the typeahead buffer of `list`. */
export const _resetTypeSelect = (list: object): void => void searches.delete(list);
