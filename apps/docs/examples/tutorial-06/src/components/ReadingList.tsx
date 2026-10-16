import { computed, signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { initialBooks } from "../books.ts";

// The list from step 5, moved out of the page into its own component.
export function ReadingList() {
  const books = signal(initialBooks);
  const readCount = computed(() => books().filter((book) => book.read).length);
  const title = signal("");

  return (
    <section>
      <p id="summary" class="text-slate-600">
        {readCount()} of {books().length} read
      </p>
      <form
        class="mt-4 flex gap-2"
        onSubmit={(event) => {
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
    </section>
  );
}
