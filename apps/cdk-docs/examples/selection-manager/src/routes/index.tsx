import { For } from "@rivetjs/runtime/dom";
import { createMultipleSelectionState, readSelection, type MultipleSelectionState } from "@rivetjs/cdk/selection/state";
import type { Key, Selection } from "@rivetjs/cdk/collections/types";
import { onClick, onFocusIn, onFocusOut, onKeyDown, onKeyUp, onPointerDown, onPointerUp, tabIndexOf } from "../lib/list.ts";

export const head = { title: "SelectionManager on a custom list" };

const songs = [
  { key: "blue", label: "Blue in Green" },
  { key: "so", label: "So What" },
  { key: "freddie", label: "Freddie Freeloader" },
  { key: "blues", label: "All Blues" },
];

const show = (keys: Selection) => (keys === "all" ? "all" : [...keys].map(String).sort().join(", ") || "none");
const isSelected = (state: MultipleSelectionState, key: Key) => {
  const keys = readSelection(state);
  return keys === "all" || keys.has(key);
};

// #region demo
export default function Playlist() {
  // Plain signals and data: resumable.
  const state = createMultipleSelectionState({
    selectionMode: "multiple",
    selectionBehavior: "replace",
    disabledKeys: ["freddie"],
    defaultFocusedKey: "blue",
  });
  return (
    <section class="m-4 grid max-w-xs gap-2 text-sm">
      <ul
        id="playlist"
        role="listbox"
        aria-label="Playlist"
        aria-multiselectable="true"
        data-rk="ArrowDown ArrowUp Home End PageUp PageDown Space"
        class="m-0 grid list-none rounded-md border border-slate-300 p-1"
        onKeyDown={(e) => onKeyDown(state, e)}
        onKeyUp={(e) => onKeyUp(state, e)}
        onPointerDown={(e) => onPointerDown(state, e)}
        onPointerUp={(e) => onPointerUp(state, e)}
        onClick={(e) => onClick(state, e)}
        onFocusIn={(e) => onFocusIn(state, e)}
        onFocusOut={(e) => onFocusOut(state, e)}
      >
        <For each={() => songs} by={(song) => song.key}>
          {(song) => {
            const { key, label } = song();
            const disabled = state.disabledKeys.has(key);
            return (
              <li
                id={"song-" + key}
                role="option"
                data-key={key}
                aria-disabled={disabled ? "true" : undefined}
                aria-selected={isSelected(state, key) ? "true" : "false"}
                tabIndex={disabled ? undefined : tabIndexOf(state, key)}
                class="rounded px-2 py-1 outline-none aria-disabled:opacity-40 aria-selected:bg-teal-700 aria-selected:text-white focus-visible:ring-2"
              >
                {label}
              </li>
            );
          }}
        </For>
      </ul>
      <p id="playlist-value" class="text-slate-600">
        Selected: {show(readSelection(state))}
      </p>
    </section>
  );
}
// #endregion
