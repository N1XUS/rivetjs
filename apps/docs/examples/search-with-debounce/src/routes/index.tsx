import { computed, signal } from "@rivetjs/reactivity";
import { clientEffect, For } from "@rivetjs/runtime/dom";
import type { PageProps } from "@rivetjs/router";

export const head = { title: "Search with debounce" };

// Server code in the page file, removed from the browser build. In a static build it runs once, at build time.
const allFruits = ["Apple", "Apricot", "Banana", "Blueberry", "Cherry", "Grape", "Lemon", "Mango", "Orange", "Papaya", "Pear", "Plum"];

export const serverLoad = () => ({ fruits: allFruits });

// #region demo
export default function Search({ data }: PageProps<typeof serverLoad>) {
  const fruits = data.fruits;
  // What is in the box right now (updates on every key press).
  const text = signal("");
  // What the list filters by (updates 250 ms after typing stops).
  const query = signal("");

  // Runs again each time `text` changes. The cleanup cancels the previous timer.
  clientEffect(() => {
    const value = text().trim().toLowerCase();
    const timer = setTimeout(() => query.set(value), 250);
    return () => clearTimeout(timer);
  });

  const results = computed(() => fruits.filter((fruit) => fruit.toLowerCase().includes(query())));

  return (
    <div class="p-6">
      <label for="search" class="block text-sm font-medium">
        Search fruits
      </label>
      <input id="search" type="search" model:value={text} class="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" autoComplete="off" />
      <p id="count" class="mt-3 text-sm text-slate-600" aria-live="polite">
        {results().length} of {fruits.length}
        {text().trim().toLowerCase() !== query() ? " (typing…)" : ""}
      </p>
      <div id="results">
        <ul class="mt-2 list-disc pl-6">
          <For each={results} by={(fruit) => fruit}>
            {(fruit) => <li>{fruit()}</li>}
          </For>
        </ul>
        <p class="text-slate-500" hidden={results().length > 0}>
          Nothing matches.
        </p>
      </div>
    </div>
  );
}
// #endregion
