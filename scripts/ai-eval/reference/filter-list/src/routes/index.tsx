import { computed, signal } from "@rivetjs/reactivity";
import { For, Show } from "@rivetjs/runtime/dom";

export const head = { title: "Fruit" };

const fruits = ["Apple", "Banana", "Cherry", "Mango", "Orange"];

export default function Home() {
  const query = signal("");
  const results = computed(() => fruits.filter((fruit) => fruit.toLowerCase().includes(query().trim().toLowerCase())));
  return (
    <main class="p-6">
      <label for="q">Search fruit</label>
      <input id="q" type="search" model:value={query} />
      <ul id="results">
        <For each={results} by={(fruit) => fruit}>
          {(fruit) => <li data-name={fruit()}>{fruit()}</li>}
        </For>
      </ul>
      <Show when={results().length === 0}>
        <p id="empty">No fruit matches</p>
      </Show>
    </main>
  );
}
