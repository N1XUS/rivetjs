import { computed, signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { initialBooks } from "../books.ts";

export const head = { title: "Reading list" };

export default function Home() {
  const books = signal(initialBooks);
  const readCount = computed(() => books().filter((book) => book.read).length);
  // #region demo
  // The text in the input box. `model:value` keeps the signal and the input in sync.
  const title = signal("");

  return (
    <main class="mx-auto max-w-xl p-6">
      <h1 class="text-2xl font-bold">My reading list</h1>
      <p id="summary" class="mt-1 text-slate-600">
        {readCount()} of {books().length} read
      </p>
      <form
        class="mt-4 flex gap-2"
        onSubmit={(event) => {
          // Stay on the page: we handle the form in the browser.
          event.preventDefault();
          const text = title().trim();
          if (!text) return;
          books.update((list) => [...list, { id: Date.now(), title: text, author: "Unknown author", read: false }]);
          title.set("");
        }}
      >
        <label class="sr-only" for="new-title">
          Book title
        </label>
        <input id="new-title" class="flex-1 rounded-md border border-slate-300 px-3 py-1" placeholder="Add a book" model:value={title} />
        <button id="add" class="rounded-md bg-teal-700 px-3 py-1 font-semibold text-white">
          Add
        </button>
      </form>
      {/* #endregion */}
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
