import { computed, signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { initialBooks } from "../books.ts";

export const head = { title: "Reading list" };

// #region demo
export default function Home() {
  // One signal holds the whole list.
  const books = signal(initialBooks);
  // A computed value updates when the list changes.
  const readCount = computed(() => books().filter((book) => book.read).length);

  return (
    <main class="mx-auto max-w-xl p-6">
      <h1 class="text-2xl font-bold">My reading list</h1>
      <p id="summary" class="mt-1 text-slate-600">
        {readCount()} of {books().length} read
      </p>
      <ul id="books" class="mt-4 grid gap-2">
        <For each={books} by={(book) => book.id}>
          {(book) => (
            <li class="flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <div>
                <p class="font-semibold">{book().title}</p>
                <p class="text-sm text-slate-600">{book().author}</p>
              </div>
              <button
                type="button"
                class="rounded-md border border-teal-700 px-3 py-1 text-sm text-teal-700"
                onClick={() => {
                  const id = book().id;
                  // Replace the changed book with a new object; keep the others.
                  books.update((list) => list.map((item) => (item.id === id ? { ...item, read: !item.read } : item)));
                }}
              >
                {book().read ? "Read" : "Not read yet"}
              </button>
            </li>
          )}
        </For>
      </ul>
    </main>
  );
}
// #endregion
