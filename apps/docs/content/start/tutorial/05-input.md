---
title: "Step 5: input"
description: Add a form that adds books to the list, with an input bound to a signal through model:value.
template: tutorial
status: experimental
related: [guides/components/forms-and-input, guides/components/events, guides/routing/actions-and-forms]
---

## Goal

Add a text field and an "Add" button. When you submit the form, the new book appears at the end of the list. You learn `model:value` and form events.

## Add a signal for the input

In `src/routes/index.tsx`, add a signal for the text in the field, next to the others:

```tsx title="src/routes/index.tsx"
import { signal, computed } from "@rivetjs/reactivity";

const books = signal(initialBooks);
const readCount = computed(() => books().filter((book) => book.read).length);
// The text in the input box. `model:value` keeps the signal and the input in sync.
const title = signal(""); // [!code ++]
```

## Add the form

Put the form between the summary and the list:

```tsx title="src/routes/index.tsx"
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
```

What each part does:

- **`model:value={title}`** connects the input to the signal in both directions. When you type, `title` gets the new text. When the code calls `title.set("")`, the field becomes empty.
- **`onSubmit`** runs when you press :kbd[Enter] in the field or click "Add". `event.preventDefault()` stops the browser from sending the form to a server and reloading the page.
- **`books.update(...)`** builds a new array with the new book at the end. `For` adds one row for it; the other rows stay as they are.
- **`id: Date.now()`** uses the submission time as a key for this small demo. Reading the clock inside a handler is allowed. Real data should use stable unique IDs: two additions in the same millisecond could share a timestamp.
- **The `<label>`** names the field for screen readers. `sr-only` is a Tailwind class that hides it visually.

The rest of the page stays as in step 4.

## What runs where

The input accepts text before the app code loads. Its first input event wakes the containing boundary and connects `model:value` to the signal, preserving text already typed. The submit handler belongs to that boundary too; it is not a separately loaded handler.

## Check that it works

Type "Piranesi" into the field and press :kbd[Enter]. The book appears at the end of the list, the field empties, and the summary says "1 of 4 read". Click "Not read yet" on the new book: the summary says "2 of 4 read".

::example{id=tutorial-05}

:::note[The list is not saved]
The new books live in the browser only. Reload the page and they are gone. To keep data, a server has to store it: a form posts to the page's server code (an :term[action]{id=action}), which saves it and reloads the page. That needs the server starter. See [actions and forms](../../guides/routing/actions-and-forms.md).
:::

## Next step

The page is getting long. In the next step you move the list into a component, add a second page, and share a navigation bar between pages with a layout.

[Step 6: pages and layouts](06-pages-and-layouts.md)
