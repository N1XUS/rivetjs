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

| | Page (`PageProps`) | Layout (`LayoutProps`) |
| --- | --- | --- |
| Data | `data.title` | `data().title` |
| Params | `params.slug` | `params().slug` |
| URL | `url.pathname` | `url().pathname` |

A page renders again for each URL, so its props are plain values. A page with `export const live = true` gets `data()` as a function too ([loading data](./loading-data.md)).

Layout loaders and the page loader run at the same time, after all guards. During client navigation, the router can reuse layout data when that layout's own params have not changed. A loader that reads the URL runs again for URL changes; forms and `invalidate()` refresh data explicitly. Guards still run on the server.

## Root layout state survives navigation

When the user clicks a link, the router fetches the new page's data and swaps the page. What happens to layouts depends on where they are:

| Layout | On client navigation |
| --- | --- |
| Root `_layout.tsx` | Stays on the page. Its signals keep their values (an open menu stays open). `data()` and `url()` update. |
| Nested layouts (in folders) | Stay mounted while the next route shares that layout. Their signals survive; `data()`, `params()` and `url()` update. Leaving the layout disposes it. |

Keep state needed across every route, such as a cart counter or a theme switch, in the root layout. A nested layout keeps state across its own pages.

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
- **Expecting nested state after leaving its layout.** Shared nested layouts survive navigation within their area. Move state to the root layout when it must survive leaving that area too.
- **Expecting nested layouts around a server error page.** On a full page load, 404 and error pages render inside the root layout (with its data and `head`), not inside nested layouts; when the root layout's own guard or loader failed, without it. During client navigation the error renders inside the layouts that stay. See [errors and 404 pages](./errors-and-404.md#layouts-and-head).

## See also

- [File routes](./file-routes.md)
- [Loading data](./loading-data.md)
- [Guards](./guards.md)
