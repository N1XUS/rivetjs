import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { domCollection, getItemElement } from "@rivetjs/cdk/collections/dom";
import { ListKeyboardDelegate, searchCollator } from "@rivetjs/cdk/selection/list-keyboard-delegate";
import { SelectionManager } from "@rivetjs/cdk/selection/manager";
import { createMultipleSelectionState, type MultipleSelectionState } from "@rivetjs/cdk/selection/state";
import { typeSelectKeyDown, typeSelectSearch } from "@rivetjs/cdk/selection/type-select";
import type { Key } from "@rivetjs/cdk/collections/types";

export const head = { title: "ListKeyboardDelegate and type select" };

const countries = ["Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Czechia", "Denmark"].map((label) => ({ key: label.toLowerCase(), label }));

function onKeyDown(state: MultipleSelectionState, searched: (text: string) => void, e: KeyboardEvent & { currentTarget: HTMLElement }) {
  const list = e.currentTarget;
  const collection = domCollection(list);
  const manager = new SelectionManager(collection, state);
  // Typeahead needs a collator (react-aria useCollator).
  const delegate = new ListKeyboardDelegate({ collection, ref: list, disabledKeys: state.disabledKeys, collator: searchCollator() });
  const from = manager.focusedKey;
  let to: Key | null = null;
  if (e.key === "ArrowDown") to = from == null ? delegate.getFirstKey() : delegate.getKeyBelow(from);
  else if (e.key === "ArrowUp") to = from == null ? delegate.getLastKey() : delegate.getKeyAbove(from);
  else if (e.key === "Home") to = delegate.getFirstKey();
  else if (e.key === "End") to = delegate.getLastKey();
  else if (typeSelectKeyDown(list, { keyboardDelegate: delegate, selectionManager: manager }, e)) {
    // Typeahead set the focused key; the owner (the list element) keeps the search text.
    to = manager.focusedKey;
    searched(typeSelectSearch(list));
  }
  if (to == null) return;
  e.preventDefault();
  manager.setFocusedKey(to);
  getItemElement(list, to)?.focus();
}

// #region demo
export default function Countries() {
  const state = createMultipleSelectionState({ selectionMode: "none", disabledKeys: ["cyprus"], defaultFocusedKey: "austria" });
  const search = signal("");
  return (
    <section class="m-4 grid max-w-xs gap-2 text-sm">
      <ul
        id="countries"
        role="listbox"
        aria-label="Countries"
        data-rk="ArrowDown ArrowUp Home End"
        class="m-0 grid list-none rounded-md border border-slate-300 p-1"
        onKeyDown={(e) => onKeyDown(state, (text) => search.set(text), e)}
      >
        <For each={() => countries} by={(country) => country.key}>
          {(country) => {
            const { key, label } = country();
            return (
              <li
                id={"country-" + key}
                role="option"
                data-key={key}
                aria-disabled={state.disabledKeys.has(key) ? "true" : undefined}
                tabIndex={state.focusedKey() === key ? 0 : -1}
                class="rounded px-2 py-1 outline-none aria-disabled:opacity-40 focus-visible:bg-slate-100 focus-visible:ring-2"
              >
                {label}
              </li>
            );
          }}
        </For>
      </ul>
      <output id="search" class="text-slate-600">
        Search: "{search()}"
      </output>
    </section>
  );
}
// #endregion
