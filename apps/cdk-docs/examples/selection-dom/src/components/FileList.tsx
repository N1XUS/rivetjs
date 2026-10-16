import { signal, untrack, type Signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import {
  clearSelection,
  createSelection,
  domItems,
  extendTo,
  isSelected,
  keyOf,
  sameKey,
  selectAll,
  toggleKey,
  type Key,
  type Selection,
} from "@rivetjs/cdk/collections";
import { navigationKeys, nextIndex } from "@rivetjs/cdk/keys";
import { roveFocus } from "@rivetjs/cdk/focus";
import { isCtrlKeyPressed } from "@rivetjs/cdk/platform";

const files = [
  { key: "a", label: "notes.md" },
  { key: "b", label: "photo.jpg" },
  { key: "c", label: "report.pdf" },
  { key: "d", label: "slides.key" },
];

// #region demo
const OPTION = '[role="option"]';
const keysIn = (list: Element): Key[] => domItems(list, OPTION).map((el) => keyOf(el)!);

function onKeyDown(selection: Selection, focused: Signal<Key>, event: KeyboardEvent & { currentTarget: HTMLElement }) {
  const list = event.currentTarget,
    items = domItems(list, OPTION),
    from = items.findIndex((el) => sameKey(keyOf(el), untrack(focused)));
  if (event.key === " ") {
    event.preventDefault();
    return toggleKey(selection, untrack(focused));
  }
  if (event.key.toLowerCase() === "a" && isCtrlKeyPressed(event)) {
    event.preventDefault();
    return selectAll(selection, keysIn(list));
  }
  const to = nextIndex(items.length, from, event.key);
  if (to === null) return;
  event.preventDefault();
  const key = keyOf(items[to]!)!;
  roveFocus(items, items[to]!);
  focused.set(key);
  // Shift+arrow: select the range from the anchor (the last toggled item) to the new item.
  if (event.shiftKey) extendTo(selection, keysIn(list), key);
}

export function FileList() {
  const selection = createSelection({ mode: "multiple" });
  const focused = signal<Key>(files[0]!.key);
  const all = () =>
    selectAll(
      selection,
      files.map((file) => file.key),
    );
  const none = () => clearSelection(selection);
  return (
    <div class="grid gap-2">
      <div
        id="files"
        role="listbox"
        aria-label="Files"
        aria-multiselectable="true"
        data-rk={navigationKeys() + " Space"}
        class="grid rounded-md border border-slate-300 p-1"
        onKeyDown={(event) => onKeyDown(selection, focused, event)}
      >
        <For each={() => files} by={(file) => file.key}>
          {(file) => {
            const { key, label } = file();
            return (
              <div
                id={"file-" + key}
                role="option"
                data-key={key}
                class="rounded px-2 py-1 aria-selected:bg-teal-700 aria-selected:text-white"
                aria-selected={isSelected(selection, key) ? "true" : "false"}
                tabIndex={sameKey(focused(), key) ? 0 : -1}
                onClick={() => toggleKey(selection, key)}
              >
                {label}
              </div>
            );
          }}
        </For>
      </div>
      <div class="flex items-center gap-2">
        <button id="all" type="button" class="rounded border border-slate-300 px-2 py-1" onClick={all}>
          Select all
        </button>
        <button id="none" type="button" class="rounded border border-slate-300 px-2 py-1" onClick={none}>
          Clear
        </button>
        <span id="count" class="text-slate-600">
          {selection.selected().size} selected
        </span>
      </div>
    </div>
  );
}
// #endregion
