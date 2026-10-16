import { signal, computed } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";

export const head = { title: "Todo list" };

interface Todo {
  id: number;
  text: string;
  done: boolean;
}

// #region demo
export default function Todos() {
  const todos = signal<Todo[]>([
    { id: 1, text: "Read the guide", done: true },
    { id: 2, text: "Build something", done: false },
  ]);
  const draft = signal("");
  const left = computed(() => todos().filter((todo) => !todo.done).length);

  return (
    <div class="m-4 max-w-sm text-sm">
      <form
        class="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const text = draft().trim();
          if (!text) return;
          // Make a new array: the signal compares old and new values with Object.is.
          todos.update((list) => [...list, { id: (list.at(-1)?.id ?? 0) + 1, text, done: false }]);
          draft.set("");
        }}
      >
        <input id="new-todo" class="flex-1 rounded border border-slate-300 px-2 py-1" model:value={draft} placeholder="New item" />
        <button id="add" class="rounded bg-teal-700 px-3 py-1 font-semibold text-white">
          Add
        </button>
      </form>
      <ul id="todos" class="mt-3 grid gap-1">
        {/* `by` gives each row a key, so Rivet keeps or moves rows instead of rebuilding them. */}
        <For each={todos} by={(todo) => todo.id}>
          {(todo) => (
            <li class="flex items-center gap-2">
              <input
                type="checkbox"
                checked={todo().done}
                onChange={() => todos.update((list) => list.map((t) => (t.id === todo().id ? { ...t, done: !t.done } : t)))}
              />
              <span class={todo().done ? "flex-1 text-slate-400 line-through" : "flex-1"}>{todo().text}</span>
              <button class="text-red-700" onClick={() => todos.update((list) => list.filter((t) => t.id !== todo().id))}>
                Remove
              </button>
            </li>
          )}
        </For>
      </ul>
      <p id="left" class="mt-3 text-slate-600">
        {left()} of {todos().length} left
      </p>
    </div>
  );
}
// #endregion
