---
title: "Step 1: a page"
description: Write the first page of the reading list app and learn how a file in src/routes becomes a URL.
template: tutorial
status: experimental
related: [guides/routing/file-routes, guides/routing/head-and-seo, learn/server-first]
---

## Goal

Show a heading and a list of three books at `/`. You learn what a page file is, where it runs, and how to set the page title.

## Write the page

Replace the content of `src/routes/index.tsx`:

```tsx title="src/routes/index.tsx"
// The title of the browser tab.
export const head = { title: "Reading list" };

// The page at `/`. It runs once, on the server (here: at build time).
export default function Home() {
  return (
    <main class="mx-auto max-w-xl p-6">
      <h1 class="text-2xl font-bold">My reading list</h1>
      <p class="mt-1 text-slate-600">Books I want to read this year.</p>
      <ul id="books" class="mt-4 list-disc pl-6">
        <li>The Hobbit</li>
        <li>Dune</li>
        <li>Kindred</li>
      </ul>
    </main>
  );
}
```

Three things to notice:

- **The file name is the URL.** `index.tsx` in `src/routes` is the page at `/`. A file `src/routes/about.tsx` would be `/about`.
- **The default export is the page.** It is a function that returns JSX.
- **`head` sets the title.** The router puts `head.title` into the `<title>` tag through `src/document.ts`.

The JSX is close to HTML. Use `class` like in HTML. The `class` values here are Tailwind CSS classes, which the starter includes.

## Where this code runs

`Home()` runs on the server. In this static starter, "the server" is the build: `npm run build` calls `Home()` once and saves the result as `dist/client/index.html`.

The page has no event handlers and no state. So the browser receives HTML and CSS, and does not need any code from this page. With the default `clientRouter: false`, the router alone adds no JavaScript either; links load documents.

## Check that it works

Open the dev server address. You see the heading and three books. The browser tab says "Reading list".

Here is the same page, built for production:

::example{id=tutorial-01}

Open the "Server HTML" tab of the example. The `<h1>` and the `<li>` items are already in the HTML. The browser shows them without running JavaScript.

## Next step

The three list items repeat the same markup. In the next step you move that markup into a component.

[Step 2: components and props](02-components-and-props.md)
