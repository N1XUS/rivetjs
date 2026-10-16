import { computed, signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";

export const head = { title: "Todos" };

interface Todo {
  id: number;
  text: string;
  done: boolean;
}

export default function Home() {
  const todos = signal<Todo[]>([{ id: 1, text: "Read the docs", done: false }]);
  const text = signal("");
  const nextId = signal(2);
  const remaining = computed(() => todos().filter((todo) => !todo.done).length);
  const add = () => {
    const value = text().trim();
    if (!value) return;
    todos.update((list) => [...list, { id: nextId(), text: value, done: false }]);
    nextId.update((n) => n + 1);
    text.set("");
  };
  return (
    <main class="p-6">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          add();
        }}
      >
        <label for="new">New todo</label>
        <input id="new" model:value={text} />
        <button id="add" type="submit">
          Add
        </button>
      </form>
      <ul id="todos">
        <For each={todos} by={(todo) => todo.id}>
          {(todo) => (
            <li>
              <input
                class="done"
                type="checkbox"
                aria-label={`Done: ${todo().text}`}
                checked={todo().done}
                onChange={() => todos.update((list) => list.map((t) => (t.id === todo().id ? { ...t, done: !t.done } : t)))}
              />
              <span>{todo().text}</span>
              <button
                class="remove"
                type="button"
                aria-label={`Remove ${todo().text}`}
                onClick={() => todos.update((list) => list.filter((t) => t.id !== todo().id))}
              >
                Remove
              </button>
            </li>
          )}
        </For>
      </ul>
      <p id="remaining">{remaining()} left</p>
    </main>
  );
}
