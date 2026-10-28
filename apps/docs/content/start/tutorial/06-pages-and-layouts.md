---
title: "Step 6: pages and layouts"
description: Move the list into a component, add an About page, and share navigation between pages with a _layout.tsx file.
template: tutorial
status: experimental
related: [guides/routing/layouts, guides/routing/file-routes, guides/routing/links-and-navigation]
---

## Goal

The app gets a second page at `/about` and a navigation bar on every page. You learn how to add pages, how a layout wraps them, and where state lives when you move between pages.

## Move the list into a component

Move the content of the page from step 5 into `src/components/ReadingList.tsx`. The code is the same; only the function name and the outer element (`<section>`) change:

```tsx title="src/components/ReadingList.tsx"
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
```

It is outside `src/routes` and has state. It needs no entry in `vite.config.ts`: `rivetRouter` resumes it because a route imports it.

The page becomes short:

```tsx title="src/routes/index.tsx"
import { ReadingList } from "../components/ReadingList.tsx";

export const head = { title: "Reading list" };

// The page at `/`. The layout adds the navigation around it.
export default function Home() {
  return (
    <>
      <h1 class="text-2xl font-bold">My reading list</h1>
      <ReadingList />
    </>
  );
}
```

`<>…</>` is a fragment: it groups elements without adding an element to the HTML.

## Add a second page

Create `src/routes/about.tsx`. The file name makes the URL `/about`:

```tsx title="src/routes/about.tsx"
export const head = { title: "About" };

// The page at `/about`. The layout wraps it like every other page.
export default function About() {
  return (
    <>
      <h1 class="text-2xl font-bold">About</h1>
      <p class="mt-2 text-slate-600">I keep this list to remember what to read next.</p>
    </>
  );
}
```

## Add a layout

Create `src/routes/_layout.tsx`. A file named `_layout.tsx` wraps every page in its folder and the folders below. The current page arrives as `children`:

```tsx title="src/routes/_layout.tsx"
import type { LayoutProps } from "@rivetjs/router";

// Wraps every page in src/routes. `children` is the current page.
export default function Layout({ children }: LayoutProps) {
  return (
    <div class="mx-auto max-w-xl p-6">
      <nav id="nav" class="mb-4 flex gap-4 text-sm">
        <a class="text-teal-700 underline" href="/">
          Books
        </a>
        <a class="text-teal-700 underline" href="/about">
          About
        </a>
      </nav>
      <main>{children}</main>
      <footer class="mt-6 border-t border-slate-200 pt-3 text-xs text-slate-500">A reading list built with Rivet.</footer>
    </div>
  );
}
```

The links are plain `<a href>` elements, so they work without JavaScript. If you want TypeScript to check the paths, use `Link` from `@rivetjs/router/link` instead. It renders the same `<a>`, and its `to` prop only accepts paths of your route files (from `.rivet/routes.d.ts`), so a typo such as `"/abuot"` is a type error:

```tsx
import { Link } from "@rivetjs/router/link";

<Link to="/about">About</Link>;
```

When the router's script has loaded, it handles the click: it fetches the next page's code and data and swaps only the page inside the layout, without a full reload. See [links and navigation](../../guides/routing/links-and-navigation.md).

## Where state lives

During client navigation, the layout in `src/routes/_layout.tsx` stays on screen and the page inside it is replaced. A static page with no other JavaScript uses document navigation by default, which resets layout state too. Set `clientRouter: true` in `rivetRouter` if every page must navigate in place. With client navigation:

- State in the root layout survives a page change.
- State in a page, such as the books you added in `ReadingList`, is lost when you go to `/about` and back. The list starts again from `initialBooks`.

To keep data across pages and reloads, store it on a server. See [loading data](../../guides/routing/loading-data.md) and [actions and forms](../../guides/routing/actions-and-forms.md).

## Check that it works

Run `npm run dev`. You see "Books" and "About" at the top. Click "About": the About page appears inside the same layout and the tab title changes to "About". Click "Books" to go back.

Then build it for production:

```bash
npm run build
npm run preview
```

The build writes `dist/client/index.html` and `dist/client/about/index.html`.

::example{id=tutorial-06}

:::note
The preview frame above shows only the first page. It runs under a sub-path of the docs site, where the links to `/` and `/about` do not point at the example. Run the app on your machine to move between the pages.
:::

## What you built

- A page from a file in `src/routes` ([step 1](01-a-page.md)).
- A component with props ([step 2](02-components-and-props.md)).
- State in a signal and a click handler ([step 3](03-state.md)).
- A list with `For`, keys and a computed value ([step 4](04-lists.md)).
- A form with `model:value` ([step 5](05-input.md)).
- Two pages and a shared layout (this step).

## Next steps

- [Server first](../../learn/server-first.md) and [Resuming](../../learn/resuming.md): why the code ran where it did.
- [Loading data](../../guides/routing/loading-data.md): load the books on the server instead of from a file.
- [Actions and forms](../../guides/routing/actions-and-forms.md): save new books on a server, with the server starter.
