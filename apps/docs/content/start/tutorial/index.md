---
title: Tutorial
description: Build a small reading list app in six steps and learn pages, components, signals, lists, input and layouts in Rivet.
template: tutorial
status: experimental
related: [start/quick-start, learn/server-first, learn/resuming]
---

## Goal

In this tutorial you build a reading list: a page that shows books, lets you mark them as read, and lets you add new ones. Each step adds one idea and ends with a live example you can click.

You learn:

1. [A page](01-a-page.md): a file in `src/routes` becomes a URL.
2. [Components and props](02-components-and-props.md): split the page into a reusable `BookCard`.
3. [State](03-state.md): a signal remembers whether a book is read.
4. [Lists](04-lists.md): render the books from data with `For`, and count the read ones.
5. [Input](05-input.md): add books with a form.
6. [Pages and layouts](06-pages-and-layouts.md): add a second page and shared navigation.

## Before you start

You need:

- A running static starter project (`npm create rivet@latest my-app -- --template static`). The [quick start](../quick-start.md) shows the options.
- Some HTML and JavaScript. If you know React or Vue components, the JSX will look familiar.

Each step shows the files you change. You can also read the code in the live examples without running anything.

## Clean the starter

The starter comes with a demo page and a counter. Remove what this tutorial replaces:

```bash
rm src/routes/about.tsx src/routes/_layout.tsx src/components/Counter.tsx
```

Keep `vite.config.ts` as it is. Route files and the components they import resume on their own, so the tutorial never lists components there:

```ts title="vite.config.ts"
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { rivetRouter } from "@rivetjs/router/vite";

export default defineConfig({
  plugins: [rivetRouter({ mode: "static", styles: ["src/styles.css"] }), tailwindcss()],
});
```

`src/routes/index.tsx` is still there. You replace its content in step 1.

## How to run each step

Start the dev server once and keep it running:

```bash
npm run dev
```

Save a file and the browser updates. At the end of a step, you can also run the production build to see how the page behaves for real users:

```bash
npm run build
npm run preview
```

:::note
Dev pages [resume](../../learn/resuming.md) by default too. Editing a resumed component reloads the page; code is served as unbundled modules. Use the production build to measure download sizes and loading behavior.
:::

## Check that it works

`npm run dev` prints an address and the page opens without errors. If it does not, go back to the [quick start](../quick-start.md).

## Next step

[Step 1: a page](01-a-page.md)
