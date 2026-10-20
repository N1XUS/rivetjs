---
title: Layouts
description: Wrap pages in shared headers, menus and sidebars with _layout.tsx files, give layouts their own data, and nest them by folder.
template: guide
related: [guides/routing/file-routes, guides/routing/loading-data, guides/routing/guards]
---

A **layout** is the part of the page that stays the same across many pages: the header, the menu, a sidebar. You write it once in a `_layout.tsx` file, and the router wraps every page in that folder with it. After reading this page you can add layouts, nest them, and give them data.

::example{id=nested-layouts}

## Add a root layout

A layout is a component that renders its `children` where the page goes:

```tsx title="src/routes/_layout.tsx"
import type { LayoutProps } from "@rivetjs/router";

export default function Layout({ children }: LayoutProps) {
  return (
    <div class="mx-auto max-w-2xl p-6">
      <nav class="flex gap-4">
        <a href="/">Home</a>
        <a href="/about">About</a>
      </nav>
      <main>{children}</main>
    </div>
  );
}
```

A `_layout.tsx` in `src/routes` wraps every page of the app. Put the `<html>` and `<body>` tags in the document shell (`src/document.ts`), not in a layout.

## Nest layouts with folders

Each folder can have its own `_layout.tsx`. Layouts nest from the outside in, following the folders:

```txt
src/routes/
  _layout.tsx              ← wraps everything
  index.tsx                → /            root layout
  settings/
    _layout.tsx            ← wraps the settings pages
    profile.tsx            → /settings/profile    root layout → settings layout
    password.tsx           → /settings/password   root layout → settings layout
```

To share a layout between pages without adding a URL segment, use a group folder. `(shop)/_layout.tsx` wraps `(shop)/index.tsx` and `(shop)/cart.tsx`, which answer `/` and `/cart`. The example above works this way.

## Give a layout data

A layout can export `load(…)`, like a page. Its result reaches the layout as `data`:

```tsx title="src/routes/_layout.tsx"
import type { LayoutProps, RequestEvent } from "@rivetjs/router";
import { load } from "@rivetjs/router";

export const loader = load(({ locals }: RequestEvent) => ({
  user: typeof locals.user === "string" ? locals.user : null,
}));

export default function Layout({ data, children }: LayoutProps<typeof loader>) {
  return (
    <div>
      <header>{data().user ? `Signed in as ${data().user}` : <a href="/login">Sign in</a>}</header>
      <main>{children}</main>
    </div>
  );
}
```

`load(…)` runs only on the server; the compiler removes it from the browser build. `LayoutProps<typeof loader>` takes the data type from it. The generated form `LayoutProps<"settings/_layout">` (the layout's file path without extension) also types `params()`; see [typed routes](./typed-routes.md).

Note the call: layout props are **functions**. Read them as `data()`, `params()` and `url()`. When the user moves to another page, the router updates these values, and only the parts of the layout that read them change.

Layout loaders and the page loader run at the same time, after all guards. A layout loader runs again on every navigation to a page inside it.

## Root layout state survives navigation

When the user clicks a link, the router fetches the new page's data and swaps the page. What happens to layouts depends on where they are:

| Layout | On client navigation |
| --- | --- |
| Root `_layout.tsx` | Stays on the page. Its signals keep their values (an open menu stays open). `data()` and `url()` update. |
| Nested layouts (in folders) | Rendered again with the page. Their signals start fresh. |

So keep state that must survive navigation, such as a cart counter or a theme switch, in the root layout or outside the routes.

## Show the current page in the menu

Use `url()` to mark the active link:

```tsx title="src/routes/_layout.tsx"
import type { LayoutProps } from "@rivetjs/router";

export default function Layout({ url, children }: LayoutProps) {
  return (
    <div>
      <nav>
        <a href="/" aria-current={url().pathname === "/" ? "page" : undefined}>Home</a>
        <a href="/about" aria-current={url().pathname === "/about" ? "page" : undefined}>About</a>
      </nav>
      <main>{children}</main>
    </div>
  );
}
```

The `aria-current` attributes update after each navigation, because they read `url()`.

## Protect a group of pages

A `guard(…)` in `_layout.tsx` runs before every page and [endpoint](./endpoints.md) below that folder. This is the usual way to protect a whole area, such as `(private)/` or `admin/`. See [guards](./guards.md).

## Common mistakes

- **Reading `data.user` instead of `data().user`.** In a layout, `data` is a function. In a page, `data` is a plain value.
- **Expecting `params()` in the root layout.** The root layout wraps every route, so its `params()` is always empty. Read `url()` instead.
- **Putting state that must survive navigation in a nested layout.** Nested layouts render again on every navigation. Move the state up to the root layout.
- **Expecting the root layout around server error pages.** When the root layout has server code (`load(…)`, `guard(…)`, …), a 404 or error page that the server renders (a full page load) shows without the root layout, because the error response carries no layout data. During client navigation the error renders inside the layout. Give `_404.tsx` and `_error.tsx` their own link back home.

## See also

- [File routes](./file-routes.md)
- [Loading data](./loading-data.md)
- [Guards](./guards.md)
