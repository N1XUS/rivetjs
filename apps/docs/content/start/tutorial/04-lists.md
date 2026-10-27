---
title: "Step 4: lists"
description: Keep all books in one signal, render them with For, and show how many are read with a computed value.
template: tutorial
status: experimental
related: [guides/components/lists, guides/state/computed, learn/signals]
---

## Goal

Render the books from data instead of writing each one by hand, and show "1 of 3 read" above the list. You learn `For`, keys, and `computed`.

## Move the books into data

Create `src/books.ts`:

```ts title="src/books.ts"
// The data of the app. Later this could come from a file, an API or a database.
export interface Book {
  id: number;
  title: string;
  author: string;
  read: boolean;
}

export const initialBooks: Book[] = [
  { id: 1, title: "The Hobbit", author: "J. R. R. Tolkien", read: false },
  { id: 2, title: "Dune", author: "Frank Herbert", read: false },
  { id: 3, title: "Kindred", author: "Octavia E. Butler", read: true },
];
```

Each book has an `id`. The list uses it to tell the books apart.

## Render the list

Replace `src/routes/index.tsx`. The card markup moves into the page for now, because the button now changes the shared list:

```tsx title="src/routes/index.tsx"
import { computed, signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { initialBooks } from "../books.ts";

export const head = { title: "Reading list" };

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
```

You can delete `src/components/BookCard.tsx`. The page is in `src/routes`, so it works in the browser either way.

## How `For` works

`For` renders one row per item:

- `each` is a function that returns the array. Passing the signal `books` works, because a signal is a function.
- `by` returns a key for each item. Rivet uses the key to match rows when the list changes, so it can keep, move or remove the right rows. Use a stable, unique value such as an id, not the position in the array.
- The child is a function that receives `book`, an accessor: call `book()` to read the current item.

## Change the list without changing the old one

The click handler does not change the book object. It builds a new array with a new object for the changed book:

```ts
books.update((list) => list.map((item) => (item.id === id ? { ...item, read: !item.read } : item)));
```

A signal notifies when it gets a new value. If you changed `item.read` in place and returned the same array, the signal would see the same array and nothing would update.

## Derived values with `computed`

`readCount` is a :term[computed]{id=computed} value. It runs its function, remembers which signals it read (`books`), and runs again only when they change. You read it like a signal: `readCount()`.

The text `{readCount()} of {books().length} read` updates on its own after each click.

## Check that it works

The summary says "1 of 3 read". Click "Not read yet" on "The Hobbit": the button says "Read" and the summary says "2 of 3 read".

::example{id=tutorial-04}

:::tip
On the server, `For` writes all rows into the HTML. In the browser, Rivet reuses those rows: it does not render the list again on load. Rivet matches rows by their keys when the list changes. New keys create rows; removed keys dispose their rows.
:::

## Next step

The list is fixed in the code. In the next step you add a form to add books.

[Step 5: input](05-input.md)
