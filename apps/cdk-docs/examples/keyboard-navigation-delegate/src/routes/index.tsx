import { signal } from "@rivetjs/reactivity";
import { CollectionBuilder, Item } from "@rivetjs/cdk/collections/builder";
import { ListCollection } from "@rivetjs/cdk/collections/list";
import type { Key } from "@rivetjs/cdk/collections/types";
import { ListKeyboardDelegate, searchCollator } from "@rivetjs/cdk/selection/list-keyboard-delegate";
import { typeSelectKeyDown } from "@rivetjs/cdk/selection/type-select";
import { direction } from "@rivetjs/cdk/bidi";

export const head = { title: "ListKeyboardDelegate grid" };

const fruits = ["Apple", "Banana", "Cherry", "Date", "Elderberry", "Fig", "Grape", "Kiwi", "Lemon"];

// #region demo
// The collection the delegate walks (keys in order, text for search).
const collection = new ListCollection(new CollectionBuilder<object>().build({ children: fruits.map((f) => Item({ key: f.toLowerCase(), children: f })) }));
const disabledKeys = new Set<Key>(["grape"]);

const moves: Record<string, (d: ListKeyboardDelegate<object>, key: Key) => Key | null> = {
  ArrowDown: (d, key) => d.getKeyBelow(key),
  ArrowUp: (d, key) => d.getKeyAbove(key),
  ArrowRight: (d, key) => d.getKeyRightOf?.(key) ?? null,
  ArrowLeft: (d, key) => d.getKeyLeftOf?.(key) ?? null,
  Home: (d) => d.getFirstKey(),
  End: (d) => d.getLastKey(),
};

export default function DelegateGrid() {
  const typed = signal("none");
  const onKeyDown = (event: KeyboardEvent & { currentTarget: HTMLElement }) => {
    const grid = event.currentTarget;
    const focus = (key: Key) => {
      const element = grid.querySelector<HTMLElement>(`[data-key="${key}"]`)!;
      grid.querySelectorAll("[data-key]").forEach((el) => el.setAttribute("tabindex", el === element ? "0" : "-1"));
      element.focus();
    };
    const current = (event.target as HTMLElement).dataset.key!;
    // ref: the element items are measured in (DOMLayoutDelegate).
    const delegate = new ListKeyboardDelegate({ collection, disabledKeys, ref: grid, layout: "grid", direction: direction(grid), collator: searchCollator() });
    const move = moves[event.key];
    if (move) {
      const next = move(delegate, current);
      event.preventDefault();
      if (next != null) focus(next);
      return;
    }
    // Letters: one search buffer per owner (here the grid element), reset after 1 s.
    typeSelectKeyDown(
      grid,
      {
        keyboardDelegate: delegate,
        selectionManager: { focusedKey: current, setFocusedKey: (key) => key != null && focus(key) },
        onTypeSelect: (key) => typed.set(String(key)),
      },
      event,
    );
  };
  return (
    <section class="m-4 grid gap-3 text-sm">
      <div role="group" aria-label="Fruit" data-rk="ArrowDown ArrowUp ArrowLeft ArrowRight Home End" onKeyDown={onKeyDown} class="grid w-72 grid-cols-3 gap-1">
        {fruits.map((fruit, i) => (
          <button
            type="button"
            data-key={fruit.toLowerCase()}
            tabIndex={i === 0 ? 0 : -1}
            aria-disabled={disabledKeys.has(fruit.toLowerCase()) ? "true" : undefined}
            class="rounded border border-slate-300 px-2 py-2 outline-none focus:bg-teal-600 focus:text-white aria-disabled:opacity-40"
          >
            {fruit}
          </button>
        ))}
      </div>
      <p>
        Type-selected: <output id="dg-typed">{typed()}</output>
      </p>
    </section>
  );
}
// #endregion
